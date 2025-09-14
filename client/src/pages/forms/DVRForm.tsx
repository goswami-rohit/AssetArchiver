import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import { useNavigate } from 'react-router-dom'; // 👈 FIX: Removed this import
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Camera, MapPin } from 'lucide-react';

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
import { Card, CardContent } from "@/components/ui/card";

// --- Custom Hooks & Constants ---
import { useAppStore, DEALER_TYPES, BRANDS, FEEDBACKS, BASE_URL } from '@/components/ReusableUI';

// --- Type Definitions ---
type Step = 'checkin' | 'form' | 'checkout' | 'loading' | 'submitting';

// --- Zod Schema ---
const DVReportSchema = z.object({
  userId: z.number().int().positive(),
  reportDate: z.string().min(1, "Report date is required"),
  dealerType: z.string().min(1, "Dealer type is required"),
  dealerName: z.string().min(1, "Dealer name is required"),
  subDealerName: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  visitType: z.string().min(1, "Visit type is required"),
  dealerTotalPotential: z.coerce.number().positive("Must be a positive number"),
  dealerBestPotential: z.coerce.number().positive("Must be a positive number"),
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

// --- Component ---
export default function DVRForm() {
  // const navigate = useNavigate(); // 👈 FIX: Removed this line
  const { user } = useAppStore();

  const [step, setStep] = useState<Step>('loading');
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [isBrandsDialogOpen, setIsBrandsDialogOpen] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { control, handleSubmit, setValue, trigger, watch, formState: { errors } } = useForm<DVReportFormValues>({
    resolver: zodResolver(DVReportSchema),
    mode: 'onChange',
    defaultValues: {
      userId: user?.id,
      reportDate: new Date().toISOString().slice(0, 10),
      dealerTotalPotential: undefined,
      dealerBestPotential: undefined,
      todayOrderMt: 0,
      todayCollectionRupees: 0,
      overdueAmount: undefined,
      brandSelling: [],
    },
  });

  const brandSelling = watch('brandSelling');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setStep('checkin'))
      .catch(() => {
        toast.error("Permission Denied", { description: "Camera access is required to proceed." });
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

      // Stop camera stream
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
      setIsCameraOpen(false);
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
    if (!checkInPhoto || !checkOutPhoto) {
      toast.error('Photo Missing', { description: 'Check-in and Check-out photos are required.' });
      return;
    }
    setStep('submitting');

    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
        }
      });
      formData.append('checkInTime', checkInTime!);
      formData.append('checkOutTime', new Date().toISOString());
      formData.append('inTimeImage', await dataURLtoBlob(checkInPhoto), 'checkin.jpg');
      formData.append('outTimeImage', await dataURLtoBlob(checkOutPhoto), 'checkout.jpg');

      const response = await fetch(`${BASE_URL}/api/daily-visit-reports`, {
        method: 'POST',
        body: formData, // Headers are set automatically for FormData
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: "An unknown error occurred" }));
        throw new Error(result.error || 'Failed to submit report.');
      }

      toast.success('DVR Submitted Successfully');
      setTimeout(() => window.history.back(), 1500); // 👈 FIX: Changed to window.history.back()

    } catch (error: any) {
      toast.error('Submission Failed', { description: error.message });
      setStep('checkout');
    }
  };

  const renderCheckInOrOut = (isCheckout: boolean) => (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <h1 className="text-2xl font-bold">{isCheckout ? 'Dealer Checkout' : 'Dealer Check-in'}</h1>
      <p className="text-muted-foreground mb-6">Take a selfie to {isCheckout ? 'complete' : 'start'} the visit.</p>
      <Avatar className="w-48 h-48 mb-6 border-2">
        <AvatarImage src={(isCheckout ? checkOutPhoto : checkInPhoto) || ''} alt="Selfie" />
        <AvatarFallback><Camera className="w-16 h-16 text-muted-foreground" /></AvatarFallback>
      </Avatar>
      <Button onClick={handleOpenCamera} className="w-full max-w-sm mb-4">
        <Camera className="mr-2 h-4 w-4" /> Open Camera
      </Button>
      {isCheckout && checkOutPhoto && (
        <Button onClick={() => handleSubmit(submit)()} className="w-full max-w-sm">
          {step === 'submitting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Complete & Submit Report
        </Button>
      )}
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'loading':
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
          <form onSubmit={(e) => { e.preventDefault(); handleProceedToCheckout(); }} className="space-y-6">
            <div className="flex items-center gap-4 border-b pb-4">
              <Avatar className="w-20 h-20"><AvatarImage src={checkInPhoto || ''} /></Avatar>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Visit Details</h2>
                <p className="text-sm text-muted-foreground">Fill in all the required information below.</p>
              </div>
            </div>

            {/* Form fields... */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller name="dealerType" control={control} render={({ field }) => (
                <div className="space-y-1"><Label>Dealer Type *</Label><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent>{DEALER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>{errors.dealerType && <p className="text-sm text-red-500 mt-1">{errors.dealerType.message}</p>}</div>
              )} />
              <Controller name="dealerName" control={control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="dealerName">Dealer Name *</Label><Input id="dealerName" {...field} />{errors.dealerName && <p className="text-sm text-red-500 mt-1">{errors.dealerName.message}</p>}</div>)} />
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
              <Controller name="overdueAmount" control={control} render={({ field }) => (<div className="space-y-1"><Label>Overdue Amount (₹)</Label><Input {...field} value={field.value ?? ''} type="number" onChange={e => field.onChange(e.target.valueAsNumber)} /></div>)} />                 </div>

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
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button> {/* 👈 FIX: Changed to window.history.back() */}
          <h1 className="text-lg font-bold ml-2">Daily Visit Report</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {renderContent()}
      </main>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Take Selfie</DialogTitle></DialogHeader>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md" />
          <canvas ref={canvasRef} className="hidden" />
          <DialogFooter>
            <Button onClick={handleCapture}>Capture Photo</Button>
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