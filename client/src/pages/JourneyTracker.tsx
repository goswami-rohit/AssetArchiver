// src/pages/JourneyTracker.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, BASE_URL } from "@/components/ReusableUI";
import JourneyMap, { JourneyMapRef } from '@/components/journey-map';
import { useLocation } from "wouter";
import { toast } from 'sonner';

import {
  ModernJourneyHeader,
  ModernTripPlanningCard,
  ModernActiveTripCard,
  ModernCompletedTripCard,
  ModernMessageCard
} from '@/components/ReusableUI';
import { Button } from '@/components/ui/button';

/* Radar Web SDK init only */
import 'radar-sdk-js/dist/radar.css';
import Radar from 'radar-sdk-js';

/* =============
   Minimal Radar wrapper for init only (keep as you had it)
   ============= */
class RadarInitOnlyService {
  private isInitialized = false;
  private publishableKey: string | null = null;

  initialize(publishableKey: string, config?: any) {
    if (this.isInitialized) {
      console.warn('Radar SDK already initialized');
      return;
    }
    this.publishableKey = publishableKey;
    try {
      if (config && Object.keys(config).length > 0) {
        (Radar as any).initialize(publishableKey, config);
      } else {
        (Radar as any).initialize(publishableKey);
      }
      this.isInitialized = true;
      console.info('Radar SDK initialized (init-only)');
    } catch (err) {
      console.error('Radar initialize failed', err);
      throw err;
    }
  }

  isSDKInitialized() {
    return this.isInitialized;
  }

  setUserId(userId: string) {
    if (!this.isInitialized) throw new Error('Radar SDK not initialized');
    try {
      (Radar as any).setUserId(userId);
    } catch (e) {
      console.warn('radar.setUserId failed', e);
    }
  }

