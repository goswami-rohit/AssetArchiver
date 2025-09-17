import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Camera, MapPin } from 'lucide-react';
import { useLocation } from "wouter";

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
import { useAppStore, DEALER_TYPES, BRANDS, FEEDBACKS, BASE_URL } from '@/components/ReusableUI';

// --- Type Definitions ---
type Step = 'checkin' | 'form' | 'checkout' | 'loading' | 'submitting';

// --- Zod Schema (Updated to match backend) ---
const DVReportSchema = z.object({
  userId: z.number().int().positive(),
  reportDate: z.string().min(1, "Report date is required"),
  dealerType: z.string().min(1, "Dealer type is required"),
  dealerName: z.string().optional().nullable(),
  subDealerName: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  visitType: z.string().min(1, "Visit type is required"),
  dealerTotalPotential: z.coerce.number().min(0, "Must be a non-negative number"),
  dealerBestPotential: z.coerce.number().min(0, "Must be a non-negative number"),
  brandSelling: z.string().array().min(1, "Select at least one brand"),
  contactPerson: z.string().optional().nullable(),
  contactPersonPhoneNo: z.string().optional().nullable(),
  todayOrderMt: z.coerce.number().min(0, "Cannot be negative"),
  todayCollectionRupees: z.coerce.number().min(0, "Cannot be negative"),
  overdueAmount: z.coerce.number().optional().nullable(),
  feedbacks: z.string().min(1, "Feedback is required"),
  solutionBySalesperson: z.string().optional().nullable(),
  anyRemarks: z.string().optional().nullable(),
});
type DVReportFormValues = z.infer<typeof DVReportSchema>;

// --- Helper: Convert Data URL to Blob ---
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
  const res = await fetch(dataurl);
  return await res.blob();
}

// --- New Helper: Upload Image to R2 ---
async function uploadImage(blob: Blob, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob, fileName);

  const response = await fetch(`${BASE_URL}/api/r2/upload-direct`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Image upload failed. Please check your connection and try again.");
  }
  const { publicUrl } = await response.json();
  if (!publicUrl) {
    throw new Error("Server did not return a valid image URL.");
  }
  return publicUrl;
}

