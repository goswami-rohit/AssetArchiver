// src/pages/JourneyTracker.tsx - FIXED to use global user
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from "@/components/ReusableUI";
import JourneyMap, { JourneyMapRef } from '@/components/journey-map';


import { 
  ModernJourneyHeader,
  ModernTripPlanningCard,
  ModernActiveTripCard,
  ModernCompletedTripCard,
  ModernMessageCard
} from '@/components/ReusableUI';

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

export default function JourneyTracker({ onBack }: { onBack?: () => void }) {
  // 👇 global user from Zustand
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

  // Fetch dealers only when userId is ready
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


  // Get current location
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

  // Start trip
  const startTrip = async () => {
    if (!currentLocation || !selectedDealer) {
      setError('Please select location and destination');
      return;
    }

    try {
      const response = await fetch('/api/geo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dealerId: selectedDealer.id,
          lat: currentLocation.lat,
          lng: currentLocation.lng
        })
      });

      const data = await response.json();
      if (data.success) {
        setActiveTripData({
          journeyId: data.data.radarTrip._id,
          dbJourneyId: data.data.dbJourneyId,
          dealer: data.data.dealer,
          radarTrip: data.data.radarTrip
        });
        setTripStatus('active');
        setSuccess('Journey started! 🚗');
        startLocationTracking(data.data.radarTrip._id);
      } else {
        setError(data.error || 'Failed to start trip');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  // Location tracking every 27 seconds
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

        setCurrentLocation(newLocation);

        // Fetch updated trip data
        const response = await fetch(`/api/geo/trips/${journeyId}`);
        const data = await response.json();

        if (data.success) {
          const trip = data.data.radarTrip;

          if (trip.distance && trip.duration) {
            setDistance(trip.distance.value || 0);
            setDuration(trip.duration.value || 0);
          }

          if (trip.locations && trip.locations.length > 0) {
            const polylinePoints = trip.locations.map((loc: any) => [
              loc.coordinates[1],
              loc.coordinates[0]
            ]);
            setRoutePolyline(polylinePoints);
          }
        }
      } catch (err) {
        console.error('Tracking error:', err);
      }
    }, 27000);
  };

  // Change destination
  const changeDestination = async (newDealerId: string) => {
    if (!activeTripData) return;

    try {
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
            radarTrip: data.data
          } : null);
          setSuccess('Destination updated! 🎯');
          setShowDestinationChange(false);
          setRoutePolyline([]);
        }
      } else {
        setError(data.error || 'Failed to update');
      }
    } catch (err) {
      setError('Failed to change destination');
    }
  };

  // Complete trip
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
      } else {
        setError('Failed to complete trip');
      }
    } catch (err) {
      setError('Failed to complete trip');
    }
  };

  // Reset for new journey
  const startNewJourney = () => {
    setTripStatus('idle');
    setActiveTripData(null);
    setSelectedDealer(null);
    setDistance(0);
    setDuration(0);
    setRoutePolyline([]);
    setShowDestinationChange(false);
  };

  // Auto-hide messages
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Initialize
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
      {/* Header */}
      <ModernJourneyHeader status={tripStatus} onBack={onBack} />

      {/* Messages */}
      {success && <ModernMessageCard type="success" message={success} />}
      {error && <ModernMessageCard type="error" message={error} />}

      {/* Main Content - Clean Layout */}
      <div className="container max-w-md mx-auto p-4 space-y-4">
        {/* Contained Map */}
        <JourneyMap
          ref={mapRef}
          currentLocation={currentLocation}
          selectedDealer={selectedDealer}
          routePolyline={routePolyline}
          className="w-full"
        />

        {/* Trip UI Cards */}
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