import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from "@/components/ReusableUI";
import JourneyMap, { JourneyMapRef } from '@/components/journey-map';
import { useLocation } from "wouter";

import {
  ModernJourneyHeader,
  ModernTripPlanningCard,
  ModernActiveTripCard,
  ModernCompletedTripCard,
  ModernMessageCard
} from '@/components/ReusableUI';

/* Radar Web SDK */
import Radar from 'radar-sdk-js';
import 'radar-sdk-js/dist/radar.css';

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

/* ===============================
   Minimal Radar helpers (Web SDK)
   =============================== */

let RADAR_INITIALIZED = false;

function ensureRadarInitialized() {
  if (RADAR_INITIALIZED) return;
  const pk = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY as string;
  if (!pk) throw new Error("VITE_RADAR_PUBLISHABLE_KEY missing");
  Radar.initialize(pk);
  RADAR_INITIALIZED = true;
}

async function radarStartTrip(options: {
  externalId: string;
  destinationGeofenceTag?: string;
  destinationGeofenceExternalId?: string;
  mode?: "foot" | "bike" | "car";
  metadata?: Record<string, any>;
}) {
  ensureRadarInitialized();
  const result = await Radar.startTrip(options as any);
  return result;
}

async function radarUpdateTrip(options: {
  destinationGeofenceTag?: string;
  destinationGeofenceExternalId?: string;
  mode?: "foot" | "bike" | "car";
  metadata?: Record<string, any>;
}) {
  ensureRadarInitialized();
  const result = await Radar.updateTrip(options as any);
  return result;
}

