import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Square, MapPin, Clock, Navigation, Pause, Play, ArrowLeft,
  Users, CheckCircle, AlertCircle, Battery, Wifi, MoreHorizontal,
  Target, Route, Store, TrendingUp, Camera, Share, Heart,
  Zap, Signal, Smartphone, Activity, Eye, Settings, Shield,
  Radar, Bell, MapPinned, Navigation2, Moon, Sun
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

interface RadarJourneyData {
  id: string;
  tripId?: string;
  startTime: string;
  duration: string;
  totalDistance: string;
  trackingPoints: number;
  activeCheckins: number;
  status: 'active' | 'paused';
  fraudDetected: boolean;
  locationValidated: boolean;
}

interface DealerCheckIn {
  id: string;
  dealerName: string;
  checkInTime: string;
  location: string;
  validated: boolean;
  distance?: number;
}

interface GeoTrackingEntry {
  id: string;
  userId: number;
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  locationType?: string;
  activityType?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApproachAlert {
  isApproaching: boolean;
  dealerName?: string;
  eta?: string;
  distance?: number;
}

// 🔐 SMART WAKE LOCK MANAGER CLASS
class SmartWakeLock {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean;
  private listeners: ((isActive: boolean) => void)[] = [];

  constructor() {
    this.isSupported = 'wakeLock' in navigator;
    
    // Handle visibility change to release wake lock when app goes to background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.releaseWakeLock('app_backgrounded');
      } else if (document.visibilityState === 'visible' && this.shouldMaintainWakeLock()) {
        this.requestWakeLock('app_foregrounded');
      }
    });
  }

  private shouldMaintainWakeLock(): boolean {
    // Only maintain wake lock if we have an active journey in progress
    return document.body.dataset.journeyActive === 'true';
  }

  async requestWakeLock(reason: string = 'journey_active'): Promise<boolean> {
    if (!this.isSupported) {
      console.log('Wake Lock not supported');
      return false;
    }

    try {
      // Release existing wake lock first
      if (this.wakeLock) {
        await this.releaseWakeLock('replacing_lock');
      }

      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      console.log(`🔐 Wake Lock acquired: ${reason}`);
      
      // Set marker that journey is active
      document.body.dataset.journeyActive = 'true';
      
      // Listen for wake lock release
      this.wakeLock.addEventListener('release', () => {
        console.log('🔓 Wake Lock was released');
        document.body.dataset.journeyActive = 'false';
        this.notifyListeners(false);
      });

      this.notifyListeners(true);
      return true;
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
      return false;
    }
  }

  async releaseWakeLock(reason: string = 'manual'): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        document.body.dataset.journeyActive = 'false';
        console.log(`🔓 Wake Lock released: ${reason}`);
        this.notifyListeners(false);
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  }

  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }

  onStateChange(callback: (isActive: boolean) => void) {
    this.listeners.push(callback);
  }

  private notifyListeners(isActive: boolean) {
    this.listeners.forEach(callback => callback(isActive));
  }
}

