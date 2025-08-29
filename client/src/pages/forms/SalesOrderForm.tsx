import * as React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";

import { DEALER_TYPES, UNITS, REGIONS, AREAS } from "@/components/ReusableUI";

// —————————————————————————————————————
// Props
// —————————————————————————————————————
type UserLite = {
  id?: number;
  firstName?: string;
  lastName?: string;
  role?: string;
  phoneNumber?: string;
  email?: string;
};

export default function SalesOrderForm({
  user,               // can be undefined or null now
  onSubmitted,
  onCancel,
}: {
  user?: UserLite | null;   // ← allow null
  onSubmitted?: (payload: any) => void;
  onCancel?: () => void;
}) {
  // derive logged-in user (fallback to localStorage["user"])
  const memoUser = useMemo<UserLite>(() => {
    if (user?.firstName || user?.lastName) return user;
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return {};
      const u = JSON.parse(raw);
      return { id: u?.id, firstName: u?.firstName, lastName: u?.lastName, role: u?.role };
    } catch { return {}; }
  }, [user]);

  // ——————————————————————————————————
  // Form state (all mandatory per spec)
  // ——————————————————————————————————
  const [salesmanName, setSalesmanName] = useState(
    [memoUser.firstName, memoUser.lastName].filter(Boolean).join(" ") || ""
  );
  const [salesmanRole, setSalesmanRole] = useState(memoUser.role ?? "");

  const [dealerType, setDealerType] = useState<string>("");
  const [dealerName, setDealerName] = useState("");
  const [dealerPhone, setDealerPhone] = useState("");
  const [dealerAddress, setDealerAddress] = useState("");

  const [area, setArea] = useState<string>("");
  const [region, setRegion] = useState<string>("");

  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [orderTotal, setOrderTotal] = useState<string>("");    // ₹
  const [advancePayment, setAdvancePayment] = useState<string>("");
  const [pendingPayment, setPendingPayment] = useState<string>("");
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // extras (free text)
  const [remarks, setRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // keep pending in sync if user edits total/advance
  React.useEffect(() => {
    const total = Number(orderTotal || 0);
    const adv = Number(advancePayment || 0);
    if (Number.isFinite(total) && Number.isFinite(adv)) {
      const pending = Math.max(total - adv, 0);
      setPendingPayment(pending.toString());
    }
  }, [orderTotal, advancePayment]);

  const validate = (): string | null => {
    if (!salesmanName.trim()) return "Salesman name is required.";
    if (!salesmanRole.trim()) return "Salesman role is required.";
    if (!dealerType) return "Dealer type is required.";
    if (!dealerName.trim()) return "Dealer name is required.";
    if (!dealerPhone.trim()) return "Dealer phone number is required.";
    if (!dealerAddress.trim()) return "Dealer address is required.";
    if (!area) return "Dealer area is required.";
    if (!region) return "Dealer region is required.";
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) return "Enter a valid order quantity.";
    if (!unit) return "Select order quantity unit.";
    if (!orderTotal || isNaN(Number(orderTotal)) || Number(orderTotal) <= 0) return "Enter a valid order total.";
    if (advancePayment === "" || isNaN(Number(advancePayment)) || Number(advancePayment) < 0)
      return "Enter a valid advance amount.";
    if (pendingPayment === "" || isNaN(Number(pendingPayment)) || Number(pendingPayment) < 0)
      return "Pending payment must be valid.";
    if (!estimatedDelivery) return "Estimated delivery date is required.";
    return null;
  };

  const payload = useMemo(() => {
    const q = Number(quantity || 0);
    const ot = Number(orderTotal || 0);
    const ap = Number(advancePayment || 0);
    const pp = Number(pendingPayment || 0);

    // Friendly summary to send via SMS/Email later
    const summaryLines = [
      `Sales Order`,
      `---------------------------`,
      `Salesman: ${salesmanName} (${salesmanRole})`,
      `Dealer: ${dealerName} [${dealerType}]`,
      `Phone: ${dealerPhone}`,
      `Address: ${dealerAddress}`,
      `Area/Region: ${area} / ${region}`,
      `Quantity: ${q} ${unit}`,
      `Order Total: ₹${ot.toLocaleString()}`,
      `Advance: ₹${ap.toLocaleString()} | Pending: ₹${pp.toLocaleString()}`,
      `Delivery ETA: ${estimatedDelivery}`,
      remarks ? `Remarks: ${remarks}` : null,
    ].filter(Boolean).join("\n");

    return {
      meta: {
        toPhone: "123456789",
        toEmail: "example@mail.com",
      },
      order: {
        salesman: { name: salesmanName, role: salesmanRole, userId: memoUser.id ?? null },
        dealer: {
          type: dealerType, name: dealerName, phone: dealerPhone,
          address: dealerAddress, area, region,
        },
        details: {
          quantity: q, unit,
          orderTotal: ot,
          advancePayment: ap,
          pendingPayment: pp,
          estimatedDelivery, // YYYY-MM-DD
          remarks: remarks || null,
        },
      },
      message: summaryLines,
    };
  }, [
    salesmanName, salesmanRole, memoUser.id,
    dealerType, dealerName, dealerPhone, dealerAddress, area, region,
    quantity, unit, orderTotal, advancePayment, pendingPayment, estimatedDelivery, remarks
  ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) return alert(err);

    try {
      setSubmitting(true);
      // TODO: Later call your backend to send:
      // await fetch("/api/sales-order/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      onSubmitted?.(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Create Sales Order</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Salesman */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Salesman</Label>
          <Input value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Role</Label>
          <Input value={salesmanRole} onChange={(e) => setSalesmanRole(e.target.value)} required />
        </div>
      </div>

      {/* Dealer basic */}
      <div className="grid gap-2">
        <Label>Dealer Type</Label>
        <Select value={dealerType} onValueChange={setDealerType}>
          <SelectTrigger><SelectValue placeholder="Select dealer type" /></SelectTrigger>
          <SelectContent>
            {DEALER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Dealer Name</Label>
          <Input value={dealerName} onChange={(e) => setDealerName(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Dealer Phone No</Label>
          <Input inputMode="tel" value={dealerPhone} onChange={(e) => setDealerPhone(e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Dealer Address</Label>
        <Textarea rows={2} value={dealerAddress} onChange={(e) => setDealerAddress(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Area</Label>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
            <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
            <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Order details */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Order Quantity</Label>
          <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Order Total (₹)</Label>
          <Input inputMode="decimal" value={orderTotal} onChange={(e) => setOrderTotal(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Advance (₹)</Label>
          <Input inputMode="decimal" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Pending (₹)</Label>
          <Input inputMode="decimal" value={pendingPayment} onChange={(e) => setPendingPayment(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Estimated Delivery Date</Label>
          <Input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Remarks (optional)</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any special instruction" />
        </div>
      </div>

      {/* Preview (what will be sent) */}
      <div className="rounded-xl border bg-card/60 p-3 text-xs whitespace-pre-wrap">
        {payload.message}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>) : "Submit & Send"}
        </Button>
      </div>

      {/* Dev note for you */}
      {/* TODO: In your backend:
           - POST to /api/sales-order/send with `payload`
           - Send SMS to payload.meta.toPhone and Email to payload.meta.toEmail
           - No DB insert required for this workflow */}
    </form>
  );
}
