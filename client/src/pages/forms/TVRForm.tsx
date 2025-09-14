import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import { useNavigate } from 'react-router-dom'; // 👈 FIX: Removed this import
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, Camera } from 'lucide-react';

// --- UI Components ---
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
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL, BRANDS, INFLUENCERS, UNITS, QUALITY_COMPLAINT, PROMO_ACTIVITY, CHANNEL_PARTNER_VISIT } from '../../components/ReusableUI';

// --- Type Definitions ---
type Step = 'checkin' | 'form' | 'checkout' | 'loading' | 'submitting';

// --- Zod Schema ---
const TVReportSchema = z.object({
  userId: z.number().int().positive(),
  reportDate: z.date(),
  visitType: z.string().min(1, "Visit type is required"),
  siteNameConcernedPerson: z.string().min(1, "Site/Person name is required"),
  phoneNo: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit phone number"),
  emailId: z.string().email("Must be a valid email").optional().or(z.literal('')).nullable(),
  clientsRemarks: z.string().min(1, "Client remarks are required"),
  salespersonRemarks: z.string().min(1, "Your remarks are required"),
  siteVisitBrandInUse: z.string().array().min(1, "Select at least one brand"),
  siteVisitStage: z.string().optional().nullable(),
  conversionFromBrand: z.string().optional().nullable(),
  conversionQuantityValue: z.coerce.number().positive().optional().nullable(),
  conversionQuantityUnit: z.string().optional().nullable(),
  associatedPartyName: z.string().optional().nullable(),
  influencerType: z.string().array().min(1, "Select at least one influencer"),
  serviceType: z.string().optional().nullable(),
  qualityComplaint: z.string().optional().nullable(),
  promotionalActivity: z.string().optional().nullable(),
  channelPartnerVisit: z.string().optional().nullable(),
});
type TVReportFormValues = z.infer<typeof TVReportSchema>;

// --- Helper: Convert Data URL to Blob ---
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
  const res = await fetch(dataurl);
  return await res.blob();
}

