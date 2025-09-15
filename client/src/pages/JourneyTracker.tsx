// src/components/JourneyTracker.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from "@/components/ReusableUI";
import JourneyMap, { JourneyMapRef } from '@/components/journey-map';
import { useLocation } from "wouter";
import { toast } from 'sonner';
import { BASE_URL } from '@/components/ReusableUI';

import {
  ModernJourneyHeader,
  ModernTripPlanningCard,
  ModernActiveTripCard,
  ModernCompletedTripCard,
  ModernMessageCard
} from '@/components/ReusableUI';
import { Button } from '@/components/ui/button';

/* Radar Web SDK */
import 'radar-sdk-js/dist/radar.css';
import Radar from 'radar-sdk-js';

/* ===============================
   Radar SDK Adapter (promise wrapper)
   =============================== */

type RadarConfig = {
  logLevel?: 'none' | 'info' | 'warn' | 'error';
  cacheLocationMinutes?: number | null;
  locationMaximumAge?: number | null;
  locationTimeout?: number;
  desiredAccuracy?: 'high' | 'medium' | 'low';
};

const DEFAULT_CONFIG: RadarConfig = {
  logLevel: 'error',
  cacheLocationMinutes: null,
  locationMaximumAge: null,
  locationTimeout: 30000,
  desiredAccuracy: 'high'
};

class RadarSDKService {
  private isInitialized = false;
  private publishableKey: string | null = null;

  initialize(publishableKey: string, config?: RadarConfig) {
    if (this.isInitialized) {
      console.warn('Radar SDK already initialized');
      return;
    }
    this.publishableKey = publishableKey;
    const finalConfig = { ...DEFAULT_CONFIG, ...(config || {}) };

    try {
      if (Object.keys(finalConfig).length > 0) {
        (Radar as any).initialize(publishableKey, finalConfig);
      } else {
        (Radar as any).initialize(publishableKey);
      }
      this.isInitialized = true;
      console.info('Radar SDK initialized');
    } catch (err) {
      console.error('Radar initialize failed', err);
      throw err;
    }
  }

  isSDKInitialized() {
    return this.isInitialized;
  }