export default function JourneyTracker({ userId, onBack, onJourneyEnd }: JourneyTrackerProps) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [activeJourney, setActiveJourney] = useState<RadarJourneyData | null>(null);
  const [dealerCheckins, setDealerCheckins] = useState<DealerCheckIn[]>([]);
  const [trackingMode, setTrackingMode] = useState<'conservative' | 'balanced' | 'precise'>('balanced');
  const [geoTrackingHistory, setGeoTrackingHistory] = useState<GeoTrackingEntry[]>([]);

  // 🎯 Radar Integration State
  const [approachAlert, setApproachAlert] = useState<ApproachAlert>({ isApproaching: false });
  const [radarTripId, setRadarTripId] = useState<string | null>(null);
  const [locationValidation, setLocationValidation] = useState({ isValid: true, confidence: 100 });
  const [fraudAlerts, setFraudAlerts] = useState<string[]>([]);

  // 🔐 Smart Wake Lock State
  const [wakeLockManager] = useState(() => new SmartWakeLock());
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Battery & Network Status
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  // UI State
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // 🔐 Setup Wake Lock Listener
  useEffect(() => {
    wakeLockManager.onStateChange((isActive) => {
      setWakeLockActive(isActive);
    });

    return () => {
      wakeLockManager.releaseWakeLock('component_unmount');
    };
  }, [wakeLockManager]);

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

  // 🚀 INITIALIZE
  useEffect(() => {
    initializeJourneyTracker();
    setupBatteryMonitoring();
    getCurrentLocation();
    
    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
      wakeLockManager.releaseWakeLock('cleanup');
    };
  }, [userId]);

  // 📍 GET CURRENT LOCATION
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
            altitude: position.coords.altitude || 0
          });
        },
        (error) => {
          console.error('Location error:', error);
          setErrorMessage('Location access denied. Please enable GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  };

  // 🔍 INITIALIZE JOURNEY TRACKER
  const initializeJourneyTracker = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/geo-tracking/user/${userId}?startDate=${today}&endDate=${today}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        setGeoTrackingHistory(data.data);
        
        // Check for active journey
        const activeGeoTracking = data.data
          .sort((a: GeoTrackingEntry, b: GeoTrackingEntry) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
        
        if (activeGeoTracking && activeGeoTracking.activityType === 'journey_active') {
          const duration = calculateDuration(activeGeoTracking.createdAt);
          const distance = calculateTotalDistance(data.data);
          
          setActiveJourney({
            id: activeGeoTracking.id,
            startTime: activeGeoTracking.createdAt,
            duration,
            totalDistance: `${distance.toFixed(3)} km`,
            trackingPoints: data.data.length,
            activeCheckins: data.data.filter((track: GeoTrackingEntry) => 
              track.activityType === 'dealer_checkin'
            ).length,
            status: 'active',
            fraudDetected: false,
            locationValidated: true
          });

          // 🔐 Resume wake lock for active journey
          await wakeLockManager.requestWakeLock('resumed_active_journey');
          setSuccessMessage('🔄 Resumed active journey with smart wake lock');
          startLocationTracking();
        } else {
          setSuccessMessage('✨ Ready to start new Radar-powered journey');
        }
      } else {
        setSuccessMessage('🚀 Ready for your first journey with location intelligence');
      }
    } catch (error) {
      console.error('Error checking active journey:', error);
      setErrorMessage('Failed to load journey data');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate duration and distance helpers
  const calculateTotalDistance = (trackingData: GeoTrackingEntry[]): number => {
    if (trackingData.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < trackingData.length; i++) {
      const prev = trackingData[i - 1];
      const curr = trackingData[i];
      
      const R = 6371;
      const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    
    return totalDistance;
  };

  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // 🌍 SMART LOCATION TRACKING WITH BATTERY-AWARE WAKE LOCK
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

        // 🔐 Smart wake lock management based on movement
        const speedKmh = (newLocation.speed || 0) * 3.6;
        if (speedKmh > 1 && !wakeLockManager.isActive()) {
          // User is moving, acquire wake lock
          await wakeLockManager.requestWakeLock('movement_detected');
        } else if (speedKmh < 0.5 && wakeLockManager.isActive() && batteryLevel < 20) {
          // User is stationary and battery is low, consider releasing wake lock
          setTimeout(() => {
            if ((currentLocation?.speed || 0) * 3.6 < 0.5) {
              wakeLockManager.releaseWakeLock('stationary_low_battery');
            }
          }, 30000); // Wait 30 seconds before releasing
        }

        await checkApproachingDealers(newLocation);
        autoAdjustTrackingMode(newLocation.speed || 0);
        await logTrackingPoint(newLocation);
        
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
  }, [activeJourney, trackingMode, getLocationOptions, batteryLevel]);

  // Check approaching dealers
  const checkApproachingDealers = async (location: LocationData) => {
    try {
      const response = await fetch('/api/radar/check-approaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: location.lat,
          longitude: location.lng
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isApproaching) {
          setApproachAlert({
            isApproaching: true,
            dealerName: data.dealerName,
            eta: data.eta,
            distance: data.distance
          });
        } else {
          setApproachAlert({ isApproaching: false });
        }
      }
    } catch (error) {
      console.warn('Dealer approach check failed:', error);
    }
  };

  // Log tracking point
  const logTrackingPoint = async (location: LocationData) => {
    if (!activeJourney) return;

    try {
      await fetch('/api/geo-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: location.lat,
          longitude: location.lng,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          altitude: location.altitude,
          locationType: trackingMode,
          activityType: 'journey_tracking'
        })
      });
    } catch (error) {
      console.warn('Failed to log tracking point:', error);
    }
  };

  const autoAdjustTrackingMode = (speed: number) => {
    const speedKmh = speed * 3.6;
    let newMode: 'conservative' | 'balanced' | 'precise' = 'conservative';
    if (speedKmh > 30) newMode = 'precise';
    else if (speedKmh > 5) newMode = 'balanced';

    if (newMode !== trackingMode) {
      setTrackingMode(newMode);
    }
  };

  // 🏁 START NEW JOURNEY WITH SMART WAKE LOCK
  const handleStartJourney = async () => {
    if (!currentLocation) {
      setErrorMessage('Please enable location services');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // 🔐 Request wake lock ONLY when journey starts
      const wakeLockAcquired = await wakeLockManager.requestWakeLock('journey_started');
      if (!wakeLockAcquired) {
        console.warn('Wake lock not available, continuing without screen lock');
      }

      // Start Radar journey tracking
      const radarResponse = await fetch('/api/radar/start-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.toString(),
          externalId: `journey_${Date.now()}`,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          metadata: {
            startedFrom: 'pwa_tracker',
            trackingMode,
            wakeLockActive: wakeLockAcquired
          }
        })
      });

      let radarTripId = null;
      if (radarResponse.ok) {
        const radarData = await radarResponse.json();
        radarTripId = radarData.tripId;
        setRadarTripId(radarTripId);
      }

      // Create geo-tracking record
      const journeyData = {
        userId,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        accuracy: currentLocation.accuracy || 10,
        speed: currentLocation.speed || 0,
        heading: currentLocation.heading || 0,
        altitude: currentLocation.altitude || 0,
        locationType: trackingMode,
        activityType: 'journey_active',
        siteName: `Journey ${new Date().toLocaleTimeString()}`,
        checkInTime: new Date().toISOString()
      };

      const response = await fetch('/api/geo-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journeyData)
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setActiveJourney({
          id: data.data.id,
          tripId: radarTripId || undefined,
          startTime: data.data.createdAt,
          duration: '0m',
          totalDistance: '0.000 km',
          trackingPoints: 1,
          activeCheckins: 0,
          status: 'active',
          fraudDetected: false,
          locationValidated: true
        });

        setGeoTrackingHistory(prev => [...prev, data.data]);
        startLocationTracking();
        setSuccessMessage(`🚀 Journey started with ${wakeLockAcquired ? 'screen lock' : 'battery optimization'}!`);
        setErrorMessage('');
      } else {
        await wakeLockManager.releaseWakeLock('journey_start_failed');
        setErrorMessage(data.error || 'Failed to start journey');
      }
    } catch (error) {
      await wakeLockManager.releaseWakeLock('journey_start_error');
      console.error('Error starting journey:', error);
      setErrorMessage('Network error: Failed to start journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🎯 PAUSE/RESUME WITH SMART WAKE LOCK MANAGEMENT
  const handlePauseResumeJourney = async () => {
    if (!activeJourney || !currentLocation) return;

    setIsLoading(true);
    try {
      const action = activeJourney.status === 'active' ? 'pause' : 'resume';
      
      if (radarTripId) {
        await fetch(`/api/radar/${action}-journey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: radarTripId,
            userId: userId.toString(),
            currentLocation: {
              latitude: currentLocation.lat,
              longitude: currentLocation.lng
            }
          })
        });
      }

      if (action === 'pause') {
        // 🔐 Release wake lock when pausing - save battery!
        await wakeLockManager.releaseWakeLock('journey_paused');
        if (locationWatchId) {
          navigator.geolocation.clearWatch(locationWatchId);
          setLocationWatchId(null);
        }
        setSuccessMessage('⏸️ Journey paused • Screen lock released to save battery');
      } else {
        // 🔐 Reacquire wake lock when resuming
        const wakeLockAcquired = await wakeLockManager.requestWakeLock('journey_resumed');
        startLocationTracking();
        setSuccessMessage(`▶️ Journey resumed ${wakeLockAcquired ? 'with screen lock' : '• Battery optimization active'}`);
      }

      setActiveJourney(prev => prev ? {
        ...prev,
        status: prev.status === 'active' ? 'paused' : 'active'
      } : null);

    } catch (error) {
      console.error('Error pausing/resuming journey:', error);
      setErrorMessage('Failed to pause/resume journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔚 END JOURNEY WITH WAKE LOCK CLEANUP
  const handleEndJourney = async () => {
    if (!activeJourney) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Complete Radar journey
      if (radarTripId && currentLocation) {
        await fetch('/api/radar/complete-journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: radarTripId,
            userId: userId.toString(),
            finalLocation: {
              latitude: currentLocation.lat,
              longitude: currentLocation.lng
            }
          })
        });
      }

      // Update geo-tracking record
      const updateData = {
        checkOutTime: new Date().toISOString(),
        activityType: 'journey_completed',
        totalDistanceTravelled: parseFloat(activeJourney.totalDistance.replace(' km', ''))
      };

      const response = await fetch(`/api/geo-tracking/${activeJourney.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        // 🔐 Release wake lock when journey ends
        await wakeLockManager.releaseWakeLock('journey_completed');

        // Stop location tracking
        if (locationWatchId) {
          navigator.geolocation.clearWatch(locationWatchId);
          setLocationWatchId(null);
        }

        const duration = activeJourney.startTime ? calculateDuration(activeJourney.startTime) : '0m';
        setSuccessMessage(`🎉 Journey Complete! Duration: ${duration} • Screen lock released`);

        // Reset state
        setActiveJourney(null);
        setDealerCheckins([]);
        setRadarTripId(null);
        setApproachAlert({ isApproaching: false });
        setErrorMessage('');

        setTimeout(() => {
          initializeJourneyTracker();
          onJourneyEnd();
        }, 2000);

      } else {
        setErrorMessage('Failed to end journey');
      }
    } catch (error) {
      console.error('Error ending journey:', error);
      setErrorMessage('Network error: Failed to end journey');
    } finally {
      setIsLoading(false);
    }
  };

  // Battery monitoring
  const setupBatteryMonitoring = () => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          const newBatteryLevel = Math.round(battery.level * 100);
          setBatteryLevel(newBatteryLevel);
          
          // 🔐 Auto-release wake lock if battery is critically low
          if (newBatteryLevel < 10 && wakeLockManager.isActive()) {
            wakeLockManager.releaseWakeLock('critical_low_battery');
            setSuccessMessage('⚠️ Screen lock released due to low battery');
          }
        });
      });
    }

    window.addEventListener('online', () => setNetworkStatus('online'));
    window.addEventListener('offline', () => setNetworkStatus('offline'));
  };

  // Enhanced dealer check-in
  const handleQuickCheckIn = async () => {
    if (!activeJourney || !currentLocation) {
      setErrorMessage('No active journey or location unavailable');
      return;
    }

    try {
      const visitData = {
        userId,
        reportDate: new Date().toISOString().split('T')[0],
        dealerType: 'Quick Check-in',
        dealerName: `Dealer ${dealerCheckins.length + 1}`,
        location: `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        visitType: 'Quick Check-in',
        dealerTotalPotential: 0,
        dealerBestPotential: 0,
        brandSelling: ['Quick Visit'],
        todayOrderMt: 0,
        todayCollectionRupees: 0,
        feedbacks: 'Quick check-in via journey tracker',
        checkInTime: new Date().toISOString()
      };

      const response = await fetch('/api/dvr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitData)
      });

      const data = await response.json();

      if (data.success) {
        const newCheckIn: DealerCheckIn = {
          id: data.data.id,
          dealerName: visitData.dealerName,
          checkInTime: new Date().toLocaleTimeString(),
          location: visitData.location,
          validated: data.data.locationValidated || false,
          distance: data.data.distance
        };

        setDealerCheckins(prev => [...prev, newCheckIn]);
        setActiveJourney(prev => prev ? { ...prev, activeCheckins: prev.activeCheckins + 1 } : null);
        setSuccessMessage('✅ Quick check-in recorded with location validation');
      } else {
        setErrorMessage('Failed to record check-in');
      }
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
            <Radar className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Initializing smart tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col">
      {/* ENHANCED HEADER WITH WAKE LOCK STATUS */}
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
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 text-white">
                  <Radar className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-lg">Smart Journey Tracker</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${networkStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>Radar.io • {batteryLevel}%</span>
                  {wakeLockActive && (
                    <div className="flex items-center space-x-1 text-blue-600">
                      <Sun className="w-3 h-3" />
                      <span className="text-xs">Screen Lock</span>
                    </div>
                  )}
                  {!wakeLockActive && activeJourney && (
                    <div className="flex items-center space-x-1 text-gray-500">
                      <Moon className="w-3 h-3" />
                      <span className="text-xs">Battery Save</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {approachAlert.isApproaching && (
                <Button variant="ghost" size="sm" className="p-2 rounded-full text-orange-600">
                  <Bell className="w-5 h-5 animate-bounce" />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="p-2 rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* APPROACH ALERT */}
      {approachAlert.isApproaching && (
        <div className="mx-4 mt-4 p-3 bg-orange-100 border border-orange-300 rounded-xl">
          <div className="flex items-center space-x-2">
            <MapPinned className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-700">Approaching Dealer</p>
              <p className="text-sm text-orange-600">
                {approachAlert.dealerName} • {approachAlert.distance}m • ETA: {approachAlert.eta}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Messages */}
        {successMessage && (
          <div className="mx-4 mt-4 p-3 bg-green-100 border border-green-300 rounded-xl">
            <p className="text-green-700 text-sm text-center">{successMessage}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="mx-4 mt-4 p-3 bg-red-100 border border-red-300 rounded-xl">
            <p className="text-red-700 text-sm text-center">{errorMessage}</p>
          </div>
        )}

        {!activeJourney ? (
          // START JOURNEY SCREEN
          <div className="p-6">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl">
                <Navigation2 className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ready for Smart Journey?
              </h2>
              <p className="text-gray-600 text-lg">With intelligent wake lock & battery optimization</p>
            </div>

            {/* Location Status */}
            {currentLocation ? (
              <Card className="mb-6 bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Radar className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Smart Location Ready</h3>
                        <p className="text-sm text-gray-600">
                          {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Wake lock will activate only during active tracking
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      <Signal className="w-3 h-3 mr-1" />
                      {currentLocation.accuracy?.toFixed(0)}m
                    </Badge>
                  </div>
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
                    >
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Wake Lock Info */}
            <Card className="mb-6 bg-blue-50/60 backdrop-blur-sm border border-blue-200/50 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Sun className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Smart Screen Management</h3>
                    <p className="text-sm text-gray-600">
                      Screen stays awake only while actively tracking • Battery optimization included
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card className="bg-white/60 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4 text-center">
                  <Battery className={`w-6 h-6 mx-auto mb-2 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium">{batteryLevel}% Battery</p>
                  <p className="text-xs text-gray-500">
                    {batteryLevel < 20 ? 'Wake lock will auto-release' : 'Optimized for tracking'}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/60 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4 text-center">
                  <Wifi className={`w-6 h-6 mx-auto mb-2 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium">{networkStatus === 'online' ? 'Online' : 'Offline'}</p>
                  <p className="text-xs text-gray-500">
                    {networkStatus === 'online' ? 'Radar tracking ready' : 'Local tracking only'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Start Button */}
            <Button
              onClick={handleStartJourney}
              disabled={!currentLocation || isLoading}
              className="w-full h-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-3xl shadow-2xl transform transition-all duration-200 hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Starting Smart Journey...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Play className="w-6 h-6" />
                  <span>Start Smart Journey</span>
                </div>
              )}
            </Button>
          </div>
        ) : (
          // ACTIVE JOURNEY SCREEN
          <div className="p-6 space-y-6">
            {/* Journey Status with Wake Lock Indicator */}
            <Card className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 text-white shadow-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Navigation className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Journey Active</h3>
                      <p className="text-white/80 flex items-center space-x-2">
                        <span>Smart GPS Tracking</span>
                        {wakeLockActive && (
                          <span className="flex items-center space-x-1">
                            <Sun className="w-3 h-3" />
                            <span className="text-xs">Screen Lock ON</span>
                          </span>
                        )}
                        {!wakeLockActive && (
                          <span className="flex items-center space-x-1">
                            <Moon className="w-3 h-3" />
                            <span className="text-xs">Battery Save</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {activeJourney.status === 'active' && (
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    )}
                    <Badge className="bg-white/20 text-white border-white/30">
                      {trackingMode}
                    </Badge>
                  </div>
                </div>

                {/* Live Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      ⏱️ {calculateDuration(activeJourney.startTime)}
                    </div>
                    <div className="text-white/80 text-sm">Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">📍 {activeJourney.totalDistance}</div>
                    <div className="text-white/80 text-sm">Distance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">🏪 {dealerCheckins.length}</div>
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
                        <p className="text-sm text-gray-600">
                          {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                        </p>
                        {currentLocation.speed && currentLocation.speed > 0 && (
                          <p className="text-xs text-gray-500">
                            Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{currentLocation.accuracy?.toFixed(0)}m</p>
                      <p className="text-xs text-gray-500">accuracy</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handlePauseResumeJourney}
                className="h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-lg"
              >
                <div className="flex flex-col items-center space-y-1">
                  {activeJourney.status === 'active' ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  <span className="text-sm">
                    {activeJourney.status === 'active' ? 'Pause & Save Battery' : 'Resume Tracking'}
                  </span>
                </div>
              </Button>

              <Button
                onClick={handleQuickCheckIn}
                className="h-16 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-lg"
              >
                <div className="flex flex-col items-center space-y-1">
                  <Store className="w-6 h-6" />
                  <span className="text-sm">Quick Check-in</span>
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
                      <div key={checkin.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className={`w-4 h-4 ${checkin.validated ? 'text-green-600' : 'text-orange-600'}`} />
                          <span className="text-sm font-medium">{checkin.dealerName}</span>
                          {checkin.validated && <Shield className="w-3 h-3 text-green-600" />}
                        </div>
                        <span className="text-xs text-gray-500">{checkin.checkInTime}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status with Wake Lock */}
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Battery className={`w-4 h-4 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
                      <span className="text-sm">{batteryLevel}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Wifi className={`w-4 h-4 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                      <span className="text-sm">{networkStatus}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {wakeLockActive ? (
                        <>
                          <Sun className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-blue-600">Screen Lock</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-500">Battery Save</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
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
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ending Journey...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Square className="w-6 h-6" />
                  <span>🏁 End Journey & Release Lock</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}