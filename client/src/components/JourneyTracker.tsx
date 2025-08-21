import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Square, MapPin, Clock, Navigation, Pause, Play, ArrowLeft,
  Users, CheckCircle, AlertCircle, Battery, Wifi, MoreHorizontal,
  Target, Route, Store, TrendingUp, Camera, Share, Heart,
  Zap, Signal, Smartphone, Activity, Eye, Settings, X
} from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
  onBack?: () => void;
  onJourneyEnd: () => void;
}

interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

interface JourneyData {
  id: string;
  startTime: string;
  duration: string;
  totalDistance: string;
  trackingPoints: number;
  activeCheckins: number;
  status: 'active' | 'paused';
}

interface DealerCheckIn {
  id: string;
  dealerName: string;
  checkInTime: string;
  location: string;
}

interface GeoTrackingEntry {
  id: string;
  userId: number;
  checkInTime: string;
  checkOutTime?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  notes?: string;
}

interface OfficeGeofence {
  _id: string;
  description: string;
  geometryRadius: number;
  geometryCenter: {
    coordinates: [number, number];
  };
  metadata: {
    companyName: string;
    region?: string;
    area?: string;
  };
  address?: string;
}

interface GeofenceSettings {
  companyId: number | null;
  officeGeofence: OfficeGeofence | null;
  isSetupRequired: boolean;
  currentAddress: string;
  officeAddress: string;
}

interface AddressData {
  formatted: string;
  street?: string;
  city?: string;
  country?: string;
}

interface GeofenceValidationResult {
  isInside: boolean;
  distance: number;
  message: string;
}

interface GeofenceEvent {
  id: string;
  type: 'entry' | 'exit';
  timestamp: string;
  location: string;
}