  getCurrentLocation(): Promise<any> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Radar SDK not initialized'));
    }
    return new Promise((resolve, reject) => {
      (Radar as any).getLocation((err: any, result: any) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  trackOnce(options?: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Radar SDK not initialized'));
    }
    return new Promise((resolve, reject) => {
      (Radar as any).trackOnce(options || {}, (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  startTrip(options: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Radar SDK not initialized'));
    }
    return new Promise((resolve, reject) => {
      (Radar as any).startTrip(options, (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  updateTrip(options: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Radar SDK not initialized'));
    }
    return new Promise((resolve, reject) => {
      (Radar as any).updateTrip(options, (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  completeTrip(): Promise<any> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Radar SDK not initialized'));
    }
    return new Promise((resolve, reject) => {
      (Radar as any).completeTrip((err: any, result: any) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  setUserId(userId: string) {
    if (!this.isInitialized) {
      throw new Error('Radar SDK not initialized');
    }
    (Radar as any).setUserId(userId);
  }

  requestPermissions(background = true): Promise<any> {
    const fn = (Radar as any)?.requestPermissions ?? (typeof window !== 'undefined' ? (window as any).Radar?.requestPermissions : undefined);
    if (typeof fn === 'function') {
      return fn(background);
    }
    return Promise.reject(new Error('requestPermissions not available on this SDK build'));
  }

  getRadarInstance(): any {
    if (!this.isInitialized) {
      throw new Error('Radar SDK not initialized');
    }
    return Radar;
  }
}

export const radarSDK = new RadarSDKService();

/* ===============================
   RadarPolylineTracker (adapted)
   - uses radarSDK.trackOnce()
   - stores points & polyline
   - exposes start/stop & callbacks
   =============================== */

type PolylineOptions = {
  trackingInterval?: number; // ms
  onLocationUpdate?: (point: any, user?: any, events?: any[]) => void;
  onPolylineUpdate?: (polyline: [number, number][], points: any[]) => void;
  onError?: (err: any) => void;
};

class RadarPolylineTracker {
  private isTracking = false;
  private trackingIntervalId: number | null = null;
  private locationPoints: any[] = [];
  private routePolyline: [number, number][] = [];
  private options: Required<PolylineOptions>;

  constructor(options?: PolylineOptions) {
    this.options = {
      trackingInterval: 8000, // default 8s for your app (match previous behavior)
      onLocationUpdate: () => {},
      onPolylineUpdate: () => {},
      onError: () => {},
      ...(options || {})
    };
  }

  async start() {
    if (this.isTracking) return;
    this.isTracking = true;
    this.locationPoints = [];
    this.routePolyline = [];

    // initial immediate track
    await this._trackOnceSafe();

    // interval
    this.trackingIntervalId = window.setInterval(() => {
      this._trackOnceSafe().catch(() => { /* swallow - callback will handle */ });
    }, this.options.trackingInterval) as unknown as number;
  }

  stop() {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.trackingIntervalId) {
      window.clearInterval(this.trackingIntervalId);
      this.trackingIntervalId = null;
    }
  }

  clear() {
    this.locationPoints = [];
    this.routePolyline = [];
  }

  async _trackOnceSafe() {
    try {
      const result = await radarSDK.trackOnce({});
      const location = result?.location;
      if (!location) return result;
      const events = result?.events || [];
      const user = result?.user;

      const point = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date().toISOString(),
        events
      };

      this.locationPoints.push(point);
      // polyline uses [lat, lng] for your map (you used [lat, lng] earlier)
      this.routePolyline.push([location.latitude, location.longitude]);

      // callbacks
      try {
        this.options.onLocationUpdate(point, user, events);
      } catch (cbErr) {
        console.warn('onLocationUpdate callback error', cbErr);
      }
      try {
        this.options.onPolylineUpdate(this.routePolyline.slice(), this.locationPoints.slice());
      } catch (cbErr) {
        console.warn('onPolylineUpdate callback error', cbErr);
      }

      return result;
    } catch (err) {
      try { this.options.onError(err); } catch (e) { /* ignore */ }
      throw err;
    }
  }

  getPolyline() {
    return this.routePolyline.slice();
  }

  getPoints() {
    return this.locationPoints.slice();
  }

  export() {
    return {
      polyline: this.getPolyline(),
      points: this.getPoints()
    };
  }
}

/* ===============================
   Types & geofence helpers
   =============================== */

interface GeofenceEvent {
  type: 'user.entered_geofence' | 'user.exited_geofence' | 'user.entered_place' | 'user.exited_place';
  geofence?: { _id: string; description: string; tag?: string };
  place?: { _id: string; name: string; categories: string[] };
  confidence: 'high' | 'medium' | 'low';
  duration?: number;
}

interface RadarResultWithEvents {
  location?: { latitude: number; longitude: number; accuracy?: number; };
  user?: { _id: string; userId?: string; metadata?: Record<string, any>; description?: string; };
  events?: GeofenceEvent[];
}

function showBrowserNotification(message: string) {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Location Update', {
        body: message,
        icon: '/BEST_CEMENT_LOGO.webp',
        badge: '/BEST_CEMENT_LOGO.webp'
      });
    } catch (e) { /* ignore */ }
  }
}

function showGeofenceAlert(action: 'entered' | 'exited', locationName: string) {
  const message = action === 'entered' ? `✅ Entered: ${locationName}` : `🚶 Left: ${locationName}`;
  toast.success(message, { duration: 5000, position: 'top-center' });
  showBrowserNotification(message);
}

function showPlaceAlert(action: 'entered' | 'exited', placeName: string) {
  const message = action === 'entered' ? `📍 Arrived at: ${placeName}` : `👋 Left: ${placeName}`;
  toast.info(message, { duration: 5000, position: 'top-center' });
  showBrowserNotification(message);
}

function handleGeofenceEvents(events?: GeofenceEvent[] | null) {
  if (!events || events.length === 0) return;
  for (const event of events) {
    switch (event.type) {
      case 'user.entered_geofence':
        showGeofenceAlert('entered', event.geofence?.description || 'Unknown location');
        break;
      case 'user.exited_geofence':
        showGeofenceAlert('exited', event.geofence?.description || 'Unknown location');
        break;
      case 'user.entered_place':
        showPlaceAlert('entered', event.place?.name || 'Unknown place');
        break;
      case 'user.exited_place':
        showPlaceAlert('exited', event.place?.name || 'Unknown place');
        break;
      default:
        break;
    }
  }
}

function handleTrackingError(err: any) {
  const name = err?.name || err?.constructor?.name || 'UnknownError';
  let errorMessage = 'Location tracking failed';

  switch (name) {
    case 'RadarLocationPermissionsError':
      errorMessage = 'Please enable location permissions';
      break;
    case 'RadarLocationError':
      errorMessage = 'Unable to get your location';
      break;
    case 'RadarTimeoutError':
      errorMessage = 'Location request timed out';
      break;
    case 'RadarPaymentRequiredError':
      errorMessage = 'Location service temporarily unavailable';
      break;
    case 'RadarPublishableKeyError':
      errorMessage = 'SDK not initialized or invalid publishable key';
      break;
    default:
      errorMessage = `Location error: ${err?.message ?? String(err)}`;
      break;
  }

  toast.error(errorMessage);
  console.warn('Radar tracking error details:', {
    name,
    message: err?.message,
    code: err?.code,
    response: err?.response,
    stack: err?.stack
  });
}

/* ===============================
   JourneyTracker component
   =============================== */

interface Dealer {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface TripData {
  journeyId: string;
  dbJourneyId: number;
  dealer: Dealer;
  radarTrip: any;
}

interface PJP {
  id: string;
  areaToBeVisited: string;
  status: string;
  planDate: string;
  dealerName: string;
  dealerAddress: string;
  dealerLatitude?: number;
  dealerLongitude?: number;
  [key: string]: any;
}

/* Helper */
const toDealerExternalId = (id?: string) => id?.startsWith('dealer:') ? id : `dealer:${id}`;

async function radarGetTripRouteViaBackend(journeyId: string) {
  const res = await fetch(`/api/geo/trips/${journeyId}/route`);
  if (!res.ok) throw new Error(`Backend route fetch failed: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch route");
  return json.data;
}

export default function JourneyTracker({ onBack }: { onBack?: () => void }) {
  const [location] = useLocation();
  const { user } = useAppStore();
  const userId = user?.id as string | undefined;

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [pjps, setPjps] = useState<PJP[]>([]);

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [tripStatus, setTripStatus] = useState<'idle' | 'active' | 'completed'>('idle');
  const [activeTripData, setActiveTripData] = useState<TripData | null>(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDestinationChange, setShowDestinationChange] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);

  const mapRef = useRef<JourneyMapRef>(null);
  const polylineTrackerRef = useRef<RadarPolylineTracker | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const selectedPJP = (location as any).state?.selectedPJP;

  /* ===============================
     Radar SDK Initialization (once)
     =============================== */
  useEffect(() => {
    (async () => {
      try {
        const pk = (import.meta.env as any).VITE_RADAR_PUBLISHABLE_KEY as string | undefined;
        if (!pk) {
          console.warn('VITE_RADAR_PUBLISHABLE_KEY not set - Radar will not initialize');
          return;
        }

        radarSDK.initialize(pk, { logLevel: 'error' });

        if (userId) {
          try { radarSDK.setUserId(userId); } catch { /* non-fatal */ }
        }

        // Request Radar permissions (foreground/background) if SDK supports it.
        try {
          await radarSDK.requestPermissions(true).catch((e) => {
            console.info('radarSDK.requestPermissions result/err (non-fatal):', e);
          });
        } catch (permErr) {
          console.info('Radar.requestPermissions not available or failed (non-fatal):', permErr);
        }

        // Request browser Notification permission (client-only, non-blocking)
        try {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
            await Notification.requestPermission().catch(() => { /* ignore */ });
          }
        } catch (e) {
          console.warn('Notification permission request failed', e);
        }
      } catch (err) {
        console.error('Radar init error', err);
        setError('Unable to init location SDK');
      }
    })();

    // only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If userId becomes available after mount, ensure the SDK has it
  useEffect(() => {
    if (!userId) return;
    try {
      if (radarSDK.isSDKInitialized()) {
        try {
          radarSDK.setUserId(userId);
        } catch (e) {
          console.warn('radarSDK.setUserId failed', e);
        }
      }
    } catch {
      // ignore
    }
  }, [userId]);

  /* ===============================
     Wake Lock Logic
     =============================== */
  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      console.warn("Wake Lock not supported in this browser.");
      return { ok: false, reason: "not-supported" } as const;
    }

    try {
      const sentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockRef.current = sentinel as WakeLockSentinel;
      console.log("Wake Lock acquired");

      sentinel.addEventListener("release", () => {
        console.info("Wake Lock was released by the system/UA.");
        wakeLockRef.current = null;
      });

      return { ok: true } as const;
    } catch (err: any) {
      console.error("Wake Lock request failed:", err?.name, err?.message);
      return { ok: false, reason: err?.name ?? 'error', error: err } as const;
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log("Wake Lock manually released");
      }
    } catch (err) {
      console.warn("Error releasing wake lock:", err);
    }
  };

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && tripStatus === 'active' && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [tripStatus]);

  // useEffect to handle navigation state from HomePage
  useEffect(() => {
    if (selectedPJP && selectedPJP.dealerName) {
      const dealer: Dealer = {
        id: selectedPJP.areaToBeVisited,
        name: selectedPJP.dealerName,
        address: selectedPJP.dealerAddress,
        latitude: selectedPJP.dealerLatitude || 0,
        longitude: selectedPJP.dealerLongitude || 0,
      };
      setSelectedDealer(dealer);
      setTripStatus('idle');
    }
  }, [selectedPJP]);

  // fetch PJPs
  useEffect(() => {
    if (!userId) return;
    const fetchPJPs = async () => {
      try {
        const pjpUrl = `${BASE_URL}/api/pjp/user/${userId}`;
        const pjpResponse = await fetch(pjpUrl);
        const pjpResult = await pjpResponse.json();

        if (pjpResponse.ok && pjpResult.success) {
          const pjpsResp: PJP[] = pjpResult.data;
          const dealerIds = Array.from(new Set(pjpsResp.map((p: PJP) => p.areaToBeVisited)));

          const dealersMap = new Map<string, Dealer>();
          if (dealerIds.length > 0) {
            const dealerPromises = dealerIds.map(id =>
              fetch(`${BASE_URL}/api/dealers/${id}`).then(res => res.json()).catch(() => ({ success: false }))
            );
            const dealerResults = await Promise.all(dealerPromises);
            dealerResults.forEach(res => {
              if (res && res.success && res.data) {
                dealersMap.set(res.data.id, res.data);
              }
            });
          }

          const enrichedPjps = pjpsResp.map((p: PJP) => {
            const dealerInfo = dealersMap.get(p.areaToBeVisited);
            return {
              ...p,
              dealerName: dealerInfo?.name || p.dealerName || 'Unknown Dealer',
              dealerAddress: dealerInfo?.address || p.dealerAddress || 'Location TBD',
              dealerLatitude: dealerInfo?.latitude ?? p.dealerLatitude,
              dealerLongitude: dealerInfo?.longitude ?? p.dealerLongitude,
            };
          });
          setPjps(enrichedPjps);
        } else {
          throw new Error(pjpResult.error || "Failed to fetch PJPs.");
        }
      } catch (e: any) {
        console.error('Error fetching PJPs:', e);
        setError('Failed to load PJPs');
      }
    };
    fetchPJPs();
  }, [userId]);

  /* ===============================
     Tracking helpers & lifecycle (polyline tracker)
     =============================== */

  const stopPolylineTracker = () => {
    try {
      polylineTrackerRef.current?.stop();
      polylineTrackerRef.current = null;
      console.info('Polyline tracker stopped');
    } catch (e) {
      console.warn('Error stopping polyline tracker', e);
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      if (!radarSDK.isSDKInitialized()) {
        setIsLoadingLocation(false);
        setError('Location SDK not initialized');
        return;
      }
      const result = await radarSDK.getCurrentLocation();
      if (result && result.location) {
        setCurrentLocation({
          lat: result.location.latitude,
          lng: result.location.longitude,
          address: result.location.formattedAddress || 'Current Location'
        });

        if (mapRef.current && typeof mapRef.current.setView === 'function') {
          mapRef.current.setView(result.location.latitude, result.location.longitude, 15);
        }
      } else {
        setError('Failed to get current location from Radar.');
      }
    } catch (err: any) {
      console.error('getCurrentLocation error', err);
      setError(`Unable to get location: ${err?.message ?? String(err)}`);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const startTrip = async () => {
    if (!currentLocation || !selectedDealer || !userId) {
      setError('Please select a destination');
      return;
    }

    // create an externalId which backend can use if Radar.startTrip isn't available or returns no id
    const externalId = `${userId}-${Date.now()}`;

    try {
      await requestWakeLock();

      if (!radarSDK.isSDKInitialized()) {
        setError('Location SDK not initialized');
        return;
      }

      // Try to call Radar.startTrip if available — new docs suggest this may not be required.
      let radarTrip: any = null;
      try {
        const startResp = await radarSDK.startTrip({
          externalId,
          destinationGeofenceTag: "dealer",
          destinationGeofenceExternalId: toDealerExternalId(selectedDealer.id),
          mode: "car",
          metadata: {
            originLatitude: currentLocation.lat,
            originLongitude: currentLocation.lng
          }
        }).catch((e) => {
          // don't throw; some SDK builds may not support startTrip for foreground polyline flows
          console.info('radarSDK.startTrip non-fatal error', e);
          return null;
        });

        radarTrip = startResp?.trip ?? null;
      } catch (e) {
        console.info('radarSDK.startTrip call failed (non-fatal)', e);
        radarTrip = null;
      }

      // Inform backend that journey started. Provide radarTripId if we have it, otherwise pass externalId so backend can reconcile.
      const response = await fetch('/api/geo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dealerId: selectedDealer.id,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          radarTripId: radarTrip?._id ?? null,
          externalId // helpful if Radar didn't create a trip id
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to start trip (backend)');
      }

      // Determine canonical journeyId for sync: prefer radarTrip._id, else backend DB id if provided, else externalId
      const journeyId = radarTrip?._id ?? (data.data?.journeyId ?? externalId);

      setActiveTripData({
        journeyId,
        dbJourneyId: data.data?.dbJourneyId ?? -1,
        dealer: selectedDealer,
        radarTrip: radarTrip ?? null
      });

      setTripStatus('active');
      setSuccess('Journey started! 🚗');

      // Start polyline tracker and wire callbacks to update UI and sync backend
      const tracker = new RadarPolylineTracker({
        trackingInterval: 8000,
        onLocationUpdate: async (point, userObj, events) => {
          // update UI immediately
          setCurrentLocation({ lat: point.latitude, lng: point.longitude });

          // handle geofence/place events
          try {
            handleGeofenceEvents(events as any);
          } catch (e) {
            console.warn('handleGeofenceEvents failed', e);
          }

          // Ask backend for updated route & trip sync (non-blocking)
          try {
            const routeData = await radarGetTripRouteViaBackend(journeyId);
            if (routeData?.distance && routeData?.duration) {
              setDistance(routeData.distance.value || 0);
              setDuration(routeData.duration.value || 0);
            }
            if (routeData?.geometry?.coordinates) {
              const polylinePoints = routeData.geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
              setRoutePolyline(polylinePoints);
            }
          } catch (routeErr) {
            // non-fatal
            //console.warn('Route fetch failed:', routeErr);
          }

          // sync trip status from backend (non-blocking)
          try {
            const resp = await fetch(`/api/geo/trips/${journeyId}`);
            if (resp.ok) {
              const json = await resp.json();
              if (json.success && json.data?.radarTrip) {
                const trip = json.data.radarTrip;
                if (trip.distance && trip.duration) {
                  setDistance(trip.distance.value || 0);
                  setDuration(trip.duration.value || 0);
                }
                setActiveTripData(prev => prev && prev.journeyId === journeyId ? { ...prev, radarTrip: trip } : prev);
              }
            }
          } catch (syncErr) {
            // non-fatal
            //console.warn('Trip sync failed', syncErr);
          }
        },
        onPolylineUpdate: (polyline, points) => {
          // keep UI polyline in sync — convert [lat,lng] -> [lat, lng] (we store lat,lng)
          setRoutePolyline(polyline as [number, number][]);
        },
        onError: (err) => {
          handleTrackingError(err);
        }
      });

      polylineTrackerRef.current = tracker;
      await tracker.start();
    } catch (err: any) {
      console.error('Start trip error:', err);
      setError(`Failed to start trip: ${err?.message ?? String(err)}`);
    }
  };

  const changeDestination = async (newPjpId: string) => {
    if (!activeTripData) return;

    try {
      if (!radarSDK.isSDKInitialized()) {
        setError('Location SDK not initialized');
        return;
      }

      const resp = await radarSDK.updateTrip({
        destinationGeofenceExternalId: toDealerExternalId(newPjpId)
      }).catch((e) => {
        console.info('radarSDK.updateTrip non-fatal error', e);
        return null;
      });

      const trip = resp?.trip ?? null;

      const response = await fetch(`/api/geo/trips/${activeTripData.journeyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationGeofenceExternalId: newPjpId,
          status: "destination_updated"
        })
      });

      const data = await response.json();
      if (data.success) {
        const newPjp = pjps.find(p => p.areaToBeVisited === newPjpId);
        if (newPjp) {
          const newDealer = {
            id: newPjp.areaToBeVisited,
            name: newPjp.dealerName,
            address: newPjp.dealerAddress,
            latitude: newPjp.dealerLatitude || 0,
            longitude: newPjp.dealerLongitude || 0,
          };
          setSelectedDealer(newDealer);
          setActiveTripData(prev => prev ? { ...prev, dealer: newDealer, radarTrip: trip ?? prev.radarTrip } : null);
          setSuccess('Destination updated! 🎯');
          setShowDestinationChange(false);
          setRoutePolyline([]);
        }
      } else {
        setError(data.error || 'Failed to update');
      }
    } catch (err: any) {
      console.error('Change destination error:', err);
      setError(`Failed to change destination: ${err?.message ?? String(err)}`);
    }
  };

  const completeTrip = async () => {
    if (!activeTripData) return;

    await releaseWakeLock();

    try {
      const response = await fetch(`/api/geo/finish/${activeTripData.journeyId}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        setTripStatus('completed');
        setSuccess('Journey completed! 🎉');

        stopPolylineTracker();

        try {
          if (radarSDK.isSDKInitialized()) {
            await radarSDK.completeTrip().catch(() => { /* non-fatal */ });
          }
        } catch {
          // non-fatal
        }
      } else {
        setError('Failed to complete trip');
      }
    } catch (err) {
      console.error('completeTrip error', err);
      setError('Failed to complete trip');
    }
  };

  const startNewJourney = () => {
    stopPolylineTracker();
    setTripStatus('idle');
    setActiveTripData(null);
    setSelectedDealer(null);
    setDistance(0);
    setDuration(0);
    setRoutePolyline([]);
    setShowDestinationChange(false);
  };

  useEffect(() => {
    if (success || error) {
      const timer = window.setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => window.clearTimeout(timer);
    }
  }, [success, error]);

  useEffect(() => {
    getCurrentLocation();
    return () => {
      releaseWakeLock();
      stopPolylineTracker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ModernJourneyHeader status={tripStatus} onBack={onBack} />
      {success && <ModernMessageCard type="success" message={success} />}
      {error && <ModernMessageCard type="error" message={error} />}
      <div className="container max-w-md mx-auto p-4 space-y-4">
        <JourneyMap
          ref={mapRef}
          currentLocation={currentLocation}
          selectedDealer={selectedDealer}
          routePolyline={routePolyline}
          className="w-full"
        />
        {tripStatus === 'idle' && (
          selectedDealer ? (
            <div className="mx-4 mb-4 border-0 shadow-xl p-6 bg-background/95 backdrop-blur-md rounded-lg">
              <h2 className="text-xl font-bold text-center mb-4">Ready to Start Journey</h2>
              <p className="text-lg font-medium text-white mb-1">{selectedDealer.name}</p>
              <p className="text-sm text-muted-foreground">{selectedDealer.address}</p>
              <Button
                onClick={startTrip}
                disabled={!currentLocation}
                className="w-full h-12 mt-4 text-base font-semibold"
              >
                Start Journey to {selectedDealer.name}
              </Button>
            </div>
          ) : (
            <ModernTripPlanningCard
              currentLocation={currentLocation?.address}
              selectedDealer={selectedDealer}
              dealers={pjps.map(pjp => ({
                id: pjp.areaToBeVisited,
                name: pjp.dealerName,
                address: pjp.dealerAddress,
                latitude: pjp.dealerLatitude || 0,
                longitude: pjp.dealerLongitude || 0
              }))}
              isLoadingLocation={isLoadingLocation}
              onGetCurrentLocation={getCurrentLocation}
              onDealerSelect={(pjpId) => {
                const pjp = pjps.find(p => p.areaToBeVisited === pjpId);
                if (pjp) {
                  setSelectedDealer({
                    id: pjp.areaToBeVisited,
                    name: pjp.dealerName,
                    address: pjp.dealerAddress,
                    latitude: pjp.dealerLatitude || 0,
                    longitude: pjp.dealerLongitude || 0,
                  });
                }
              }}
              onStartTrip={startTrip}
            />
          )
        )}
        {tripStatus === 'active' && activeTripData && (
          <ModernActiveTripCard
            dealer={activeTripData.dealer}
            distance={distance}
            duration={duration}
            onChangeDestination={() => setShowDestinationChange(true)}
            onCompleteTrip={completeTrip}
            showDestinationChange={showDestinationChange}
            dealers={pjps.map(pjp => ({
              id: pjp.areaToBeVisited,
              name: pjp.dealerName,
              address: pjp.dealerAddress,
              latitude: pjp.dealerLatitude || 0,
              longitude: pjp.dealerLongitude || 0
            }))}
            onDestinationChange={changeDestination}
            onCancelChange={() => setShowDestinationChange(false)}
          />
        )}
        {tripStatus === 'completed' && (
          <ModernCompletedTripCard
            distance={distance}
            duration={duration}
            onStartNew={startNewJourney}
          />
        )}
      </div>
    </div>
  );
}