  requestPermissions(background = true): Promise<any> {
    const fn = (Radar as any)?.requestPermissions ?? (typeof window !== 'undefined' ? (window as any).Radar?.requestPermissions : undefined);
    if (typeof fn === 'function') {
      try {
        return fn(background);
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return Promise.reject(new Error('requestPermissions not available on this SDK build'));
  }
}

export const radarSDK = new RadarInitOnlyService();

/* ===============================
   Types & small geofence helpers
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
  radarTrip: any | null;
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

const toDealerExternalId = (id?: string) => id?.startsWith('dealer:') ? id : `dealer:${id}`;

/* ===============================
   Haversine util (meters)
   =============================== */
const haversineDistanceMeters = (coords1: [number, number], coords2: [number, number]) => {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371e3; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* ===============================
   Main Component (3-phase Radar integration)
   - Phase 1: route calc (on startTrip)
   - Phase 2: continuous tracking (trackOnce loop)
   - Phase 3: trip end & final payload (completeTrip)
   =============================== */
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
  const [distance, setDistance] = useState<number>(0); // meters
  const [duration, setDuration] = useState<number>(0); // seconds
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDestinationChange, setShowDestinationChange] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]); // [lat,lng] points

  const mapRef = useRef<JourneyMapRef>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Tracking refs for Phase 2
  const trackingIntervalRef = useRef<number | null>(null);
  const prevCoordsRef = useRef<[number, number] | null>(null); // [lon, lat]
  const tripStartTimeRef = useRef<number | null>(null);
  const trackingPointsRef = useRef<Array<{ lat: number; lng: number; timestamp: string }>>([]);

  const selectedPJP = (location as any).state?.selectedPJP;

  /* ===============================
     Radar SDK Initialization (kept)
     =============================== */
  useEffect(() => {
    (async () => {
      try {
        const pk = (import.meta.env as any).VITE_RADAR_PUBLISHABLE_KEY as string | undefined;
        if (!pk) {
          console.warn('VITE_RADAR_PUBLISHABLE_KEY not set - Radar init skipped');
          return;
        }

        radarSDK.initialize(pk, { logLevel: 'error' });

        if (userId) {
          try { radarSDK.setUserId(userId); } catch { /* non-fatal */ }
        }

        try {
          await radarSDK.requestPermissions(true).catch((e) => {
            console.info('radarSDK.requestPermissions result/err (non-fatal):', e);
          });
        } catch (permErr) {
          console.info('Radar.requestPermissions not available or failed (non-fatal):', permErr);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ensure SDK userId if later available
  useEffect(() => {
    if (!userId) return;
    try {
      if (radarSDK.isSDKInitialized()) {
        radarSDK.setUserId(userId);
      }
    } catch (e) {
      console.warn('radarSDK.setUserId failed', e);
    }
  }, [userId]);

  /* ===============================
     Wake Lock logic (unchanged)
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

  /* ===============================
     PJP & dealer loading/fetching (kept)
     =============================== */
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
     getCurrentLocation - browser geolocation fallback (kept)
     =============================== */
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      if (!('geolocation' in navigator)) {
        setError('Geolocation not supported in this browser');
        setIsLoadingLocation(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentLocation({
            lat: latitude,
            lng: longitude,
            address: 'Current Location'
          });
          if (mapRef.current && typeof mapRef.current.setView === 'function') {
            mapRef.current.setView(latitude, longitude, 15);
          }
          setIsLoadingLocation(false);
        },
        (err) => {
          console.error('getCurrentLocation error', err);
          setError(err?.message ?? 'Unable to fetch location');
          setIsLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (err: any) {
      console.error('getCurrentLocation unexpected error', err);
      setError(String(err));
      setIsLoadingLocation(false);
    }
  };

  /* ===============================
     STOP tracking helpers for Phase 2
     =============================== */
  const stopTrackingLoop = () => {
    if (trackingIntervalRef.current) {
      window.clearInterval(trackingIntervalRef.current as any);
      trackingIntervalRef.current = null;
    }
    prevCoordsRef.current = null;
    tripStartTimeRef.current = null;
    trackingPointsRef.current = [];
  };

  /* ===============================
     Phase 1: startTrip()
     - then call Radar.getLocation() and Radar.distance() to compute route geometry
     - set routePolyline (converted to [lat,lng]) and initialize tracking state
     =============================== */
  const startTrip = async () => {
    if (!currentLocation || !selectedDealer || !userId) {
      setError('Please select a destination');
      return;
    }

    try {
      await requestWakeLock();

      // PHASE 1: Radar route calculation
      let routePoints: [number, number][] = [];

      if (radarSDK.isSDKInitialized()) {
        const locRes = await (Radar as any).getLocation();
        const origin = locRes?.location;

        if (origin) {
          const routeRes = await (Radar as any).distance({
            origin: { latitude: origin.latitude, longitude: origin.longitude },
            destination: { latitude: selectedDealer.latitude, longitude: selectedDealer.longitude },
            modes: ['car'],
            units: 'metric'
          });

          const coords = routeRes?.routes?.car?.geometry?.coordinates;
          if (Array.isArray(coords)) {
            routePoints = coords.map((c: [number, number]) => [c[1], c[0]]);
            setRoutePolyline(routePoints);
          }
        }
      }

      tripStartTimeRef.current = Date.now();
      trackingPointsRef.current = [];
      prevCoordsRef.current = null;
      setDistance(0);
      setDuration(0);

      setActiveTripData({
        journeyId: `${userId}-${Date.now()}`,
        dbJourneyId: -1,
        dealer: selectedDealer,
        radarTrip: null
      });
      setTripStatus('active');
      setSuccess('Journey started! 🚀');

      // PHASE 2 loop
      startTrackingLoop();
    } catch (err: any) {
      console.error('Start trip error:', err);
      setError(`Failed to start trip: ${err?.message ?? String(err)}`);
    }
  };


  /* ===============================
     Phase 2: Continuous tracking (trackOnce loop)
     - Poll every N ms using Radar.trackOnce()
     - Append points, update routePolyline (trail), compute distance via Haversine
     - Update duration
     - If a geofence.entered 'destination' event is seen -> call completeTrip()
     =============================== */
  const startTrackingLoop = async () => {
    // Prevent duplicates
    if (trackingIntervalRef.current) return;

    const intervalMs = 5000; // every 5s as plan
    const doTrackOnce = async () => {
      try {
        if (!radarSDK.isSDKInitialized()) {
          // fallback to browser geolocation if radar not available
          if (!('geolocation' in navigator)) return;
          navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            handleNewPoint(lon, lat, []);
          }, (e) => {
            console.warn('Browser geolocation error during tracking:', e);
          }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
          return;
        }

        const res = await (Radar as any).trackOnce().catch((e: any) => { throw e; });
        const location = res?.location;
        const events = res?.events ?? [];

        if (location && location.latitude != null && location.longitude != null) {
          handleNewPoint(location.longitude, location.latitude, events);

          // If events contain a destination geofence enter, finish the trip (Phase 3 trigger)
          if (Array.isArray(events) && events.length) {
            const destEvent = events.find((ev: any) => ev.type === 'user.entered_geofence' && ev.geofence?.tag === 'destination');
            if (destEvent) {
              // gracefully complete trip
              // stop the interval first to avoid race
              if (trackingIntervalRef.current) {
                window.clearInterval(trackingIntervalRef.current as any);
                trackingIntervalRef.current = null;
              }
              // call completeTrip which will persist final payload (includes distance/duration)
              // NOTE: completeTrip clears tracking state and calls /api/... as before
              await completeTrip();
              return;
            }
          }
        } else {
          // No location from radar.trackOnce - ignore
          console.warn('radar.trackOnce returned no location');
        }
      } catch (err: any) {
        console.warn('Tracking loop error (non-fatal):', err);
      }
    };

    // immediate invocation then interval
    await doTrackOnce();
    trackingIntervalRef.current = window.setInterval(doTrackOnce, intervalMs) as unknown as number;
  };

  /* Helper to handle new point from Phase 2 */
  const handleNewPoint = (lon: number, lat: number, events: any[]) => {
    try {
      // update trackingPointsRef and routePolyline
      const ts = new Date().toISOString();
      trackingPointsRef.current.push({ lat, lng: lon ? lon : lat, timestamp: ts }); // keep structure, but we'll use lat/lng properly below

      // convert incoming coords for map [lat, lng]
      const ptLatLng: [number, number] = [lat, lon];

      // Append to trail polyline (we use [lat,lng] for map)
      setRoutePolyline(prev => {
        const next = [...prev, ptLatLng];
        return next;
      });

      // Compute distance between previous and current
      const prev = prevCoordsRef.current;
      const cur: [number, number] = [lon, lat];
      if (prev) {
        const segment = haversineDistanceMeters(prev, cur);
        setDistance(d => {
          const updated = d + segment;
          return updated;
        });
      }
      prevCoordsRef.current = cur;

      // update duration relative to tripStartTimeRef
      if (tripStartTimeRef.current) {
        const durSec = Math.round((Date.now() - tripStartTimeRef.current) / 1000);
        setDuration(durSec);
      }
    } catch (err) {
      console.warn('handleNewPoint failed', err);
    }
  };

  /* ===============================
     Phase 3: completeTrip()
     - Stop tracking loop
     - Use last known location (Radar or browser) and accumulated distance/duration
     =============================== */
  const completeTrip = async () => {
    if (!activeTripData) return;

    await releaseWakeLock();
    stopTrackingLoop();

    const journeyId = activeTripData.journeyId;
    const externalIdFallback = `${userId ?? 'unknown'}-${Date.now()}`;

    // Try Radar for last location, else fallback to browser
    let latestLocation: any = null;
    if (radarSDK.isSDKInitialized()) {
      const trackResult = await (Radar as any).trackOnce().catch(() => null);
      latestLocation = trackResult?.location ?? null;
    }
    if (!latestLocation && 'geolocation' in navigator) {
      latestLocation = await new Promise<any>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }

    const lat = latestLocation?.latitude ?? currentLocation?.lat ?? null;
    const lng = latestLocation?.longitude ?? currentLocation?.lng ?? null;

    const totalDistanceMeters = Number(distance ?? 0);
    const totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 1000) / 1000;
    const totalDurationSec = Number(duration ?? 0);
    const nowDate = new Date();

    // ✅ Correct schema-matching payload
    const payload = {
      userId: userId ? Number(userId) : null,
      latitude: lat !== null ? String(Number(lat).toFixed(7)) : null,
      longitude: lng !== null ? String(Number(lng).toFixed(7)) : null,
      recorded_at: nowDate,
      location_type: radarSDK.isSDKInitialized() ? 'radar' : 'browser',
      app_state: 'foreground',
      site_name: activeTripData.dealer?.name ?? null,
      check_in_time: null,
      check_out_time: nowDate,
      total_distance_travelled: totalDistanceKm,
      journey_id: journeyId ?? externalIdFallback,
      is_active: false,
      dest_lat: activeTripData.dealer?.latitude ?? null,
      dest_lng: activeTripData.dealer?.longitude ?? null,

      // extras (not validated in schema, but useful)
      tripDurationSeconds: totalDurationSec,
      routePolyline: routePolyline,
    };

    console.log("📦 Final payload to POST:", payload);

    try {
      const resp = await fetch(`${BASE_URL}/api/geotracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || (json && json.success === false)) {
        console.warn('Geo-tracking POST failed', resp.status, json);
        toast.error('Unable to persist journey summary (saved locally).');
      } else {
        console.info('Geo-tracking saved ✅:', json?.data ?? json);
      }
    } catch (postErr) {
      console.warn('Network error posting geo-tracking final payload', postErr);
      toast.error('Network error while saving journey summary.');
    }

    setTripStatus('completed');
    setSuccess('Journey completed! 🎉');

    // Cleanup
    setActiveTripData(null);
    setRoutePolyline([]);
    setDistance(0);
    setDuration(0);
  };

  const startNewJourney = () => {
    stopTrackingLoop();
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
      stopTrackingLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===============================
     Render UI (kept as before, small padding tweak)
     =============================== */
  return (
    <div className="min-h-screen bg-background">
      <ModernJourneyHeader status={tripStatus} onBack={onBack} />
      {success && <ModernMessageCard type="success" message={success} />}
      {error && <ModernMessageCard type="error" message={error} />}

      <div
        className="container max-w-md mx-auto p-4 space-y-4 pb-32"
        style={{ paddingBottom: `calc(8rem + env(safe-area-inset-bottom))` }} // keep bottom padding for cards
      >
        <div className="mb-6 rounded-lg overflow-hidden">
          <JourneyMap
            ref={mapRef}
            currentLocation={currentLocation}
            selectedDealer={selectedDealer}
            routePolyline={routePolyline}
            className="w-full"
          />
        </div>

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
            distance={Math.round(distance)} // meters
            duration={duration} // sec
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
            onDestinationChange={async (newPjpId: string) => {
              // keep your existing behavior (unchanged)
              try {
                const resp = await fetch(`/api/geo/trips/${activeTripData.journeyId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ destinationGeofenceExternalId: toDealerExternalId(newPjpId), status: "destination_updated" })
                });
                const json = await resp.json();
                if (json.success) {
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
                    setActiveTripData(prev => prev ? { ...prev, dealer: newDealer } : null);
                    setSuccess('Destination updated! 🎯');
                    setShowDestinationChange(false);
                    setRoutePolyline([]);
                  }
                } else {
                  setError(json.error || 'Failed to update destination');
                }
              } catch (e: any) {
                console.warn('change destination error', e);
                setError('Failed to change destination');
              }
            }}
            onCancelChange={() => setShowDestinationChange(false)}
          />
        )}

        {tripStatus === 'completed' && (
          <ModernCompletedTripCard
            distance={Math.round(distance)}
            duration={duration}
            onStartNew={startNewJourney}
          />
        )}
      </div>
    </div>
  );
};
