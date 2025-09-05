import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Crosshair, RefreshCw, X } from "lucide-react";

type Props = {
  userId?: number;
  defaultLocationName?: string;
  onSubmitted?: (payload: any) => void;
  onCancel?: () => void;
};

function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const start = async (videoEl: HTMLVideoElement) => {
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
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

export default function AttendanceOutForm({
  userId,
  defaultLocationName,
  onSubmitted,
  onCancel,
}: Props) {
  type Step = "photo" | "location";
  const [step, setStep] = useState<Step>("photo");

  const { start, stop, capture } = useCamera();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [attendanceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [outTimeTimestamp, setOutTimeTimestamp] = useState<string | null>(null);
  const [outPhoto, setOutPhoto] = useState<string | null>(null);

  const [locationName, setLocationName] = useState<string>(defaultLocationName || "");
  const [outTimeLatitude, setLat] = useState<string>("");
  const [outTimeLongitude, setLng] = useState<string>("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step === "photo" && videoRef.current) {
      start(videoRef.current).catch(console.error);
      return () => stop();
    }
  }, [step, start, stop]);

  const takePhoto = () => {
    if (!videoRef.current) return;
    const dataUrl = capture(videoRef.current);
    setOutPhoto(dataUrl);
    setOutTimeTimestamp(new Date().toISOString());
    stop();
    setStep("location");
  };

  const useMyLocation = async () => {
    try {
      setGeoBusy(true);
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      );
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
      if (!locationName) {
        setLocationName(`Lat ${pos.coords.latitude.toFixed(5)}, Lng ${pos.coords.longitude.toFixed(5)}`);
      }
    } catch (e) {
      console.error(e);
      alert("Unable to get your location. Check permissions.");
    } finally {
      setGeoBusy(false);
    }
  };
  const validate = () => {
    if (!outPhoto) return "Please take the check-out photo.";
    if (!locationName || !outTimeLatitude || !outTimeLongitude) return "Location name and coordinates are required.";
    if (!outTimeTimestamp) return "Timestamp missing. Retake photo.";
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

    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || "Failed to get upload URL");
    }

    const { uploadUrl, publicUrl } = result;

    // upload directly to R2
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: blob,
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload image to R2");
    }

    return publicUrl;
  };

  const submit = async () => {
    const err = validate();
    if (err) return alert(err);
    try {
      setSubmitting(true);

      // Upload the checkout selfie image to R2
      const selfieUrl = outPhoto ? await uploadImage(outPhoto, "attendance-out") : null;

      // Prepare the punch-out payload
      const punchOutPayload = {
        userId: userId,
        latitude: Number(outTimeLatitude),
        longitude: Number(outTimeLongitude),
        accuracy: null, // You can enhance useMyLocation to capture this
        speed: null,
        heading: null,
        altitude: null,
        selfieUrl
      };

      // Submit to punch-out endpoint
      const response = await fetch("/api/attendance/punch-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(punchOutPayload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to punch out");
      }

      // Call the callback with the successful result
      onSubmitted?.(result.data);

    } catch (error) {
      console.error("Punch-out error:", error);
      alert(`Failed to punch out: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "photo") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Attendance Check-out</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
        </div>
        <div className="rounded-xl overflow-hidden bg-black/50">
          <video ref={videoRef} playsInline muted className="w-full h-64 object-cover" />
        </div>
        <Button onClick={takePhoto} className="w-full">
          <Camera className="h-4 w-4 mr-2" /> Capture & Continue
        </Button>
        <p className="text-xs text-muted-foreground">
          We’ll grab your location next. Attendance date: {attendanceDate}
        </p>
      </div>
    );
  }

  // step === "location"
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Your Location</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-2">
        <Label>Location name</Label>
        <Textarea
          rows={2}
          placeholder="e.g., Returning from site / Dealer location"
          value={locationName}
          onChange={e => setLocationName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Latitude</Label>
          <Input inputMode="decimal" value={outTimeLatitude} onChange={e => setLat(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label>Longitude</Label>
          <Input inputMode="decimal" value={outTimeLongitude} onChange={e => setLng(e.target.value)} required />
        </div>
      </div>

      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={geoBusy}>
        {geoBusy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Crosshair className="h-4 w-4 mr-2" />}
        Use my current location
      </Button>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={submitting}>Confirm Check-out</Button>
      </div>
    </div>
  );
}
