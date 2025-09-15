import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from "@/components/ReusableUI";
import JourneyMap, { JourneyMapRef } from '@/components/journey-map';
import { useLocation } from "wouter";
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

// New PJP type, including enriched dealer info from HomePage
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
  
  // State to hold the list of PJPs instead of dealers
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
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedPJP = (location as any).state?.selectedPJP;

  // useEffect to handle navigation state from HomePage
  useEffect(() => {
    // If a PJP is pre-selected, set the dealer details and bypass the dropdown
    if (selectedPJP && selectedPJP.dealerName) {
      const dealer: Dealer = {
        id: selectedPJP.areaToBeVisited,
        name: selectedPJP.dealerName,
        address: selectedPJP.dealerAddress,
        latitude: selectedPJP.dealerLatitude || 0, // Provide a default value
        longitude: selectedPJP.dealerLongitude || 0, // Provide a default value
      };
      setSelectedDealer(dealer);
      // Set the trip status to idle but with a selected dealer
      setTripStatus('idle');
    }
  }, [selectedPJP]);

  // New useEffect to fetch PJPs from the backend
  useEffect(() => {
    if (!userId) return;
    const fetchPJPs = async () => {
      try {
        const pjpUrl = `${BASE_URL}/api/pjp/user/${userId}`;
        const pjpResponse = await fetch(pjpUrl);
        const pjpResult = await pjpResponse.json();

        if (pjpResponse.ok && pjpResult.success) {
          const pjps: PJP[] = pjpResult.data;

          const dealerIds = Array.from(new Set(pjps.map((p: PJP) => p.areaToBeVisited)));

          if (dealerIds.length > 0) {
            const dealerPromises = dealerIds.map(id =>
              fetch(`${BASE_URL}/api/dealers/${id}`).then(res => res.json())
            );
            const dealerResults = await Promise.all(dealerPromises);

            const dealersMap = new Map<string, Dealer>();
            dealerResults.forEach(res => {
              if (res.success) {
                dealersMap.set(res.data.id, res.data);
              }
            });

            const enrichedPjps = pjps.map((p: PJP) => {
               const dealerInfo = dealersMap.get(p.areaToBeVisited);
              return {
                ...p,
                dealerName: dealerInfo?.name || 'Unknown Dealer',
                dealerAddress: dealerInfo?.address || 'Location TBD',
                dealerLatitude: dealerInfo?.latitude,
                dealerLongitude: dealerInfo?.longitude,
              };
            });
            setPjps(enrichedPjps);
          } else {
            setPjps([]);
          }
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
      setError('Please select a destination');
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

  const changeDestination = async (newPjpId: string) => {
    if (!activeTripData) return;

    try {
      const { trip } = await radarUpdateTrip({
        destinationGeofenceExternalId: toDealerExternalId(newPjpId)
      });

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
            latitude: newPjp.dealerLatitude || 0, // Provide a default value
            longitude: newPjp.dealerLongitude || 0, // Provide a default value
          };
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

        {/* Conditional rendering for the initial idle state */}
        {tripStatus === 'idle' && (
          selectedDealer ? (
            // New card to display pre-selected PJP and start button
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
            // Original card for manual PJP selection
            <ModernTripPlanningCard
              currentLocation={currentLocation?.address}
              selectedDealer={selectedDealer}
              // Pass the enriched PJPs to the component
              dealers={pjps.map(pjp => ({
                id: pjp.areaToBeVisited, // Use areaToBeVisited as the unique ID
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
            // Pass the PJPs here too for the change destination dropdown
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