// --- Component ---
export default function TVRForm() {
  // const navigate = useNavigate(); // 👈 FIX: Removed this line
  const { user } = useAppStore();

  const [step, setStep] = useState<Step>('loading');
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [modals, setModals] = useState({ brands: false, influencers: false });
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { control, handleSubmit, setValue, trigger, watch, formState: { errors } } = useForm<TVReportFormValues>({
    resolver: zodResolver(TVReportSchema),
    mode: 'onChange',
    defaultValues: {
      userId: user?.id,
      reportDate: new Date(),
      siteVisitBrandInUse: [],
      influencerType: [],
    },
  });

  const siteVisitBrandInUse = watch('siteVisitBrandInUse');
  const influencerType = watch('influencerType');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setStep('checkin'))
      .catch(() => {
        toast.error("Permission Denied", { description: "Camera access is required." });
        window.history.back(); // 👈 FIX: Changed to window.history.back()
      });
  }, []); // 👈 FIX: Removed navigate from dependency array

  const handleOpenCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Camera Error", { description: "Could not start the camera." });
      setIsCameraOpen(false);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const dataUrl = canvas.toDataURL('image/jpeg');

      if (step === 'checkin') {
        setCheckInPhoto(dataUrl);
        setCheckInTime(new Date().toISOString());
        setStep('form');
      } else if (step === 'checkout') {
        setCheckOutPhoto(dataUrl);
      }

      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
      setIsCameraOpen(false);
    }
  };

  const handleProceedToCheckout = async () => {
    const isValid = await trigger();
    if (isValid) setStep('checkout');
    else toast.error('Validation Error', { description: 'Please fill all required fields correctly.' });
  };

  const submit = async (data: TVReportFormValues) => {
    if (!checkInPhoto || !checkOutPhoto) {
      toast.error('Photo Missing', { description: 'Check-in and Check-out photos are required.' });
      setStep('checkout');
      return;
    }
    setStep('submitting');

    const payload = {
      ...data,
      reportDate: format(data.reportDate, 'yyyy-MM-dd'),
    };

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
      }
    });
    formData.append('checkInTime', checkInTime!);
    formData.append('checkOutTime', new Date().toISOString());
    formData.append('inTimeImage', await dataURLtoBlob(checkInPhoto), 'checkin.jpg');
    formData.append('outTimeImage', await dataURLtoBlob(checkOutPhoto), 'checkout.jpg');

    try {
      const response = await fetch(`${BASE_URL}/api/technical-visit-reports`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to submit report.' }));
        throw new Error(result.error);
      }
      toast.success('TVR Submitted Successfully');
      setTimeout(() => window.history.back(), 1500); // 👈 FIX: Changed to window.history.back()
    } catch (error: any) {
      toast.error('Submission Failed', { description: error.message });
      setStep('checkout');
    }
  };

  const renderCameraStep = (isCheckin: boolean) => (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <h1 className="text-2xl font-bold">{isCheckin ? 'Site Check-in' : 'Site Checkout'}</h1>
      <p className="text-muted-foreground mb-6">Take a selfie to {isCheckin ? 'begin' : 'complete'} the technical visit.</p>
      <Avatar className="w-48 h-48 mb-6 border-2">
        <AvatarImage src={(isCheckin ? checkInPhoto : checkOutPhoto) || ''} alt="Selfie" />
        <AvatarFallback><Camera className="w-16 h-16 text-muted-foreground" /></AvatarFallback>
      </Avatar>
      <Button onClick={handleOpenCamera} className="w-full max-w-sm mb-4">
        <Camera className="mr-2 h-4 w-4" /> Open Camera
      </Button>
      {!isCheckin && checkOutPhoto && (
        <Button onClick={() => handleSubmit(submit)()} className="w-full max-w-sm">
          Complete & Submit Report
        </Button>
      )}
    </div>
  );

  const renderFormStep = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleProceedToCheckout(); }} className="space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <Avatar className="w-20 h-20"><AvatarImage src={checkInPhoto || ''} /></Avatar>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Technical Visit Details</h2>
          <p className="text-sm text-muted-foreground">Fill in all the required information.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller name="visitType" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="visitType">Visit Type *</Label><Input id="visitType" {...field} />{errors.visitType && <p className="text-sm text-red-500 mt-1">{errors.visitType.message}</p>}</div>)} />
        <Controller name="siteNameConcernedPerson" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="siteNameConcernedPerson">Site/Person Name *</Label><Input id="siteNameConcernedPerson" {...field} />{errors.siteNameConcernedPerson && <p className="text-sm text-red-500 mt-1">{errors.siteNameConcernedPerson.message}</p>}</div>)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller name="phoneNo" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="phoneNo">Phone No *</Label><Input id="phoneNo" type="tel" {...field} />{errors.phoneNo && <p className="text-sm text-red-500 mt-1">{errors.phoneNo.message}</p>}</div>)} />
        <Controller name="emailId" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="emailId">Email ID</Label><Input id="emailId" type="email" {...field} value={field.value || ''} />{errors.emailId && <p className="text-sm text-red-500 mt-1">{errors.emailId.message}</p>}</div>)} />
      </div>

      <Controller name="clientsRemarks" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="clientsRemarks">Client's Remarks *</Label><Textarea id="clientsRemarks" {...field} />{errors.clientsRemarks && <p className="text-sm text-red-500 mt-1">{errors.clientsRemarks.message}</p>}</div>)} />
      <Controller name="salespersonRemarks" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="salespersonRemarks">Salesperson Remarks *</Label><Textarea id="salespersonRemarks" {...field} />{errors.salespersonRemarks && <p className="text-sm text-red-500 mt-1">{errors.salespersonRemarks.message}</p>}</div>)} />

      <div className="space-y-1">
        <Label>Site Visit - Brand in Use *</Label>
        <Button type="button" variant="outline" className="w-full justify-start font-normal" onClick={() => setModals({ ...modals, brands: true })}>{siteVisitBrandInUse?.length ? siteVisitBrandInUse.join(', ') : 'Select brands...'}</Button>
        {errors.siteVisitBrandInUse && <p className="text-sm text-red-500 mt-1">{errors.siteVisitBrandInUse.message}</p>}
      </div>

      <Controller name="siteVisitStage" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="siteVisitStage">Site Visit Stage</Label><Input id="siteVisitStage" {...field} value={field.value || ''} /></div>)} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Controller control={control} name="conversionFromBrand" render={({ field }) => (<div className="space-y-1"><Label>From Brand</Label><Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger><SelectContent>{BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>)} />
        <Controller name="conversionQuantityValue" control={control} render={({ field }) => (<div className="space-y-1"><Label>Qty</Label><Input {...field} type="number" value={field.value ?? ''} onChange={e => field.onChange(e.target.valueAsNumber)} />{errors.conversionQuantityValue && <p className="text-sm text-red-500 mt-1">{errors.conversionQuantityValue.message}</p>}</div>)} />
        <Controller control={control} name="conversionQuantityUnit" render={({ field }) => (<div className="space-y-1"><Label>Unit</Label><Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>)} />
      </div>

      <Controller name="associatedPartyName" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="associatedPartyName">Associated Party Name</Label><Input id="associatedPartyName" {...field} value={field.value || ''} /></div>)} />

      <div className="space-y-1">
        <Label>Influencer Type *</Label>
        <Button type="button" variant="outline" className="w-full justify-start font-normal" onClick={() => setModals({ ...modals, influencers: true })}>{influencerType?.length ? influencerType.join(', ') : 'Select influencers...'}</Button>
        {errors.influencerType && <p className="text-sm text-red-500 mt-1">{errors.influencerType.message}</p>}
      </div>

      <Controller name="serviceType" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="serviceType">Service Type</Label><Input id="serviceType" {...field} value={field.value || ''} /></div>)} />
      <Controller control={control} name="qualityComplaint" render={({ field }) => (<div className="space-y-1"><Label>Quality Complaint</Label><Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{QUALITY_COMPLAINT.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)} />
      <Controller control={control} name="promotionalActivity" render={({ field }) => (<div className="space-y-1"><Label>Promotional Activity</Label><Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{PROMO_ACTIVITY.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)} />
      <Controller control={control} name="channelPartnerVisit" render={({ field }) => (<div className="space-y-1"><Label>Channel Partner Visit</Label><Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{CHANNEL_PARTNER_VISIT.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)} />

      <Button type="submit" className="w-full h-12">Continue to Checkout</Button>
    </form>
  );

  const renderContent = () => {
    switch (step) {
      case 'checkin': return renderCameraStep(true);
      case 'form': return renderFormStep();
      case 'checkout': return renderCameraStep(false);
      case 'loading':
      case 'submitting':
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button> {/* 👈 FIX: Changed to window.history.back() */}
          <h1 className="text-lg font-bold ml-2">Technical Visit Report</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {renderContent()}
      </main>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent><DialogHeader><DialogTitle>Take Selfie</DialogTitle></DialogHeader><video ref={videoRef} autoPlay playsInline className="w-full rounded-md" /><canvas ref={canvasRef} className="hidden" /><DialogFooter><Button onClick={handleCapture}>Capture Photo</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={modals.brands} onOpenChange={(open) => setModals(m => ({ ...m, brands: open }))}>
        <DialogContent><DialogHeader><DialogTitle>Select Brands in Use</DialogTitle></DialogHeader><div className="space-y-2 py-4">{BRANDS.map(brand => (<div key={brand} className="flex items-center space-x-2"><Checkbox id={brand} checked={siteVisitBrandInUse?.includes(brand)} onCheckedChange={(checked) => { const newBrands = checked ? [...(siteVisitBrandInUse || []), brand] : (siteVisitBrandInUse || []).filter(b => b !== brand); setValue('siteVisitBrandInUse', newBrands, { shouldValidate: true }); }} /><Label htmlFor={brand} className="font-normal">{brand}</Label></div>))}</div ><DialogFooter><DialogClose asChild><Button>Done</Button></DialogClose></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={modals.influencers} onOpenChange={(open) => setModals(m => ({ ...m, influencers: open }))}>
        <DialogContent><DialogHeader><DialogTitle>Select Influencer Type</DialogTitle></DialogHeader><div className="space-y-2 py-4">{INFLUENCERS.map(inf => (<div key={inf} className="flex items-center space-x-2"><Checkbox id={inf} checked={influencerType?.includes(inf)} onCheckedChange={(checked) => { const newInfluencers = checked ? [...(influencerType || []), inf] : (influencerType || []).filter(i => i !== inf); setValue('influencerType', newInfluencers, { shouldValidate: true }); }} /><Label htmlFor={inf} className="font-normal">{inf}</Label></div>))}</div><DialogFooter><DialogClose asChild><Button>Done</Button></DialogClose></DialogFooter></DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}