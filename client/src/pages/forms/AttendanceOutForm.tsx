import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Camera, MapPin } from 'lucide-react';

// --- UI Components ---
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- Constants ---
import { BASE_URL } from "@/components/ReusableUI";

// --- Type Definitions ---
type Step = 'camera' | 'location' | 'loading' | 'confirm';
interface AttendanceOutFormProps {
  userId: number;
  onSubmitted: () => void;
  onCancel: () => void;
}
interface GeoLocation {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
  };
  timestamp: number;
}

// --- Helper: Convert Data URL to Blob ---
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
  const res = await fetch(dataurl);
  return await res.blob();
}

// --- Component ---
export default function AttendanceOutForm({ userId, onSubmitted, onCancel }: AttendanceOutFormProps) {
  const [step, setStep] = useState<Step>('loading');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setStep('camera'))
      .catch(() => {
        toast.error("Permission Required", { description: "Camera access is needed to check out." });
        onCancel();
      });
  }, [onCancel]);

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

  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoUri(dataUrl);

      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
      setIsCameraOpen(false);
      fetchLocation();
    }
  };

  const fetchLocation = () => {
    setStep('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setStep('confirm');
      },
      (error) => {
        toast.error("Location Error", { description: error.message || "Unable to fetch location." });
        setStep('camera');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    if (!photoUri || !location) {
      return toast.error("Error", { description: "Photo or location data is missing." });
    }
    setIsSubmitting(true);

    try {
      // Step 1: Upload the image to R2
      const imageBlob = await dataURLtoBlob(photoUri);
      const uploadFormData = new FormData();
      const fileName = `checkout-${userId}-${Date.now()}.jpg`;
      uploadFormData.append('file', imageBlob, fileName);

      const uploadResponse = await fetch(`${BASE_URL}/api/r2/upload-direct`, {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload the selfie.");

      const { publicUrl } = await uploadResponse.json();
      if (!publicUrl) throw new Error("Did not receive a valid image URL from the server.");

      // Step 2: Submit the attendance data with the new publicUrl
      const attendancePayload = {
        userId,
        attendanceDate: new Date().toISOString().split('T')[0], 
        outTimeTimestamp: new Date(location.timestamp).toISOString(),
        outTimeImageCaptured: true,
        outTimeImageUrl: publicUrl,
        outTimeLatitude: location.coords.latitude,
        outTimeLongitude: location.coords.longitude,
        outTimeAccuracy: location.coords.accuracy,
        outTimeSpeed: location.coords.speed,
        outTimeHeading: location.coords.heading,
        outTimeAltitude: location.coords.altitude,
      };

      //console.log("Submitting this payload to /api/attendance/check-out:", JSON.stringify(attendancePayload, null, 2));

      const attendanceResponse = await fetch(`${BASE_URL}/api/attendance/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendancePayload),
      });

      if (!attendanceResponse.ok) {
        const result = await attendanceResponse.json().catch(() => ({ error: 'Check-out submission failed.' }));
        //console.error("Server validation error:", result); // This is good for debugging

        // --- NEW: Better Error Message Handling ---
        let errorMessage = result.error || 'Failed to check out.';
        // Check if the server provided specific details
        if (result.details && Array.isArray(result.details) && result.details.length > 0) {
          const specificError = result.details[0];
          errorMessage = `${specificError.path.join('.')} - ${specificError.message}`;
        }
        throw new Error(errorMessage);
      }

      toast.success('Checked Out Successfully!');
      onSubmitted();

    } catch (error: any) {
      toast.error('Submission Failed', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'loading':
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;

      case 'camera':
        return (
          <>
            <h1 className="text-2xl font-bold">Selfie Capture</h1>
            <p className="text-muted-foreground text-center mb-6">Please take a selfie to mark your check-out.</p>
            <Avatar className="w-64 h-64 mb-6 border-2">
              <AvatarFallback className="bg-muted"><Camera className="w-16 h-16 text-muted-foreground" /></AvatarFallback>
            </Avatar>
            <Button onClick={handleOpenCamera} className="w-full max-w-sm">
              <Camera className="mr-2 h-4 w-4" /> Capture & Continue
            </Button>
          </>
        );

      case 'confirm':
        return (
          <>
            <h1 className="text-2xl font-bold">Confirm Details</h1>
            <p className="text-muted-foreground text-center mb-6">Review your photo and location before checking out.</p>
            <Avatar className="w-48 h-48 mb-6 border-2">
              <AvatarImage src={photoUri || ''} alt="Your selfie" />
              <AvatarFallback className="bg-muted"><Camera className="w-12 h-12 text-muted-foreground" /></AvatarFallback>
            </Avatar>
            <div className="text-center mb-6 bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><MapPin className="h-4 w-4" /> Location Captured</p>
              <p className="font-semibold">Lat: {location?.coords.latitude.toFixed(5)}, Lon: {location?.coords.longitude.toFixed(5)}</p>
            </div>
            <Button onClick={handleSubmit} className="w-full max-w-sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Check-out
            </Button>
          </>
        );
      default:
        return <p className="text-destructive">Something went wrong. Please cancel and try again.</p>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full items-center justify-between p-4 bg-background pb-24">
      <div className="flex flex-col items-center justify-center text-center w-full max-w-sm">
        {renderContent()}
      </div>
      <Button
        variant="ghost"
        onClick={onCancel}
        disabled={isSubmitting}
        className="mt-4"
      >
        Cancel
      </Button>
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Take Selfie</DialogTitle></DialogHeader>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md" />
          <canvas ref={canvasRef} className="hidden" />
          <DialogFooter>
            <Button onClick={takePicture}>Capture Photo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}