import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Camera, X, RefreshCw } from "lucide-react";

import { UNITS, BRANDS } from "@/components/ReusableUI";

const INFLUENCERS = [
  "Contractor",
  "Engineer",
  "Architect",
  "Mason",
  "Builder",
  "Petty Contractor",
];

const QUALITY_COMPLAINT = [
  "Slow Setting",
  "Low weight",
  "Colour issues",
  "Cracks",
  "Miscellaneous",
];

const PROMO_ACTIVITY = [
  "Mason Meet",
  "Table meet / Counter meet",
  "Mega mason meet",
  "Engineer meet",
  "Consumer Camp",
  "Miscellaneous",
];

const CHANNEL_PARTNER_VISIT = [
  "Dealer Visit",
  "Sub dealer",
  "Authorized retailers",
  "Other Brand counters",
];

type TVRFormValues = {
  siteVisitBrandInUse: string[];
  influencerType: string[];
};



// ————————————————————————————————————————————
// Small Multi-Select (shadcn Command based)
// ————————————————————————————————————————————
// TVR form multiselect for 2 fields
function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (item: string) => {
    const next = value.includes(item)
      ? value.filter(v => v !== item)
      : [...value, item];
    onChange(next);
  };

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"                 // ← don't submit the form
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
        className="w-[min(22rem,calc(100vw-2rem))] p-0 z-[60]" // ← keep above dialog
        align="start"
        sideOffset={8}
      >
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map(opt => {
                const active = value.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    onSelect={() => toggle(opt)} // keep popover open for multi-pick
                    className="cursor-pointer"
                  >
                    <Check className={`mr-2 h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                    {opt}
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

// ————————————————————————————————————————————
// Camera helper
// ————————————————————————————————————————————
function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const start = async (videoEl: HTMLVideoElement) => {
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    videoEl.srcObject = streamRef.current;
    await videoEl.play();
  };
  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  const capture = (videoEl: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(videoEl, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  };
  return { start, stop, capture };
}

// ————————————————————————————————————————————
// Component
// ————————————————————————————————————————————
type Step = "checkin" | "form" | "checkout";

export default function TVRForm({
  userId,
  onSubmitted,
  onCancel,
}: {
  userId?: number;
  onSubmitted?: (payload: any) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<Step>("checkin");

  // camera
  const { start, stop, capture } = useCamera();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [inPhoto, setInPhoto] = useState<string | null>(null);
  const [outPhoto, setOutPhoto] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // primary fields (all required for your spec)
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [visitType, setVisitType] = useState("");
  const [siteNameConcernedPerson, setSiteNameConcernedPerson] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [emailId, setEmailId] = useState(""); // optional in schema, but we’ll accept empty
  const [clientsRemarks, setClientsRemarks] = useState("");
  const [salespersonRemarks, setSalespersonRemarks] = useState("");

  // extended fields
  const [siteVisitStage, setSiteVisitStage] = useState("");
  const [conversionFromBrand, setConversionFromBrand] = useState("");
  const [conversionQuantityValue, setConversionQuantityValue] = useState<string>("");
  const [conversionQuantityUnit, setConversionQuantityUnit] = useState<string>("");
  const [associatedPartyName, setAssociatedPartyName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [qualityComplaint, setQualityComplaint] = useState("");
  const [promotionalActivity, setPromotionalActivity] = useState("");
  const [channelPartnerVisit, setChannelPartnerVisit] = useState("");

  //multiselect helper
  const form = useForm<TVRFormValues>({
    defaultValues: {
      siteVisitBrandInUse: [],
      influencerType: [],
    },
  });
  const { setValue, watch } = form;
  const siteVisitBrandInUse = watch("siteVisitBrandInUse");
  const influencerType = watch("influencerType");

  // start/stop camera when needed
  useEffect(() => {
    if ((step === "checkin" || step === "checkout") && videoRef.current) {
      start(videoRef.current).catch(err => console.error("camera error:", err));
      return () => stop();
    }
  }, [step, start, stop]);

  const doCapture = () => {
    if (!videoRef.current) return;
    const dataUrl = capture(videoRef.current);
    if (step === "checkin") {
      setInPhoto(dataUrl);
      setCheckInTime(new Date().toISOString());
      stop();
      setStep("form");
    } else {
      setOutPhoto(dataUrl);
      setCheckOutTime(new Date().toISOString());
      stop();
      handleSubmit(); // final submit
    }
  };

  const validate = (): string | null => {
    const requiredStrings = [
      reportDate, visitType, siteNameConcernedPerson, phoneNo,
      clientsRemarks, salespersonRemarks, siteVisitStage,
      conversionFromBrand, conversionQuantityValue, conversionQuantityUnit,
      associatedPartyName, serviceType, qualityComplaint, promotionalActivity,
      channelPartnerVisit,
    ];
    if (requiredStrings.some(v => !v)) return "Please fill all required fields.";
    if (!siteVisitBrandInUse.length) return "Select at least one 'Brand in use'.";
    if (!influencerType.length) return "Select at least one influencer type.";
    if (!inPhoto) return "Please take the check-in photo first.";
    return null;
  };

  const uploadImage = async (dataUrl: string, prefix: string) => {
    // turn base64 into blob
    const blob = await (await fetch(dataUrl)).blob();

    // ask backend for presigned URL
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: `${prefix}-${Date.now()}.jpg`,
        fileType: "image/jpeg",
      }),
    });
    const { uploadUrl, publicUrl } = await res.json();

    // upload directly to R2
    await fetch(uploadUrl, { method: "PUT", body: blob });

    return publicUrl;
  };

  const payload = useMemo(() => {
    const num = (v: string) => Number(v);
    return {
      userId: userId ?? null,
      reportDate,
      visitType,
      siteNameConcernedPerson,
      phoneNo,
      emailId: emailId || null,
      clientsRemarks,
      salespersonRemarks,
      checkInTime,
      checkOutTime,
      inTimeImageUrl: null,   // will be filled after upload
      outTimeImageUrl: null,  // will be filled after upload
      siteVisitBrandInUse,    // required array
      siteVisitStage,
      conversionFromBrand,
      conversionQuantityValue: num(conversionQuantityValue),
      conversionQuantityUnit,
      associatedPartyName,
      influencerType,         // required array
      serviceType,
      qualityComplaint,
      promotionalActivity,
      channelPartnerVisit,
    };
  }, [
    userId, reportDate, visitType, siteNameConcernedPerson, phoneNo, emailId,
    clientsRemarks, salespersonRemarks, checkInTime, checkOutTime,
    siteVisitBrandInUse, siteVisitStage, conversionFromBrand,
    conversionQuantityValue, conversionQuantityUnit, associatedPartyName,
    influencerType, serviceType, qualityComplaint, promotionalActivity,
    channelPartnerVisit
  ]);

  const handleSubmit = async () => {
    const err = validate();
    if (err) { alert(err); return; }
    try {
      setSubmitting(true);

      // upload photos to R2
      const inUrl = inPhoto ? await uploadImage(inPhoto, "checkin") : null;
      const outUrl = outPhoto ? await uploadImage(outPhoto, "checkout") : null;

      // final payload with R2 URLs
      onSubmitted?.({
        ...payload,
        inTimeImageUrl: inUrl,
        outTimeImageUrl: outUrl,
      });
    } finally {
      setSubmitting(false);
    }
  };


  // ————————————————————————————————————————————
  // UI
  // ————————————————————————————————————————————
  if (step === "checkin") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Check in photo</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
        </div>
        <div className="rounded-xl overflow-hidden bg-black/50">
          <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
        </div>
        <Button onClick={doCapture} className="w-full">
          <Camera className="h-4 w-4 mr-2" />
          Capture & Continue
        </Button>
        <p className="text-xs text-muted-foreground">You’ll take a checkout photo after submitting the form.</p>
      </div>
    );
  }

  if (step === "checkout") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Check out photo</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
        </div>
        <div className="rounded-xl overflow-hidden bg-black/50">
          <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
        </div>
        <Button onClick={doCapture} className="w-full" disabled={submitting}>
          {submitting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
          Capture & Submit
        </Button>
      </div>
    );
  }

  // step === "form"
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setStep("checkout");
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Technical Visit Report</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      {/* Primary rows */}
      <div className="grid grid-cols-1 gap-4">
        <div className="grid gap-2">
          <Label>Report Date</Label>
          <Input type="date" required value={reportDate} onChange={e => setReportDate(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label>Visit Type</Label>
          <Input required value={visitType} onChange={e => setVisitType(e.target.value)} placeholder="e.g., Technical Support / Quality Check" />
        </div>

        <div className="grid gap-2">
          <Label>Site Name / Concerned Person</Label>
          <Input required value={siteNameConcernedPerson} onChange={e => setSiteNameConcernedPerson(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label>Phone No</Label>
          <Input required inputMode="tel" value={phoneNo} onChange={e => setPhoneNo(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label>Email ID (optional)</Label>
          <Input type="email" value={emailId} onChange={e => setEmailId(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label>Client's Remarks</Label>
          <Textarea required rows={3} value={clientsRemarks} onChange={e => setClientsRemarks(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label>Salesperson Remarks</Label>
          <Textarea required rows={3} value={salespersonRemarks} onChange={e => setSalespersonRemarks(e.target.value)} />
        </div>

        {/* Brands in use (multi) */}
        <div className="grid gap-2">
          <Label>Site Visit - Brand in Use</Label>
          <MultiSelect
            value={siteVisitBrandInUse || []}
            onChange={(next) =>
              setValue("siteVisitBrandInUse", next, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            options={BRANDS}
            placeholder="Select brands"
          />
        </div>

        <div className="grid gap-2">
          <Label>Site Visit - Stage</Label>
          <Input required value={siteVisitStage} onChange={e => setSiteVisitStage(e.target.value)} placeholder="e.g., Foundation / Slab / Finishing" />
        </div>

        {/* Conversion */}
        <div className="grid gap-2">
          <Label>Conversion From Brand</Label>
          <Select value={conversionFromBrand} onValueChange={setConversionFromBrand}>
            <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
            <SelectContent>
              {BRANDS.map(b => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-2">
            <Label>Conversion Quantity (Value)</Label>
            <Input required inputMode="decimal" value={conversionQuantityValue} onChange={e => setConversionQuantityValue(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Unit</Label>
            <Select value={conversionQuantityUnit} onValueChange={setConversionQuantityUnit}>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {UNITS.map(u => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Associated Party Name</Label>
          <Input required value={associatedPartyName} onChange={e => setAssociatedPartyName(e.target.value)} />
        </div>

        {/* Influencer type (multi) */}
        <div className="grid gap-2">
          <Label>Influencer Type</Label>
          <MultiSelect
            value={influencerType || []}
            onChange={(next) =>
              setValue("influencerType", next, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            options={INFLUENCERS}
            placeholder="Select influencers"
          />
        </div>

        <div className="grid gap-2">
          <Label>Service Type</Label>
          <Input required value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="e.g., Technical demo / Complaint handling" />
        </div>

        {/* Singles: complaint / promo / partner visit */}
        <div className="grid gap-2">
          <Label>Quality Complaint</Label>
          <Select value={qualityComplaint} onValueChange={setQualityComplaint}>
            <SelectTrigger><SelectValue placeholder="Select complaint" /></SelectTrigger>
            <SelectContent>
              {QUALITY_COMPLAINT.map(v => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Promotional Activity</Label>
          <Select value={promotionalActivity} onValueChange={setPromotionalActivity}>
            <SelectTrigger><SelectValue placeholder="Select activity" /></SelectTrigger>
            <SelectContent>
              {PROMO_ACTIVITY.map(v => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Channel Partner Visit</Label>
          <Select value={channelPartnerVisit} onValueChange={setChannelPartnerVisit}>
            <SelectTrigger><SelectValue placeholder="Select partner type" /></SelectTrigger>
            <SelectContent>
              {CHANNEL_PARTNER_VISIT.map(v => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          Check-in time: {checkInTime ? new Date(checkInTime).toLocaleString() : "pending"}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Continue to checkout photo</Button>
        </div>
      </div>
    </form>
  );
}
