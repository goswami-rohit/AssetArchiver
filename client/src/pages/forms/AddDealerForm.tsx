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
import { DEALER_TYPES, REGIONS, AREAS, BRANDS } from "@/components/ReusableUI";

type DealerLite = { id: string; name: string };

// Multi-select component for brands
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
          type="button"
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
        className="w-[min(22rem,calc(100vw-2rem))] p-0 z-[60]"
        align="start"
        sideOffset={8}
      >
        <Command>
          <CommandInput placeholder="Search brand..." />
          <CommandList>
            <CommandEmpty>No brand found.</CommandEmpty>
            <CommandGroup>
              {BRANDS.map(b => {
                const active = value.includes(b);
                return (
                  <CommandItem
                    key={b}
                    onSelect={() => toggle(b)}
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
  onCancel,
}: {
  userId?: number;
  onCancel?: () => void;
}) {
  const [type, setType] = React.useState<string>("");
  const [parentDealerId, setParentDealerId] = React.useState<string>("");
  const [parentDealers, setParentDealers] = React.useState<DealerLite[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
  const [isSubDealer, setIsSubDealer] = React.useState(false);
  const [latitude, setLatitude] = React.useState("");
  const [longitude, setLongitude] = React.useState("");
  const [formattedAddress, setFormattedAddress] = React.useState("");

  // Fetch parent dealers from backend
  React.useEffect(() => {
    async function fetchDealers() {
      try {
        const res = await fetch(`/api/dealers/user/${userId}`);
        if (!res.ok) throw new Error("Failed to fetch dealers");
        const data = await res.json();
        setParentDealers(data.data || []); // Use data.data from your API response
      } catch (err) {
        console.error("Error loading dealers:", err);
      }
    }
    if (userId) {
      fetchDealers();
    }
  }, [userId]);

  // Forward geocoding: address -> coords
  async function forwardGeocode(address: string) {
    try {
      const res = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`,
        { headers: { Authorization: "prj_live_pk_4762150b92e059b7c1855256d8b9cd8b79cfde46" } }
      );
      const data = await res.json();
      if (data.addresses?.length) {
        const addr = data.addresses[0];
        setLatitude(String(addr.latitude));
        setLongitude(String(addr.longitude));
        setFormattedAddress(addr.formattedAddress);
        setRegion(addr.state || "");
        setArea(addr.city || addr.neighborhood || "");
      }
    } catch (err) {
      console.error("Forward geocode failed:", err);
    }
  }

  // Reverse geocoding: coords -> address
  async function reverseGeocode(lat: string, lon: string) {
    try {
      const res = await fetch(
        `https://api.radar.io/v1/geocode/reverse?coordinates=${lat},${lon}`,
        { headers: { Authorization: "prj_live_pk_4762150b92e059b7c1855256d8b9cd8b79cfde46" } }
      );
      const data = await res.json();
      if (data.addresses?.length) {
        const addr = data.addresses[0];
        setFormattedAddress(addr.formattedAddress);
        setRegion(addr.state || "");
        setArea(addr.city || addr.neighborhood || "");
      }
    } catch (err) {
      console.error("Reverse geocode failed:", err);
    }
  }
  const validate = (): string | null => {
    if (!type) return "Type is required.";
    if (isSubDealer && !parentDealerId) return "Select parent dealer.";
    if (!name) return "Name is required.";
    if (!region) return "Region is required.";
    if (!area) return "Area is required.";
    if (!phoneNo) return "Phone number is required.";
    if (!address && !formattedAddress) return "Address is required."; // ← FIX THIS LINE
    if (!totalPotential || Number.isNaN(Number(totalPotential))) return "Total potential must be a number.";
    if (!bestPotential || Number.isNaN(Number(bestPotential))) return "Best potential must be a number.";
    if (!brandSelling.length) return "Select at least one brand.";
    if (!feedbacks) return "Feedbacks is required.";
    if (!latitude || !longitude) return "Latitude and longitude are required for geofencing.";
    return null;
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      alert(err);
      return;
    }

    setIsSubmitting(true);

    try {
      // Build payload
      let payload: any = {
        userId: userId ?? null,
        type,
        parentDealerId: isSubDealer ? parentDealerId || null : null,
        name,
        region,
        area,
        phoneNo,
        address: formattedAddress || address,
        totalPotential,
        bestPotential,
        brandSelling,
        feedbacks,
        remarks: remarks || null,
        latitude: Number(latitude),
        longitude: Number(longitude),
      };

      // 🔥 Ensure we never send id/createdAt/updatedAt (remove if present)
      delete payload.id;
      delete payload.createdAt;
      delete payload.updatedAt;

      console.log("Sending payload:", payload);

      const response = await fetch("/api/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Backend response:", result);

      if (result.success) {
        alert(`✅ Dealer created successfully! 
Dealer ID: ${result.data.id}
Geofence ID: ${result.geofenceRef?.id}
Radius: ${result.geofenceRef?.radiusMeters}m`);

        // Reset form
        setType("");
        setParentDealerId("");
        setName("");
        setRegion("");
        setArea("");
        setPhoneNo("");
        setAddress("");
        setTotalPotential("");
        setBestPotential("");
        setBrandSelling([]);
        setFeedbacks("");
        setRemarks("");
        setLatitude("");
        setLongitude("");
        setFormattedAddress("");
        setIsSubDealer(false);

        onCancel?.();
      } else {
        alert(`❌ Error: ${result.error}`);
        if (result.details) {
          console.error("Validation details:", result.details);
        }
      }
    } catch (error: any) {
      alert(`❌ Failed to create dealer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Add Dealer / Sub-Dealer</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Dealer or Sub-Dealer toggle */}
      <div className="flex items-center gap-2">
        <input
          id="isSubDealer"
          type="checkbox"
          checked={isSubDealer}
          onChange={(e) => setIsSubDealer(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="isSubDealer">Is Sub-Dealer?</Label>
      </div>

      {/* Type */}
      <div className="grid gap-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent className="z-[60]">
            {DEALER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Parent Dealer */}
      {isSubDealer && (
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
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Area</Label>
          <Input
            placeholder="Type area / locality"
            value={area}
            onChange={e => setArea(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Address</Label>
        <Textarea
          rows={2}
          value={formattedAddress || address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Type dealer address"
          required
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => forwardGeocode(address)}
          >
            Geocode Address
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Latitude</Label>
          <Input value={latitude} readOnly />
        </div>
        <div className="grid gap-2">
          <Label>Longitude</Label>
          <Input value={longitude} readOnly />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const lat = String(pos.coords.latitude);
                  const lon = String(pos.coords.longitude);
                  setLatitude(lat);
                  setLongitude(lon);
                  // Automatically reverse geocode to get address
                  await reverseGeocode(lat, lon);
                },
                (err) => {
                  alert("Failed to get location: " + err.message);
                }
              );
            } else {
              alert("Geolocation not supported in this browser.");
            }
          }}
        >
          Use My Location
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => reverseGeocode(latitude, longitude)}
          disabled={!latitude || !longitude}
        >
          Reverse Geocode
        </Button>
      </div>

      <div className="grid gap-2">
        <Label>Phone No</Label>
        <Input inputMode="tel" value={phoneNo} onChange={e => setPhoneNo(e.target.value)} required />
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Save Dealer"}
        </Button>
      </div>
    </form>
  );
}