export default function JourneyTracker({ userId, onBack, onJourneyEnd }: JourneyTrackerProps) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [activeJourney, setActiveJourney] = useState<JourneyData | null>(null);
  const [dealerCheckins, setDealerCheckins] = useState<DealerCheckIn[]>([]);
  const [trackingMode, setTrackingMode] = useState<'conservative' | 'balanced' | 'precise'>('balanced');
  const [journeyWakeLock, setJourneyWakeLock] = useState<WakeLockSentinel | null>(null);
  const [geoTrackingHistory, setGeoTrackingHistory] = useState<GeoTrackingEntry[]>([]);

  // Battery & Network Status
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  // UI State
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Enhanced Address and Geofence State
  const [showSettings, setShowSettings] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>('Getting location...');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [officeSetupMode, setOfficeSetupMode] = useState<'current' | 'address'>('current');
  const [addressInput, setAddressInput] = useState('');
  const [realtimeValidation, setRealtimeValidation] = useState<GeofenceValidationResult | null>(null);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);

  const [geofenceSettings, setGeofenceSettings] = useState<GeofenceSettings>({
    companyId: null,
    officeGeofence: null,
    isSetupRequired: false,
    currentAddress: '',
    officeAddress: ''
  });

  const [officeValidation, setOfficeValidation] = useState<{
    isValidating: boolean;
    result: any;
  } | null>(null);

  // 🔋 BATTERY OPTIMIZED LOCATION OPTIONS
  const getLocationOptions = useCallback(() => {
    const options = {
      conservative: {
        enableHighAccuracy: false,
        maximumAge: 300000, // 5 minutes
        timeout: 30000,
        distanceFilter: 200 // 200 meters
      },
      balanced: {
        enableHighAccuracy: false,
        maximumAge: 120000, // 2 minutes
        timeout: 20000,
        distanceFilter: 50 // 50 meters
      },
      precise: {
        enableHighAccuracy: true,
        maximumAge: 30000, // 30 seconds
        timeout: 15000,
        distanceFilter: 10 // 10 meters
      }
    };
    return options[trackingMode];
  }, [trackingMode]);

  // One-shot geolocation, wrapped as a Promise to guarantee the system prompt
  const getGeoPositionOnce = (opts: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
    });

  // 🚀 INITIALIZE - CHECK FOR ACTIVE JOURNEY
  useEffect(() => {
    initializeJourneyTracker();
    setupBatteryMonitoring();
    getCurrentLocation();
    checkOfficeGeofenceStatus();

    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
      if (journeyWakeLock) {
        journeyWakeLock.release();
      }
    };
  }, [userId]);

  // Enhanced address resolution
  const resolveCurrentAddress = useCallback(async (lat: number, lng: number) => {
    if (isResolvingAddress) return;

    setIsResolvingAddress(true);
    try {
      const response = await fetch('/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng
        })
      });

      const data = await response.json();
      if (data.success && data.address) {
        const formattedAddress = data.address.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setCurrentAddress(formattedAddress);

        // Update geofence settings with current address
        setGeofenceSettings(prev => ({
          ...prev,
          currentAddress: formattedAddress
        }));
      } else {
        const coordsString = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setCurrentAddress(coordsString);
      }
    } catch (error) {
      console.error('Address resolution failed:', error);
      const coordsString = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setCurrentAddress(coordsString);
    } finally {
      setIsResolvingAddress(false);
    }
  }, [isResolvingAddress]);

  // Convert address to coordinates
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const response = await fetch('/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      const data = await response.json();
      if (data.success) {
        return {
          lat: data.latitude,
          lng: data.longitude
        };
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      setErrorMessage('Failed to find address coordinates');
    }
    return null;
  };

  // Real-time location validation
  const validateLocationRealtime = useCallback(async (lat: number, lng: number) => {
    if (!geofenceSettings.companyId || !geofenceSettings.officeGeofence) return;

    try {
      const response = await fetch('/validate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: geofenceSettings.companyId,
          latitude: lat,
          longitude: lng
        })
      });

      const data = await response.json();
      if (data.success) {
        const newValidation = data.data;

        // Check for geofence entry/exit events
        if (realtimeValidation && realtimeValidation.isInside !== newValidation.isInside) {
          const event: GeofenceEvent = {
            id: Date.now().toString(),
            type: newValidation.isInside ? 'entry' : 'exit',
            timestamp: new Date().toLocaleTimeString(),
            location: currentAddress
          };

          setGeofenceEvents(prev => [event, ...prev.slice(0, 9)]); // Keep last 10 events

          setSuccessMessage(
            newValidation.isInside
              ? '🏢 Entered office area'
              : '🚗 Left office area'
          );
        }

        setRealtimeValidation(newValidation);
      }
    } catch (error) {
      console.error('Real-time validation failed:', error);
    }
  }, [geofenceSettings.companyId, geofenceSettings.officeGeofence, realtimeValidation, currentAddress]);

  // Check office geofence status on initialization
  const checkOfficeGeofenceStatus = async () => {
    try {
      // First, get user's companyId from database
      const userResponse = await fetch(`/api/users/${userId}`);
      const userData = await userResponse.json();

      if (!userData.success) {
        console.error('Failed to fetch user data:', userData.error);
        return;
      }

      const companyId = userData.data.companyId;

      // Now check if office geofence exists for this company
      const response = await fetch(`/api/office/${companyId}`);
      const data = await response.json();

      if (data?.success && data?.data) {
        const { address, lat, lng } = data.data;

        setGeofenceSettings({
          companyId,
          officeGeofence: {
            _id: 'local-office',
            description: 'Company Office',
            geometryRadius: 100,
            geometryCenter: {
              // keep the [lng, lat] ordering your map code expects
              coordinates: [lng, lat],
            },
            metadata: { companyName: '', region: '', area: '' },
            address,
          },
          isSetupRequired: false,
          currentAddress: '',
          officeAddress: address || '',
        });
      } else {
        setGeofenceSettings({
          companyId,
          officeGeofence: null,
          isSetupRequired: true,
          currentAddress: '',
          officeAddress: '',
        });
      }
    } catch (error) {
      console.error('Office geofence check failed:', error);
      setGeofenceSettings({
        companyId: null,
        officeGeofence: null,
        isSetupRequired: true,
        currentAddress: '',
        officeAddress: '',
      });
    }
  };


  // Enhanced office geofence creation with address support
  const handleCreateOfficeGeofence = async (useAddress = false) => {
    if (!geofenceSettings.companyId) return;

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let lat: number;
      let lng: number;
      let addressForSave = currentAddress;

      if (useAddress) {
        if (!addressInput.trim()) {
          setErrorMessage("Please enter an address");
          return;
        }
        // Forward geocode via Radar (your backend endpoint)
        const coords = await geocodeAddress(addressInput.trim());
        if (!coords) {
          setErrorMessage("Could not find coordinates for the provided address");
          return;
        }
        lat = coords.lat;
        lng = coords.lng;

        // Best-effort: normalize to formatted from reverse-geocode
        try {
          const r = await fetch("/reverse-geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng })
          });
          const j = await r.json();
          if (j?.success && j?.address?.formatted) addressForSave = j.address.formatted;
        } catch { }
      } else {
        // Force the browser location prompt on click
        const pos = await getGeoPositionOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;

        // Update UI and resolve a nice address via Radar
        setCurrentLocation({
          lat,
          lng,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0,
          altitude: pos.coords.altitude || 0
        });
        await resolveCurrentAddress(lat, lng); // updates currentAddress via /reverse-geocode
        addressForSave = currentAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }

      // Save to Neon via your new endpoint
      const res = await fetch(useAddress ? "/api/office/set-address" : "/api/office/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useAddress
            ? { companyId: geofenceSettings.companyId, address: addressInput.trim() }
            : { companyId: geofenceSettings.companyId, latitude: lat, longitude: lng, address: addressForSave }
        )
      });

      const data = await res.json();

      if (data?.success && data?.data) {
        const { address, lat: savedLat, lng: savedLng } = data.data;

        setGeofenceSettings(prev => ({
          ...prev,
          officeGeofence: {
            _id: "local-office",
            description: "Company Office",
            geometryRadius: 100,
            geometryCenter: { coordinates: [savedLng, savedLat] }, // [lng, lat]
            metadata: { companyName: "", region: "", area: "" },
            address
          },
          isSetupRequired: false,
          officeAddress: address || addressForSave
        }));

        setSuccessMessage("✅ Office geofence created successfully!");
        setAddressInput("");
      } else {
        setErrorMessage(data?.error || "Failed to create office geofence");
      }
    } catch (err: any) {
      // Location denied or other error
      if (err?.code === 1 /* PERMISSION_DENIED */) {
        setErrorMessage("Location permission denied. Enable location to set office by current position.");
      } else {
        setErrorMessage(err?.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };


  // Delete office geofence
  const handleDeleteOfficeGeofence = async () => {
    if (!geofenceSettings.companyId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/office/${geofenceSettings.companyId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setGeofenceSettings(prev => ({
          ...prev,
          officeGeofence: null,
          isSetupRequired: true,
          officeAddress: ''
        }));
        setSuccessMessage('Office geofence deleted successfully');
        setRealtimeValidation(null);
      } else {
        setErrorMessage(data.error || 'Failed to delete office geofence');
      }
    } catch (error) {
      setErrorMessage('Network error: Failed to delete office geofence');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate current location against office
  const handleValidateOfficeLocation = async () => {
    if (!currentLocation || !geofenceSettings.companyId) return;

    setOfficeValidation({ isValidating: true, result: null });

    try {
      const response = await fetch('/validate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: geofenceSettings.companyId,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        })
      });

      const data = await response.json();
      if (data.success) {
        setOfficeValidation({ isValidating: false, result: data.data });
      } else {
        setErrorMessage(data.error || 'Location validation failed');
        setOfficeValidation({ isValidating: false, result: null });
      }
    } catch (error) {
      setErrorMessage('Network error: Location validation failed');
      setOfficeValidation({ isValidating: false, result: null });
    }
  };

  // 📍 GET CURRENT LOCATION
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
            altitude: position.coords.altitude || 0
          };

          setCurrentLocation(newLocation);

          // Resolve address for current location
          await resolveCurrentAddress(newLocation.lat, newLocation.lng);
        },
        (error) => {
          console.error('Location error:', error);
          setErrorMessage('Location access denied. Please enable GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  };

  // 🔍 INITIALIZE JOURNEY TRACKER - FETCH USER TRACKING DATA
  const initializeJourneyTracker = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/geo-tracking/user/${userId}?dateFrom=${today}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        setGeoTrackingHistory(data.data);

        // Check if there's an active journey (no checkout time)
        const activeGeoTracking = data.data.find((track: GeoTrackingEntry) => !track.checkOutTime);

        if (activeGeoTracking) {
          const duration = calculateDuration(activeGeoTracking.checkInTime);
          const distance = calculateTotalDistance(data.data);

          setActiveJourney({
            id: activeGeoTracking.id,
            startTime: activeGeoTracking.checkInTime,
            duration,
            totalDistance: `${distance.toFixed(3)} km`,
            trackingPoints: data.data.length,
            activeCheckins: data.data.filter((track: GeoTrackingEntry) => track.checkOutTime).length,
            status: 'active'
          });

          setSuccessMessage('Resumed active journey');
          startLocationTracking();
        } else {
          setSuccessMessage('Ready to start new journey');
        }
      } else {
        setSuccessMessage('No previous journeys found');
      }
    } catch (error) {
      console.error('Error checking active journey:', error);
      setErrorMessage('Failed to load journey data');
    } finally {
      setIsLoading(false);
    }
  };

  // 📏 CALCULATE TOTAL DISTANCE FROM TRACKING POINTS
  const calculateTotalDistance = (trackingData: GeoTrackingEntry[]): number => {
    if (trackingData.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < trackingData.length; i++) {
      const prev = trackingData[i - 1];
      const curr = trackingData[i];

      // Haversine formula for distance calculation
      const R = 6371; // Earth's radius in km
      const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;
    }

    return totalDistance;
  };

  // ⏱️ CALCULATE DURATION HELPER
  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // 🌍 START LOCATION TRACKING WITH BATTERY OPTIMIZATION
  const startLocationTracking = useCallback(() => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }

    const options = getLocationOptions();

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const newLocation: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          heading: position.coords.heading || 0,
          altitude: position.coords.altitude || 0
        };

        setCurrentLocation(newLocation);
        setLastUpdate(new Date());

        // Auto-adjust tracking mode based on speed
        autoAdjustTrackingMode(newLocation.speed || 0);

        // Resolve address for current location
        await resolveCurrentAddress(newLocation.lat, newLocation.lng);

        // Real-time geofence validation during active journey
        if (activeJourney && geofenceSettings.officeGeofence) {
          await validateLocationRealtime(newLocation.lat, newLocation.lng);
        }

        // Update active journey stats if available
        if (activeJourney) {
          setActiveJourney(prev => prev ? {
            ...prev,
            duration: calculateDuration(prev.startTime),
            trackingPoints: prev.trackingPoints + 1
          } : null);
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
        setErrorMessage(`Location error: ${error.message}`);
      },
      options
    );

    setLocationWatchId(watchId);
  }, [activeJourney, trackingMode, getLocationOptions, resolveCurrentAddress, validateLocationRealtime, geofenceSettings.officeGeofence]);

  // 🎯 AUTO-ADJUST TRACKING MODE BASED ON SPEED
  const autoAdjustTrackingMode = (speed: number) => {
    const speedKmh = speed * 3.6; // Convert m/s to km/h

    let newMode: 'conservative' | 'balanced' | 'precise' = 'conservative';
    if (speedKmh > 30) newMode = 'precise'; // Fast movement
    else if (speedKmh > 5) newMode = 'balanced'; // Walking/slow driving

    if (newMode !== trackingMode) {
      setTrackingMode(newMode);
    }
  };

  // 🏁 START NEW JOURNEY - GEO-TRACKING CHECK-IN
  const handleStartJourney = async () => {
    if (!currentLocation) {
      setErrorMessage('Please enable location services');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // Request wake lock
    let wakeLock = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        setJourneyWakeLock(wakeLock);
      }
    } catch (wakeLockError) {
      console.log('Wake lock not available, continuing without it');
    }

    try {
      const checkInData = {
        userId,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        accuracy: currentLocation.accuracy || 10,
        speed: currentLocation.speed || 0,
        heading: currentLocation.heading || 0,
        altitude: currentLocation.altitude || 0,
        notes: `Journey started via PWA tracker at ${new Date().toLocaleTimeString()}`
      };

      const response = await fetch('/api/geo-tracking/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData)
      });

      const data = await response.json();

      if (data.success && data.data) {
        setActiveJourney({
          id: data.data.id,
          startTime: data.data.checkInTime,
          duration: '0m',
          totalDistance: '0.000 km',
          trackingPoints: 1,
          activeCheckins: 1,
          status: 'active'
        });

        // Add to tracking history
        setGeoTrackingHistory(prev => [...prev, data.data]);

        startLocationTracking();
        setSuccessMessage('🚀 Journey started successfully!');
        setErrorMessage('');
      } else {
        if (wakeLock) {
          wakeLock.release();
          setJourneyWakeLock(null);
        }
        setErrorMessage(data.error || 'Failed to start journey');
      }
    } catch (error) {
      if (wakeLock) {
        wakeLock.release();
        setJourneyWakeLock(null);
      }
      console.error('Error starting journey:', error);
      setErrorMessage('Network error: Failed to start journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔚 END JOURNEY - GEO-TRACKING CHECK-OUT
  const handleEndJourney = async () => {
    if (!activeJourney) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const checkOutData = {
        userId,
        trackingId: activeJourney.id,
        latitude: currentLocation?.lat || 0,
        longitude: currentLocation?.lng || 0,
        notes: `Journey completed via PWA tracker. Duration: ${activeJourney.duration}, Check-ins: ${dealerCheckins.length}`
      };

      const response = await fetch('/api/geo-tracking/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkOutData)
      });

      const data = await response.json();

      if (data.success) {
        // Release wake lock
        if (journeyWakeLock) {
          try {
            journeyWakeLock.release();
            setJourneyWakeLock(null);
          } catch (wakeLockError) {
            console.log('Wake lock release failed, continuing normally');
          }
        }

        // Stop location tracking
        if (locationWatchId) {
          navigator.geolocation.clearWatch(locationWatchId);
          setLocationWatchId(null);
        }

        // Show success message
        const duration = activeJourney.startTime ? calculateDuration(activeJourney.startTime) : '0m';
        setSuccessMessage(`🎉 Journey Complete! Duration: ${duration}, Check-ins: ${dealerCheckins.length}`);

        // Reset state
        setActiveJourney(null);
        setDealerCheckins([]);
        setErrorMessage('');

        // Refresh journey data
        setTimeout(() => {
          initializeJourneyTracker();
          onJourneyEnd();
        }, 2000);

      } else {
        setErrorMessage(data.error || 'Failed to end journey');
      }
    } catch (error) {
      console.error('Error ending journey:', error);
      setErrorMessage('Network error: Failed to end journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔋 SETUP BATTERY MONITORING
  const setupBatteryMonitoring = () => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    window.addEventListener('online', () => setNetworkStatus('online'));
    window.addEventListener('offline', () => setNetworkStatus('offline'));
  };

  // 📱 QUICK DEALER CHECK-IN
  const handleQuickCheckIn = async () => {
    if (!activeJourney || !currentLocation) {
      setErrorMessage('No active journey or location unavailable');
      return;
    }

    try {
      // This would integrate with your dealer check-in endpoints
      // For now, we'll add a mock check-in
      const newCheckIn: DealerCheckIn = {
        id: Date.now().toString(),
        dealerName: `Dealer ${dealerCheckins.length + 1}`,
        checkInTime: new Date().toLocaleTimeString(),
        location: currentAddress
      };

      setDealerCheckins(prev => [...prev, newCheckIn]);
      setActiveJourney(prev => prev ? { ...prev, activeCheckins: prev.activeCheckins + 1 } : null);
      setSuccessMessage('✅ Quick check-in recorded');
    } catch (error) {
      setErrorMessage('Failed to record check-in');
    }
  };

  // Loading state
  if (isLoading && !activeJourney) {
    return (
      <div className="h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Navigation className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">Loading journey tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col">
      {/* 🎨 INSTAGRAM-STYLE HEADER */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="p-1 hover:bg-gray-100 rounded-full"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 text-white">
                  <Navigation className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-lg">Journey Tracker</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${networkStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>GPS Tracking • {batteryLevel}%</span>
                  {geofenceSettings.officeGeofence && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600">Office Ready</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="p-2 rounded-full"
                onClick={() => setShowSettings(true)}
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 rounded-full" data-testid="button-more">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mx-4 mt-4 p-3 bg-green-100 border border-green-300 rounded-xl" data-testid="message-success">
            <p className="text-green-700 text-sm text-center">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mt-4 p-3 bg-red-100 border border-red-300 rounded-xl" data-testid="message-error">
            <p className="text-red-700 text-sm text-center">{errorMessage}</p>
          </div>
        )}

        {!activeJourney ? (
          // 🌟 START JOURNEY SCREEN
          <div className="p-6">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl">
                <Route className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ready to Journey?
              </h2>
              <p className="text-gray-600 text-lg">Start tracking your field visits</p>
            </div>

            {/* Enhanced Location Status */}
            {currentLocation ? (
              <Card className="mb-6 bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Current Location</h3>
                        <div className="space-y-1">
                          {/* Show readable address first */}
                          <p className="text-sm text-gray-800 font-medium" data-testid="text-current-address">
                            {isResolvingAddress ? (
                              <span className="flex items-center space-x-2">
                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <span>Resolving address...</span>
                              </span>
                            ) : (
                              currentAddress
                            )}
                          </p>
                          {/* Show coordinates as secondary info */}
                          <p className="text-xs text-gray-500" data-testid="text-coordinates">
                            {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                          </p>
                          {currentLocation.speed && currentLocation.speed > 0 && (
                            <p className="text-xs text-gray-500" data-testid="text-speed">
                              Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge className="bg-green-100 text-green-800 border-green-300" data-testid="badge-accuracy">
                        <Signal className="w-3 h-3 mr-1" />
                        {currentLocation.accuracy?.toFixed(0)}m
                      </Badge>

                      {/* Geofence status indicator */}
                      {realtimeValidation && (
                        <Badge className={`${realtimeValidation.isInside
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-orange-100 text-orange-800 border-orange-300'
                          }`} data-testid="badge-geofence-status">
                          {realtimeValidation.isInside ? '🏢 At Office' : '🚗 Outside'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Real-time distance to office */}
                  {realtimeValidation && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Distance to office:</span>
                        <span className="font-medium text-gray-900" data-testid="text-office-distance">
                          {realtimeValidation.distance}m
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-6 bg-orange-50/60 backdrop-blur-sm border border-orange-200/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Getting Location...</h3>
                        <p className="text-sm text-gray-600">Please enable GPS access</p>
                      </div>
                    </div>
                    <Button
                      onClick={getCurrentLocation}
                      size="sm"
                      variant="outline"
                      className="border-orange-300"
                      data-testid="button-retry-location"
                    >
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Journey History Summary */}
            {geoTrackingHistory.length > 0 && (
              <Card className="mb-6 bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Today's Activity</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-blue-600" data-testid="text-tracking-points">{geoTrackingHistory.length}</div>
                      <div className="text-xs text-gray-600">Tracking Points</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-purple-600" data-testid="text-total-distance">
                        {calculateTotalDistance(geoTrackingHistory).toFixed(1)}km
                      </div>
                      <div className="text-xs text-gray-600">Distance</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-pink-600" data-testid="text-completed-journeys">
                        {geoTrackingHistory.filter(h => h.checkOutTime).length}
                      </div>
                      <div className="text-xs text-gray-600">Completed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card className="bg-white/60 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4 text-center">
                  <Battery className={`w-6 h-6 mx-auto mb-2 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium" data-testid="text-battery-level">{batteryLevel}% Battery</p>
                </CardContent>
              </Card>
              <Card className="bg-white/60 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4 text-center">
                  <Wifi className={`w-6 h-6 mx-auto mb-2 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium" data-testid="text-network-status">{networkStatus === 'online' ? 'Online' : 'Offline'}</p>
                </CardContent>
              </Card>
            </div>

            {/* Start Button */}
            <Button
              onClick={handleStartJourney}
              disabled={!currentLocation || isLoading}
              className="w-full h-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-3xl shadow-2xl transform transition-all duration-200 hover:scale-105"
              data-testid="button-start-journey"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Starting Journey...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Play className="w-6 h-6" />
                  <span>Start Journey</span>
                </div>
              )}
            </Button>
          </div>
        ) : (
          // 🎯 ACTIVE JOURNEY SCREEN
          <div className="p-6 space-y-6">
            {/* Journey Status Story */}
            <Card className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 text-white shadow-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Navigation className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Journey Active</h3>
                      <p className="text-white/80">Live GPS Tracking</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {activeJourney.status === 'active' && (
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    )}
                    <Badge className="bg-white/20 text-white border-white/30" data-testid="badge-tracking-mode">
                      {trackingMode}
                    </Badge>
                  </div>
                </div>

                {/* Live Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold" data-testid="text-journey-duration">
                      ⏱️ {activeJourney.startTime ? calculateDuration(activeJourney.startTime) : '0m'}
                    </div>
                    <div className="text-white/80 text-sm">Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" data-testid="text-journey-distance">📍 {activeJourney.totalDistance}</div>
                    <div className="text-white/80 text-sm">Distance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" data-testid="text-checkins-count">🏪 {dealerCheckins.length}</div>
                    <div className="text-white/80 text-sm">Check-ins</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Location */}
            {currentLocation && (
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Current Location</p>
                        <p className="text-sm text-gray-800" data-testid="text-active-address">{currentAddress}</p>
                        <p className="text-xs text-gray-500" data-testid="text-active-coordinates">
                          {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                        </p>
                        {currentLocation.speed && currentLocation.speed > 0 && (
                          <p className="text-xs text-gray-500" data-testid="text-active-speed">
                            Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium" data-testid="text-active-accuracy">{currentLocation.accuracy?.toFixed(0)}m</p>
                      <p className="text-xs text-gray-500">accuracy</p>
                      {realtimeValidation && (
                        <Badge className={`mt-1 ${realtimeValidation.isInside
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-orange-100 text-orange-800 border-orange-300'
                          }`} data-testid="badge-active-geofence">
                          {realtimeValidation.isInside ? '🏢' : '🚗'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => {
                  // Handle pause/resume logic here
                  setActiveJourney(prev => prev ? {
                    ...prev,
                    status: prev.status === 'active' ? 'paused' : 'active'
                  } : null);
                }}
                className="h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-lg"
                data-testid="button-pause-resume"
              >
                <div className="flex flex-col items-center space-y-1">
                  {activeJourney.status === 'active' ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  <span className="text-sm">{activeJourney.status === 'active' ? 'Pause' : 'Resume'}</span>
                </div>
              </Button>

              <Button
                onClick={handleQuickCheckIn}
                className="h-16 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-lg"
                data-testid="button-quick-checkin"
              >
                <div className="flex flex-col items-center space-y-1">
                  <Store className="w-6 h-6" />
                  <span className="text-sm">Check-in</span>
                </div>
              </Button>
            </div>

            {/* Recent Check-ins */}
            {dealerCheckins.length > 0 && (
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Recent Check-ins</h3>
                  <div className="space-y-2">
                    {dealerCheckins.slice(-3).map((checkin) => (
                      <div key={checkin.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg" data-testid={`checkin-${checkin.id}`}>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium">{checkin.dealerName}</span>
                        </div>
                        <span className="text-xs text-gray-500">{checkin.checkInTime}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status */}
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Battery className={`w-4 h-4 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
                      <span className="text-sm" data-testid="text-active-battery">{batteryLevel}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Wifi className={`w-4 h-4 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                      <span className="text-sm" data-testid="text-active-network">{networkStatus}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span className="text-sm" data-testid="text-active-points">{activeJourney.trackingPoints} points</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500" data-testid="text-last-update">
                      Updated {Math.round((new Date().getTime() - lastUpdate.getTime()) / 1000)}s ago
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* End Journey */}
            <Button
              onClick={handleEndJourney}
              disabled={isLoading}
              className="w-full h-16 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-semibold rounded-3xl shadow-2xl transform transition-all duration-200 hover:scale-105"
              data-testid="button-end-journey"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ending Journey...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Square className="w-6 h-6" />
                  <span>🏁 End Journey</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ENHANCED: Settings Modal with Full API Integration */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Journey Settings</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-full"
                  data-testid="button-close-settings"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Office Geofence Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold">Office Geofence</h3>
                </div>

                {geofenceSettings.isSetupRequired ? (
                  <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        <span className="text-sm font-medium">Setup Required</span>
                      </div>

                      {/* Office setup mode selector */}
                      <div className="mb-4">
                        <div className="flex rounded-lg bg-gray-100 p-1">
                          <button
                            onClick={() => setOfficeSetupMode('current')}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${officeSetupMode === 'current'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                              }`}
                            data-testid="button-setup-current"
                          >
                            Current Location
                          </button>
                          <button
                            onClick={() => setOfficeSetupMode('address')}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${officeSetupMode === 'address'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                              }`}
                            data-testid="button-setup-address"
                          >
                            Enter Address
                          </button>
                        </div>
                      </div>

                      {officeSetupMode === 'address' && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Office Address
                          </label>
                          <input
                            type="text"
                            value={addressInput}
                            onChange={(e) => setAddressInput(e.target.value)}
                            placeholder="Enter office address..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            data-testid="input-office-address"
                          />
                        </div>
                      )}

                      <p className="text-sm text-gray-600 mb-3">
                        {officeSetupMode === 'current'
                          ? 'Create office geofence at your current location'
                          : 'Create office geofence at the specified address'
                        }
                      </p>

                      <Button
                        onClick={() => handleCreateOfficeGeofence(officeSetupMode === 'address')}
                        disabled={isLoading || (officeSetupMode === 'address' && !addressInput.trim())}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        data-testid="button-create-geofence"
                      >
                        {isLoading ? 'Creating...' : 'Setup Office Geofence'}
                      </Button>
                    </CardContent>
                  </Card>
                ) : geofenceSettings.officeGeofence ? (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium">Office Configured</span>
                        </div>

                        {/* Delete button */}
                        <Button
                          onClick={handleDeleteOfficeGeofence}
                          disabled={isLoading}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid="button-delete-geofence"
                        >
                          Delete
                        </Button>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Company:</strong> {geofenceSettings.officeGeofence.metadata.companyName}</p>
                        <p><strong>Description:</strong> {geofenceSettings.officeGeofence.description}</p>
                        <p><strong>Radius:</strong> {geofenceSettings.officeGeofence.geometryRadius}m</p>
                        {/* Show office address */}
                        {geofenceSettings.officeAddress && (
                          <p data-testid="text-office-address"><strong>Address:</strong> {geofenceSettings.officeAddress}</p>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        <Button
                          onClick={handleValidateOfficeLocation}
                          disabled={!currentLocation || officeValidation?.isValidating}
                          variant="outline"
                          className="w-full"
                          data-testid="button-test-location"
                        >
                          {officeValidation?.isValidating ? 'Checking...' : 'Test Current Location'}
                        </Button>

                        {officeValidation?.result && (
                          <div className={`p-3 rounded-lg text-sm ${officeValidation.result.isInside
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`} data-testid="validation-result">
                            <div className="flex items-center space-x-2">
                              {officeValidation.result.isInside ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <AlertCircle className="w-4 h-4" />
                              )}
                              <span className="font-medium">
                                {officeValidation.result.isInside ? 'At Office' : 'Outside Office'}
                              </span>
                            </div>
                            <p className="mt-1">
                              Distance: {officeValidation.result.distance}m from office center
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <Clock className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium">Loading...</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Checking office geofence status...
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Geofence Events History */}
                {geofenceEvents.length > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-blue-900 mb-3">Recent Events</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {geofenceEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between text-xs" data-testid={`event-${event.id}`}>
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${event.type === 'entry' ? 'bg-green-500' : 'bg-orange-500'
                                }`} />
                              <span className="text-blue-800">
                                {event.type === 'entry' ? 'Entered' : 'Left'} office
                              </span>
                            </div>
                            <span className="text-blue-600">{event.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tracking Mode Section */}
                <div className="pt-4 border-t">
                  <div className="flex items-center space-x-2 mb-3">
                    <Target className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold">Tracking Mode</h3>
                  </div>
                  <div className="space-y-2">
                    {(['conservative', 'balanced', 'precise'] as const).map((mode) => (
                      <Button
                        key={mode}
                        onClick={() => setTrackingMode(mode)}
                        variant={trackingMode === mode ? 'default' : 'outline'}
                        className="w-full justify-start"
                        data-testid={`button-mode-${mode}`}
                      >
                        <div className="text-left">
                          <div className="font-medium capitalize">{mode}</div>
                          <div className="text-xs text-gray-500">
                            {mode === 'conservative' && 'Battery saver (5min updates)'}
                            {mode === 'balanced' && 'Standard (2min updates)'}
                            {mode === 'precise' && 'High accuracy (30s updates)'}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}