const toDealerExternalId = (id?: string) =>
  id?.startsWith('dealer:') ? id : `dealer:${id}`;

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
  const userId = user?.id;

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
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
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get selected PJP from navigation state (wouter)
  const selectedPJP = (location as any).state?.selectedPJP;

  // --- New useEffect to handle navigation state from HomePage ---
  useEffect(() => {
    if (selectedPJP) {
      const dealer = {
        id: selectedPJP.areaToBeVisited,
        name: selectedPJP.dealerName,
        address: selectedPJP.dealerAddress,
        latitude: selectedPJP.dealerLatitude,
        longitude: selectedPJP.dealerLongitude,
      };
      setSelectedDealer(dealer);
    }
  }, [selectedPJP]);


  useEffect(() => {
    try {
      ensureRadarInitialized();
      if (userId) {
        Radar.setUserId(String(userId));
      }
    } catch (e) {
      setError((e as Error).message || 'Radar init failed');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const fetchDealers = async () => {
      try {
        const response = await fetch(`/api/dealers/user/${userId}`);
        const data = await response.json();
        if (data.success) setDealers(data.data || []);
      } catch {
        setError('Failed to load dealers');
      }
    };
    fetchDealers();
  }, [userId]);

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address: 'Current Location'
      };

      setCurrentLocation(location);

      if (mapRef.current) {
        mapRef.current.setView(location.lat, location.lng, 15);
      }
    } catch (err) {
      setError('Unable to get location. Please enable GPS.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const startTrip = async () => {
    if (!currentLocation || !selectedDealer || !userId) {
      setError('Please select location and destination');
      return;
    }

    try {
      const { trip } = await radarStartTrip({
        externalId: `${userId}-${Date.now()}`,
        destinationGeofenceTag: "dealer",
        destinationGeofenceExternalId: toDealerExternalId(selectedDealer.id),

        mode: "car",
        metadata: {
          originLatitude: currentLocation.lat,
          originLongitude: currentLocation.lng
        }
      });

      const response = await fetch('/api/geo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dealerId: selectedDealer.id,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          radarTripId: trip._id
        })
      });

      const data = await response.json();
      if (data.success) {
        setActiveTripData({
          journeyId: trip._id,
          dbJourneyId: data.data.dbJourneyId,
          dealer: selectedDealer,
          radarTrip: trip
        });
        setTripStatus('active');
        setSuccess('Journey started! 🚗');
        startLocationTracking(trip._id);
      } else {
        setError(data.error || 'Failed to start trip');
      }
    } catch (err: any) {
      console.error('Start trip error:', err);
      setError(`Failed to start trip: ${err.message}`);
    }
  };

  const startLocationTracking = (journeyId: string) => {
    trackingIntervalRef.current = setInterval(async () => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          });
        });

        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        if (!activeTripData) {
          console.warn('Tracking attempted but no active trip data found.');
          return;
        }
        await Radar.trackOnce({
          latitude: newLocation.lat,
          longitude: newLocation.lng,
          tripOptions: {
            externalId: activeTripData.radarTrip.externalId
          }
        });

        setCurrentLocation(newLocation);

        try {
          const routeData = await radarGetTripRouteViaBackend(journeyId);

          if (routeData.distance && routeData.duration) {
            setDistance(routeData.distance.value || 0);
            setDuration(routeData.duration.value || 0);
          }

          if (routeData.geometry && routeData.geometry.coordinates) {
            const polylinePoints = routeData.geometry.coordinates.map((coord: any) => [
              coord[1],
              coord[0]
            ]);
            setRoutePolyline(polylinePoints);
          }
        } catch (routeErr) {
          console.warn('Route fetch failed:', routeErr);
        }

        const response = await fetch(`/api/geo/trips/${journeyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.radarTrip) {
            const trip = data.data.radarTrip;
            if (trip.distance && trip.duration) {
              setDistance(trip.distance.value || 0);
              setDuration(trip.duration.value || 0);
            }
          }
        }
      } catch (err) {
        console.error('Tracking error:', err);
      }
    }, 8000);
  };

  const changeDestination = async (newDealerId: string) => {
    if (!activeTripData) return;

    try {
      const { trip } = await radarUpdateTrip({
        destinationGeofenceExternalId: toDealerExternalId(newDealerId)
      });

      const response = await fetch(`/api/geo/trips/${activeTripData.journeyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationGeofenceExternalId: newDealerId,
          status: "destination_updated"
        })
      });

      const data = await response.json();
      if (data.success) {
        const newDealer = dealers.find(d => d.id === newDealerId);
        if (newDealer) {
          setSelectedDealer(newDealer);
          setActiveTripData(prev => prev ? {
            ...prev,
            dealer: newDealer,
            radarTrip: trip
          } : null);
          setSuccess('Destination updated! 🎯');
          setShowDestinationChange(false);
          setRoutePolyline([]);
        }
      } else {
        setError(data.error || 'Failed to update');
      }
    } catch (err: any) {
      console.error('Change destination error:', err);
      setError(`Failed to change destination: ${err.message}`);
    }
  };

  const completeTrip = async () => {
    if (!activeTripData) return;

    try {
      const response = await fetch(`/api/geo/finish/${activeTripData.journeyId}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        setTripStatus('completed');
        setSuccess('Journey completed! 🎉');

        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current);
          trackingIntervalRef.current = null;
        }

        try {
          ensureRadarInitialized();
          await Radar.completeTrip();
        } catch {
          // non-fatal
        }
      } else {
        setError('Failed to complete trip');
      }
    } catch (err) {
      setError('Failed to complete trip');
    }
  };

  const startNewJourney = () => {
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
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  useEffect(() => {
    getCurrentLocation();

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
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
          <ModernTripPlanningCard
            currentLocation={currentLocation?.address}
            selectedDealer={selectedDealer}
            dealers={dealers}
            isLoadingLocation={isLoadingLocation}
            onGetCurrentLocation={getCurrentLocation}
            onDealerSelect={(dealerId) => {
              const dealer = dealers.find(d => d.id === dealerId);
              setSelectedDealer(dealer || null);
            }}
            onStartTrip={startTrip}
          />
        )}

        {tripStatus === 'active' && activeTripData && (
          <ModernActiveTripCard
            dealer={activeTripData.dealer}
            distance={distance}
            duration={duration}
            onChangeDestination={() => setShowDestinationChange(true)}
            onCompleteTrip={completeTrip}
            showDestinationChange={showDestinationChange}
            dealers={dealers}
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