// --- Component ---
export default function DVRForm() {
  const [, navigate] = useLocation();
  const { user } = useAppStore();

  const [step, setStep] = useState<Step>('checkin');
  const [checkInPhotoPreview, setCheckInPhotoPreview] = useState<string | null>(null);
  const [checkOutPhotoPreview, setCheckOutPhotoPreview] = useState<string | null>(null);
  const [checkInPhotoUrl, setCheckInPhotoUrl] = useState<string | null>(null);
  const [checkOutPhotoUrl, setCheckOutPhotoUrl] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [isBrandsDialogOpen, setIsBrandsDialogOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { control, handleSubmit, setValue, trigger, watch, formState: { errors } } = useForm<DVReportFormValues>({
    resolver: zodResolver(DVReportSchema),
    mode: 'onChange',
    defaultValues: {
      userId: user?.id ?? 0,
      reportDate: new Date().toISOString().slice(0, 10),
      dealerType: '', dealerName: '', location: '', visitType: '',
      dealerTotalPotential: 0, dealerBestPotential: 0, brandSelling: [],
      todayOrderMt: 0, todayCollectionRupees: 0, feedbacks: '',
      latitude: 0, longitude: 0,
    },
  });

  const brandSelling = watch('brandSelling');

  const handleOpenCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast.error("Camera Error", { description: "Could not start the camera." });
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    if (video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    setIsCameraOpen(false);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const blob = await dataURLtoBlob(dataUrl);

    setIsUploading(true);
    toast.info("Uploading photo, please wait...");

    try {
      if (step === 'checkin') {
        const fileName = `dvr-checkin-${user?.id}-${Date.now()}.jpg`;
        const publicUrl = await uploadImage(blob, fileName);
        setCheckInPhotoUrl(publicUrl);
        setCheckInPhotoPreview(dataUrl);
        setCheckInTime(new Date().toISOString());
        toast.success("Check-in photo uploaded!");
        setStep('form');
      } else if (step === 'checkout') {
        const fileName = `dvr-checkout-${user?.id}-${Date.now()}.jpg`;
        const publicUrl = await uploadImage(blob, fileName);
        setCheckOutPhotoUrl(publicUrl);
        setCheckOutPhotoPreview(dataUrl);
        toast.success("Check-out photo uploaded!");
      }
    } catch (error: any) {
      toast.error("Upload Failed", { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const useMyLocation = () => {
    setIsGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setValue('latitude', latitude, { shouldValidate: true });
        setValue('longitude', longitude, { shouldValidate: true });
        setValue('location', `Lat ${latitude.toFixed(5)}, Lon ${longitude.toFixed(5)}`, { shouldValidate: true });
        toast.success('Location Captured');
        setIsGeoLoading(false);
      },
      (error) => {
        toast.error("Location Error", { description: error.message });
        setIsGeoLoading(false);
      }
    );
  };

  const handleProceedToCheckout = async () => {
    const isValid = await trigger();
    if (isValid) setStep('checkout');
    else toast.error('Validation Error', { description: 'Please fill all required fields correctly.' });
  };

  const submit = async (data: DVReportFormValues) => {
    if (!checkInPhotoUrl || !checkOutPhotoUrl) {
      return toast.error('Photo Missing', { description: 'Check-in and Check-out photos are required.' });
    }
    setStep('submitting');

    try {
      // ✅ Build the payload that EXACTLY matches the new backend schema
      const finalPayload = {
        ...data,
        checkInTime: new Date(checkInTime!),
        checkOutTime: new Date(),
        inTimeImageUrl: checkInPhotoUrl,
        outTimeImageUrl: checkOutPhotoUrl,
      };

      console.log("Submitting Final DVR Payload:", JSON.stringify(finalPayload, null, 2));

      const response = await fetch(`${BASE_URL}/api/daily-visit-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        let errorDetails = "An unknown error occurred.";
        try {
          const result = await response.json();
          console.error("Server validation error:", result);
          if (result.details && Array.isArray(result.details) && result.details.length > 0) {
            const specificError = result.details[0];
            errorDetails = `${specificError.field}: ${specificError.message}`;
          } else if (result.error) {
            errorDetails = result.error;
          }
        } catch (e) {
          errorDetails = "Failed to parse server error response.";
        }
        throw new Error(`Submission Failed: ${errorDetails}`);
      }

      toast.success('DVR Submitted Successfully');
      setTimeout(() => navigate('/'), 1500);

    } catch (error: any) {
      toast.error(error.message || 'Submission Failed');
      setStep('checkout');
    }
  };

  const renderCheckInOrOut = (isCheckout: boolean) => {
    const photoPreview = isCheckout ? checkOutPhotoPreview : checkInPhotoPreview;
    const photoUrl = isCheckout ? checkOutPhotoUrl : checkInPhotoUrl;

    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <h1 className="text-2xl font-bold">{isCheckout ? 'Dealer Checkout' : 'Dealer Check-in'}</h1>
        <p className="text-muted-foreground mb-6">Take a selfie to {isCheckout ? 'complete' : 'start'} the visit.</p>
        <Avatar className="w-48 h-48 mb-6 border-2">
          <AvatarImage src={photoPreview || ''} alt="Selfie" />
          <AvatarFallback><Camera className="w-16 h-16 text-muted-foreground" /></AvatarFallback>
        </Avatar>
        <Button onClick={handleOpenCamera} className="w-full max-w-sm mb-4" disabled={isUploading}>
          {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {photoUrl ? 'Retake Photo' : 'Open Camera'}
        </Button>
        {isCheckout && photoUrl && (
          <Button onClick={handleSubmit(submit)} className="w-full max-w-sm" disabled={step === 'submitting'}>
            {step === 'submitting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Complete & Submit Report
          </Button>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (step) {
      case 'submitting':
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
      case 'checkin':
        return renderCheckInOrOut(false);
      case 'checkout':
        return renderCheckInOrOut(true);
      case 'form':
        return (
          <form onSubmit={(e) => { e.preventDefault(); handleProceedToCheckout(); }} className="space-y-6 pb-28">
            <div className="flex items-center gap-4 border-b pb-4">
              <Avatar className="w-20 h-20"><AvatarImage src={checkInPhotoPreview || ''} /></Avatar>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Visit Details</h2>
                <p className="text-sm text-muted-foreground">Fill in all the required information below.</p>
              </div>
            </div>
            {/* All form fields go here, no changes needed from your original code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller name="dealerType" control={control} render={({ field }) => (
                <div className="space-y-1"><Label>Dealer Type *</Label><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent>{DEALER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>{errors.dealerType && <p className="text-sm text-red-500 mt-1">{errors.dealerType.message}</p>}</div>
              )} />
              <Controller name="dealerName" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="dealerName">Dealer Name *</Label><Input id="dealerName" {...field} value={field.value || ''} />{errors.dealerName && <p className="text-sm text-red-500 mt-1">{errors.dealerName.message}</p>}</div>)} />
            </div>
            <Controller name="subDealerName" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="subDealerName">Sub Dealer Name</Label><Input id="subDealerName" {...field} value={field.value || ''} /></div>)} />
            <div className="space-y-1">
              <Label htmlFor="location">Location *</Label>
              <div className="flex gap-2">
                <Controller name="location" control={control} render={({ field }) => (<Input id="location" {...field} className="flex-1" />)} />
                <Button type="button" variant="outline" onClick={useMyLocation} disabled={isGeoLoading}>
                  {isGeoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                </Button>
              </div>
              {errors.location && <p className="text-sm text-red-500 mt-1">{errors.location.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Controller name="visitType" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="visitType">Visit Type *</Label><Input id="visitType" {...field} />{errors.visitType && <p className="text-sm text-red-500 mt-1">{errors.visitType.message}</p>}</div>)} />
              <Controller name="dealerTotalPotential" control={control} render={({ field }) => (<div className="space-y-1"><Label>Total Potential (MT)*</Label><Input {...field} type="number" onChange={e => field.onChange(e.target.valueAsNumber)} />{errors.dealerTotalPotential && <p className="text-sm text-red-500 mt-1">{errors.dealerTotalPotential.message}</p>}</div>)} />
              <Controller name="dealerBestPotential" control={control} render={({ field }) => (<div className="space-y-1"><Label>Best Potential (MT)*</Label><Input {...field} type="number" onChange={e => field.onChange(e.target.valueAsNumber)} />{errors.dealerBestPotential && <p className="text-sm text-red-500 mt-1">{errors.dealerBestPotential.message}</p>}</div>)} />
            </div>
            <div className="space-y-1">
              <Label>Brands Selling *</Label>
              <Button type="button" variant="outline" className="w-full justify-start font-normal" onClick={() => setIsBrandsDialogOpen(true)}>{brandSelling.length ? brandSelling.join(', ') : 'Select brands...'}</Button>
              {errors.brandSelling && <p className="text-sm text-red-500 mt-1">{errors.brandSelling.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller name="contactPerson" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="contactPerson">Contact Person</Label><Input id="contactPerson" {...field} value={field.value || ''} /></div>)} />
              <Controller name="contactPersonPhoneNo" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="contactPersonPhoneNo">Contact Phone</Label><Input id="contactPersonPhoneNo" type="tel" {...field} value={field.value || ''} /></div>)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Controller name="todayOrderMt" control={control} render={({ field }) => (<div className="space-y-1"><Label>Today's Order (MT)*</Label><Input {...field} type="number" onChange={e => field.onChange(e.target.valueAsNumber)} />{errors.todayOrderMt && <p className="text-sm text-red-500 mt-1">{errors.todayOrderMt.message}</p>}</div>)} />
              <Controller name="todayCollectionRupees" control={control} render={({ field }) => (<div className="space-y-1"><Label>Today's Collection (₹)*</Label><Input {...field} type="number" onChange={e => field.onChange(e.target.valueAsNumber)} />{errors.todayCollectionRupees && <p className="text-sm text-red-500 mt-1">{errors.todayCollectionRupees.message}</p>}</div>)} />
              <Controller name="overdueAmount" control={control} render={({ field }) => (<div className="space-y-1"><Label>Overdue Amount (₹)</Label><Input {...field} value={field.value ?? ''} type="number" onChange={e => field.onChange(e.target.valueAsNumber)} /></div>)} />
            </div>
            <Controller name="feedbacks" control={control} render={({ field }) => (<div className="space-y-1"><Label>Feedback *</Label><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select feedback..." /></SelectTrigger><SelectContent>{FEEDBACKS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>{errors.feedbacks && <p className="text-sm text-red-500 mt-1">{errors.feedbacks.message}</p>}</div>)} />
            <Controller name="solutionBySalesperson" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="solution">Solution by Salesperson</Label><Textarea id="solution" {...field} value={field.value || ''} /></div>)} />
            <Controller name="anyRemarks" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="remarks">Any Remarks</Label><Textarea id="remarks" {...field} value={field.value || ''} /></div>)} />
            <Button type="submit" className="w-full h-12">Continue to Checkout</Button>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-lg font-bold ml-2">Daily Visit Report</h1>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {renderContent()}
      </main>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Take Selfie</DialogTitle></DialogHeader>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md" />
          <canvas ref={canvasRef} className="hidden" />
          <DialogFooter>
            <Button onClick={handleCapture} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Capture Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBrandsDialogOpen} onOpenChange={setIsBrandsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Select Brands</DialogTitle></DialogHeader>
          <div className="space-y-2 py-4">
            {BRANDS.map(brand => (
              <div key={brand} className="flex items-center space-x-2">
                <Checkbox
                  id={brand}
                  checked={brandSelling.includes(brand)}
                  onCheckedChange={(checked) => {
                    const currentBrands = brandSelling;
                    const newBrands = checked ? [...currentBrands, brand] : currentBrands.filter(b => b !== brand);
                    setValue('brandSelling', newBrands, { shouldValidate: true });
                  }}
                />
                <Label htmlFor={brand} className="font-normal">{brand}</Label>
              </div>
            ))}
          </div>
          <DialogFooter><DialogClose asChild><Button>Done</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}