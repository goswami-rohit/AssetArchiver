import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";

// hardcoded dropdown selectors
const dealerTypes = ["Dealer-Best", "Sub Dealer-Best", "Dealer-Non Best", "Sub Dealer-Non Best"];
const brands = ["Star", "Amrit", "Dalmia", "Topcem", "Black Tiger", "Surya Gold", "Max", "Taj", "Specify in remarks"];
export const regions = ["Kamrup M", "Kamrup", "Karbi Anglong", "Dehmaji"];
export const areas = ["Guwahati", "Beltola", "Zoo Road", "Tezpur", "Diphu", "Nagaon", "Barpeta"];

type DealerLite = { id: string; name: string };

// add dealer form mutilselect
function BrandsMultiSelect({
  value, onChange, placeholder = "Select brands",
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const toggle = (b: string) =>
    onChange(value.includes(b) ? value.filter(v => v !== b) : [...value, b]);

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"                           // ✅ don’t submit the form
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value.length ? `${value.length} selected` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(22rem,calc(100vw-2rem))] p-0 z-[60]" // ✅ above dialog
        align="start"
        sideOffset={8}
      >
        <Command>
          <CommandInput placeholder="Search brand..." />
          <CommandList>
            <CommandEmpty>No brand found.</CommandEmpty>
            <CommandGroup>
              {brands.map(b => {
                const active = value.includes(b);
                return (
                  <CommandItem
                    key={b}
                    onSelect={() => toggle(b)}           // keep open for multi-pick
                    className="cursor-pointer"
                  >
                    <Check className={`mr-2 h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                    {b}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export default function AddDealerForm({
  userId,
  onSubmitted,
  onCancel,
}: {
  userId?: number;
  onSubmitted?: (payload: any) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = React.useState<string>("");
  const [parentDealerId, setParentDealerId] = React.useState<string>("");
  const [parentDealers, setParentDealers] = React.useState<DealerLite[]>([]);

  const [name, setName] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [area, setArea] = React.useState("");
  const [phoneNo, setPhoneNo] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [totalPotential, setTotalPotential] = React.useState("");
  const [bestPotential, setBestPotential] = React.useState("");
  const [brandSelling, setBrandSelling] = React.useState<string[]>([]);
  const [feedbacks, setFeedbacks] = React.useState("");
  const [remarks, setRemarks] = React.useState("");

  const requiresParent = React.useMemo(() => type.startsWith("Sub Dealer-"), [type]);

  // fetch parent dealers from backend
  React.useEffect(() => {
    async function fetchDealers() {
      try {
        // TODO: replace `/api/dealers` with your real Express/Next route
        const res = await fetch("/api/dealers");
        if (!res.ok) throw new Error("Failed to fetch dealers");
        const data = await res.json();
        setParentDealers(data); // expecting [{ id, name }, ...]
      } catch (err) {
        console.error("Error loading dealers:", err);
      }
    }
    fetchDealers();
  }, []);

  const validate = (): string | null => {
    if (!type) return "Type is required.";
    if (requiresParent && !parentDealerId) return "Select parent dealer.";
    if (!name) return "Name is required.";
    if (!region) return "Region is required.";
    if (!area) return "Area is required.";
    if (!phoneNo) return "Phone number is required.";
    if (!address) return "Address is required.";
    if (!totalPotential || Number.isNaN(Number(totalPotential))) return "Total potential must be a number.";
    if (!bestPotential || Number.isNaN(Number(bestPotential))) return "Best potential must be a number.";
    if (!brandSelling.length) return "Select at least one brand.";
    if (!feedbacks) return "Feedbacks is required.";
    return null;
  };

  const payload = React.useMemo(() => ({
    userId: userId ?? null,
    type,
    parentDealerId: requiresParent ? parentDealerId || null : null,
    name,
    region,
    area,
    phoneNo,
    address,
    totalPotential: Number(totalPotential),
    bestPotential: Number(bestPotential),
    brandSelling,
    feedbacks,
    remarks: remarks || null,
  }), [userId, type, requiresParent, parentDealerId, name, region, area, phoneNo, address, totalPotential, bestPotential, brandSelling, feedbacks, remarks]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) return alert(err);
    onSubmitted?.(payload);
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Add Dealer / Sub-Dealer</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Type */}
      <div className="grid gap-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent className="z-[60]">
            {dealerTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Parent Dealer */}
      {requiresParent && (
        <div className="grid gap-2">
          <Label>Parent Dealer</Label>
          <Select value={parentDealerId} onValueChange={setParentDealerId}>
            <SelectTrigger><SelectValue placeholder="Select parent dealer" /></SelectTrigger>
            <SelectContent className="z-[60]">
              {parentDealers.length
                ? parentDealers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))
                : <div className="px-3 py-2 text-sm text-muted-foreground">No dealers available</div>}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Other fields... (same as before) */}
      {/* Name, region, area, phone, address, potentials, brands, feedbacks, remarks */}

      <div className="grid gap-2">
        <Label>Dealer/Sub-Dealer Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
            <SelectContent className="z-[60]">
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Area</Label>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
            <SelectContent className="z-[60]">
              {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Phone No</Label>
        <Input inputMode="tel" value={phoneNo} onChange={e => setPhoneNo(e.target.value)} required />
      </div>

      <div className="grid gap-2">
        <Label>Address</Label>
        <Textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Total Potential</Label>
          <Input inputMode="decimal" value={totalPotential} onChange={e => setTotalPotential(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Best Potential</Label>
          <Input inputMode="decimal" value={bestPotential} onChange={e => setBestPotential(e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Brands Selling</Label>
        <BrandsMultiSelect value={brandSelling} onChange={setBrandSelling} />
      </div>

      <div className="grid gap-2">
        <Label>Feedbacks</Label>
        <Select value={feedbacks} onValueChange={setFeedbacks}>
          <SelectTrigger><SelectValue placeholder="Select feedback" /></SelectTrigger>
          <SelectContent className="z-[60]">
            <SelectItem value="Interested">Interested</SelectItem>
            <SelectItem value="Not Interested">Not Interested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Remarks (optional)</Label>
        <Textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Dealer</Button>
      </div>
    </form>
  );
}
