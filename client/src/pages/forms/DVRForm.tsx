import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Crosshair, Camera, X, RefreshCw } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils"; // if you have it; otherwise replace cn(...) with template strings

type DVRFormProps = {
    userId?: number;                 // optional; pass from parent if you want
    onSubmitted?: (payload: any) => void;
    onCancel?: () => void;
};

const DEALER_TYPES = [
    "Dealer-Best",
    "Sub Dealer-Best",
    "Dealer-Non Best",
    "Sub Dealer-Non Best",
] as const;

const BRANDS = ["Star", "Amrit", "Dalmia", "Topcem", "Black Tiger", "Surya Gold", "Max", "Taj", "Specify in remarks"];

const FEEDBACKS = ["Interested", "Not Interested"] as const;

type Step = "checkin" | "form" | "checkout";

function useCamera() {
    const streamRef = useRef<MediaStream | null>(null);

    const start = async (videoEl: HTMLVideoElement) => {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
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

// DVR form multiselect 
export function BrandsMultiSelect({
    value,
    onChange,
    placeholder = "Select brands",
}: {
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = React.useState(false);

    const toggle = (brand: string) => {
        if (value.includes(brand)) onChange(value.filter((b) => b !== brand));
        else onChange([...value, brand]);
    };

    return (
        <Popover modal={false} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"               // ← don’t submit the form
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
                className="w-[min(22rem,calc(100vw-2rem))] p-0 z-[60]"  // ← stay above dialog
                align="start"
                sideOffset={8}
            >
                <Command>
                    <CommandInput placeholder="Search brand..." />
                    <CommandList>
                        <CommandEmpty>No brand found.</CommandEmpty>
                        <CommandGroup>
                            {BRANDS.map(brand => {
                                const active = value.includes(brand);
                                return (
                                    <CommandItem
                                        key={brand}
                                        onSelect={() => toggle(brand)} // keep open for multi-pick
                                        className="cursor-pointer"
                                    >
                                        <Check className={`mr-2 h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                                        {brand}
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

export default function DVRForm({ userId, onSubmitted, onCancel }: DVRFormProps) {
    const [step, setStep] = useState<Step>("checkin");

    // images
    const [inPhoto, setInPhoto] = useState<string | null>(null);
    const [outPhoto, setOutPhoto] = useState<string | null>(null);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [checkOutTime, setCheckOutTime] = useState<string | null>(null);

    // core fields
    const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [dealerType, setDealerType] = useState<string>("");
    const [dealerName, setDealerName] = useState("");
    const [subDealerName, setSubDealerName] = useState("");
    const [location, setLocation] = useState("");
    const [latitude, setLatitude] = useState<string>("");
    const [longitude, setLongitude] = useState<string>("");
    const [visitType, setVisitType] = useState<string>("");
    const [dealerTotalPotential, setDealerTotalPotential] = useState<string>("");
    const [dealerBestPotential, setDealerBestPotential] = useState<string>("");
    const [brandSelling, setBrandSelling] = useState<string[]>([]);
    const [contactPerson, setContactPerson] = useState("");
    const [contactPersonPhoneNo, setContactPersonPhoneNo] = useState("");
    const [todayOrderMt, setTodayOrderMt] = useState<string>("");
    const [todayCollectionRupees, setTodayCollectionRupees] = useState<string>("");
    const [overdueAmount, setOverdueAmount] = useState<string>("");
    const [feedbacks, setFeedbacks] = useState<string>("");
    const [solutionBySalesperson, setSolutionBySalesperson] = useState("");
    const [anyRemarks, setAnyRemarks] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [geoBusy, setGeoBusy] = useState(false);

    // camera refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const { start, stop, capture } = useCamera();

    // Start camera for check-in / checkout steps
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
            // final submit after checkout
            handleSubmit();
        }
    };

    const useMyLocation = async () => {
        try {
            setGeoBusy(true);
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
            );
            setLatitude(String(pos.coords.latitude));
            setLongitude(String(pos.coords.longitude));
            if (!location) setLocation(`Lat ${pos.coords.latitude.toFixed(5)}, Lng ${pos.coords.longitude.toFixed(5)}`);
        } catch (e) {
            console.error("geolocation error", e);
            alert("Unable to get your location. Check permissions.");
        } finally {
            setGeoBusy(false);
        }
    };

    const validate = (): string | null => {
        // every field mandatory; yes, it’s strict
        const required = [
            reportDate, dealerType, location, latitude, longitude, visitType,
            dealerTotalPotential, dealerBestPotential, todayOrderMt,
            todayCollectionRupees, feedbacks, inPhoto,
        ];
        if (required.some(v => v === "" || v == null)) return "Please fill all required fields and take the check-in photo.";
        if (!brandSelling.length) return "Select at least one brand.";
        return null;
    };

    const payload = useMemo(() => {
        const num = (v: string) => Number(v);
        return {
            // DB fields
            userId: userId ?? null, // provide upstream
            reportDate,
            dealerType,
            dealerName: dealerName || null,
            subDealerName: subDealerName || null,
            location,
            latitude: num(latitude),
            longitude: num(longitude),
            visitType,
            dealerTotalPotential: num(dealerTotalPotential),
            dealerBestPotential: num(dealerBestPotential),
            brandSelling, // string[]
            contactPerson: contactPerson || null,
            contactPersonPhoneNo: contactPersonPhoneNo || null,
            todayOrderMt: num(todayOrderMt),
            todayCollectionRupees: num(todayCollectionRupees),
            overdueAmount: overdueAmount ? Number(overdueAmount) : null,
            feedbacks,
            solutionBySalesperson: solutionBySalesperson || null,
            anyRemarks: anyRemarks || null,
            checkInTime: checkInTime,     // ISO strings
            checkOutTime: checkOutTime,   // ISO strings
            inTimeImageUrl: null,         // placeholder; see note below
            outTimeImageUrl: null,        // placeholder; see note below
            // client-side only (not in DB)
            _checkInPhotoDataUrl: inPhoto,
            _checkOutPhotoDataUrl: outPhoto,
        };
    }, [
        userId, reportDate, dealerType, dealerName, subDealerName, location,
        latitude, longitude, visitType, dealerTotalPotential, dealerBestPotential,
        brandSelling, contactPerson, contactPersonPhoneNo, todayOrderMt,
        todayCollectionRupees, overdueAmount, feedbacks, solutionBySalesperson,
        anyRemarks, checkInTime, checkOutTime, inPhoto, outPhoto
    ]);

    const handleSubmit = async () => {
        const err = validate();
        if (err) {
            alert(err);
            // if we’re on checkout step and something is missing, don’t close camera
            if (step === "checkout") stop();
            return;
        }
        try {
            setSubmitting(true);

            // NOTE: image storage not implemented yet.
            // Here you would upload `inPhoto` and `outPhoto` to your storage database/service,
            // receive URLs, then set payload.inTimeImageUrl/outTimeImageUrl accordingly
            // before calling the backend.

            onSubmitted?.(payload);
        } finally {
            setSubmitting(false);
        }
    };

    if (step === "checkin") {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">Check in photo</h3>
                    <Button variant="ghost" size="icon" onClick={onCancel}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/50">
                    <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
                </div>
                <Button onClick={doCapture} className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture & Continue
                </Button>
                <p className="text-xs text-muted-foreground">
                    We’ll ask for a checkout photo after you submit the form.
                </p>
            </div>
        );
    }

    if (step === "checkout") {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">Check out photo</h3>
                    <Button variant="ghost" size="icon" onClick={onCancel}>
                        <X className="h-4 w-4" />
                    </Button>
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

    // step === 'form'
    return (
        <form
            className="space-y-4"
            onSubmit={(e) => {
                e.preventDefault();
                // go to checkout camera; final submit happens after checkout capture
                setStep("checkout");
            }}
        >
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Daily Visit Report</h3>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Report date */}
                <div className="grid gap-2">
                    <Label>Report Date</Label>
                    <Input type="date" required value={reportDate} onChange={e => setReportDate(e.target.value)} />
                </div>

                {/* Dealer type */}
                <div className="grid gap-2">
                    <Label>Dealer Type</Label>
                    <Select value={dealerType} onValueChange={setDealerType}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent className="z-[60]">
                            {DEALER_TYPES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Dealer names */}
                <div className="grid gap-2">
                    <Label>Dealer Name</Label>
                    <Input required value={dealerName} onChange={e => setDealerName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label>Sub Dealer Name</Label>
                    <Input required value={subDealerName} onChange={e => setSubDealerName(e.target.value)} />
                </div>

                {/* Location + lat/long */}
                <div className="grid gap-2">
                    <Label>Location</Label>
                    <div className="flex gap-2">
                        <Input className="flex-1" required value={location} onChange={e => setLocation(e.target.value)} />
                        <Button type="button" onClick={useMyLocation} disabled={geoBusy} variant="secondary">
                            {geoBusy ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Crosshair className="h-4 w-4 mr-1" />}
                            Use my location
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                        <Label>Latitude</Label>
                        <Input required inputMode="decimal" value={latitude} onChange={e => setLatitude(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Longitude</Label>
                        <Input required inputMode="decimal" value={longitude} onChange={e => setLongitude(e.target.value)} />
                    </div>
                </div>

                {/* Visit type */}
                <div className="grid gap-2">
                    <Label>Visit Type</Label>
                    <Input required value={visitType} onChange={e => setVisitType(e.target.value)} placeholder="Best / Non Best / etc." />
                </div>

                {/* Potentials */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                        <Label>Dealer Total Potential (MT)</Label>
                        <Input required inputMode="decimal" value={dealerTotalPotential} onChange={e => setDealerTotalPotential(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Dealer Best Potential (MT)</Label>
                        <Input required inputMode="decimal" value={dealerBestPotential} onChange={e => setDealerBestPotential(e.target.value)} />
                    </div>
                </div>

                {/* Brands multiselect */}
                <div className="grid gap-2">
                    <Label>Brands Selling</Label>
                    <BrandsMultiSelect value={brandSelling} onChange={setBrandSelling} />
                </div>

                {/* Contact */}
                <div className="grid gap-2">
                    <Label>Contact Person</Label>
                    <Input required value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label>Contact Person Phone No</Label>
                    <Input required inputMode="tel" value={contactPersonPhoneNo} onChange={e => setContactPersonPhoneNo(e.target.value)} />
                </div>

                {/* Orders/Collection */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                        <Label>Today Order (MT)</Label>
                        <Input required inputMode="decimal" value={todayOrderMt} onChange={e => setTodayOrderMt(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Today Collection (₹)</Label>
                        <Input required inputMode="decimal" value={todayCollectionRupees} onChange={e => setTodayCollectionRupees(e.target.value)} />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label>Overdue Amount (₹)</Label>
                    <Input required inputMode="decimal" value={overdueAmount} onChange={e => setOverdueAmount(e.target.value)} />
                </div>

                {/* Feedbacks */}
                <div className="grid gap-2">
                    <Label>Feedbacks</Label>
                    <Select value={feedbacks} onValueChange={setFeedbacks}>
                        <SelectTrigger><SelectValue placeholder="Select feedback" /></SelectTrigger>
                        <SelectContent className="z-[60]">
                            {FEEDBACKS.map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Solutions / Remarks */}
                <div className="grid gap-2">
                    <Label>Solution By Salesperson</Label>
                    <Textarea required value={solutionBySalesperson} onChange={e => setSolutionBySalesperson(e.target.value)} rows={3} />
                </div>
                <div className="grid gap-2">
                    <Label>Remarks</Label>
                    <Textarea required value={anyRemarks} onChange={e => setAnyRemarks(e.target.value)} rows={3} />
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
