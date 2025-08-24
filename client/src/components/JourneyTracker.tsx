import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Square, MapPin, Clock, Navigation, Pause, Play, ArrowLeft,
  CheckCircle, AlertCircle, Battery, Wifi, MoreHorizontal,
  Route, TrendingUp, Zap, Signal, Activity, Settings,
  Car, Bike, Timer, Target,
  User as Walk
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
  timestamp: number;
}

interface JourneyLeg {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  distanceMeters?: number;
  durationMinutes?: number;
  timestamp: number;
}

interface SmartWakeLockConfig {
  isActive: boolean;
  batteryThreshold: number;
  speedBasedAdjustment: boolean;
  networkAware: boolean;
}

export default function JourneyTracker({ userId, onBack, onJourneyEnd }: JourneyTrackerProps) {
  // 🚀 CORE STATE
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [legs, setLegs] = useState<JourneyLeg[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // 🔋 SYSTEM STATE
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [trackingMode, setTrackingMode] = useState<'car' | 'bike' | 'walk'>('car');

  // 🔐 SMART WAKE LOCK STATE
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [wakeLockStatus, setWakeLockStatus] = useState<'active' | 'released' | 'unavailable'>('unavailable');

  // 🎯 TRACKING STATE
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [lastLocationRef, setLastLocationRef] = useState<LocationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // 📱 REFS
  const legCalculationQueue = useRef<Promise<void>>(Promise.resolve());

  // 🧠 ULTRA-SMART WAKE LOCK MANAGEMENT
  const smartWakeLockConfig: SmartWakeLockConfig = {
    isActive,
    batteryThreshold: 15, // Only activate if battery > 15%
    speedBasedAdjustment: true,
    networkAware: true
  };

  const requestSmartWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWakeLockStatus('unavailable');
      return false;
    }

    // Smart conditions: Don't activate wake lock if battery is too low
    if (batteryLevel <= smartWakeLockConfig.batteryThreshold) {
      setWakeLockStatus('released');
      return false;
    }

    // Don't activate if offline and no journey active
    if (networkStatus === 'offline' && !isActive) {
      return false;
    }

    try {
      const lock = await (navigator as any).wakeLock.request('screen');
      setWakeLock(lock);
      setWakeLockStatus('active');
      
      lock.addEventListener('release', () => {
        setWakeLockStatus('released');
      });
      
      return true;
    } catch (err) {
      setWakeLockStatus('unavailable');
      return false;
    }
  }, [batteryLevel, networkStatus, isActive, smartWakeLockConfig.batteryThreshold]);

  const releaseSmartWakeLock = useCallback(async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        setWakeLockStatus('released');
      } catch (err) {
        console.warn('Wake lock release failed:', err);
      }
    }
  }, [wakeLock]);

  // 🔋 BATTERY-OPTIMIZED LOCATION TRACKING
  const getOptimalLocationOptions = useCallback(() => {
    const speed = currentLocation?.speed || 0;
    const speedKmh = speed * 3.6;

    // Auto-adjust based on movement speed and battery
    let accuracy = 'balanced';
    if (speedKmh > 50) accuracy = 'high'; // Highway driving
    else if (speedKmh < 5) accuracy = 'low'; // Stationary/walking
    else if (batteryLevel < 30) accuracy = 'low'; // Battery saving

    const options = {
      high: { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
      balanced: { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
      low: { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 }
    };

    return options[accuracy as keyof typeof options];
  }, [currentLocation?.speed, batteryLevel]);

  // 🌐 API FUNCTIONS
  const startJourney = async () => {
    if (!currentLocation) {
      setErrorMessage('Location required to start journey');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const batteryInfo = await getBatteryInfo();
      
      const response = await fetch('/api/geo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          accuracy: currentLocation.accuracy,
          speed: currentLocation.speed,
          heading: currentLocation.heading,
          altitude: currentLocation.altitude,
          batteryLevel: batteryInfo.level,
          isCharging: batteryInfo.charging,
          networkStatus,
          ipAddress: await getIPAddress(),
          siteName: `Journey-${new Date().toISOString().split('T')[0]}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setJourneyId(data.data.journeyId);
        setIsActive(true);
        setStartTime(new Date());
        setLastLocationRef(currentLocation);
        setSuccessMessage('Journey started successfully!');
        
        // Start smart wake lock
        await requestSmartWakeLock();
        
        // Start location tracking
        startLocationTracking();
      } else {
        setErrorMessage(data.error || 'Failed to start journey');
      }
    } catch (error) {
      setErrorMessage('Network error: Failed to start journey');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLegDistance = async (leg: JourneyLeg): Promise<JourneyLeg> => {
    if (networkStatus === 'offline') return leg;

    try {
      const response = await fetch('/api/geo/leg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originLat: leg.origin.lat,
          originLng: leg.origin.lng,
          destLat: leg.destination.lat,
          destLng: leg.destination.lng,
          modes: trackingMode,
          units: 'metric'
        })
      });

      const data = await response.json();
      
      if (data.success && data.data.distanceMeters) {
        return {
          ...leg,
          distanceMeters: data.data.distanceMeters,
          durationMinutes: data.data.durationMinutes
        };
      }
    } catch (error) {
      console.warn('Real-time distance calculation failed:', error);
    }
    
    return leg;
  };

  const addLeg = useCallback(async (newLocation: LocationData) => {
    if (!lastLocationRef || !isActive || isPaused) return;

    const leg: JourneyLeg = {
      origin: { lat: lastLocationRef.lat, lng: lastLocationRef.lng },
      destination: { lat: newLocation.lat, lng: newLocation.lng },
      timestamp: newLocation.timestamp
    };

    // Queue leg calculation to prevent overwhelming the API
    legCalculationQueue.current = legCalculationQueue.current.then(async () => {
      const calculatedLeg = await calculateLegDistance(leg);
      
      setLegs(prev => [...prev, calculatedLeg]);
      
      if (calculatedLeg.distanceMeters) {
        setTotalDistance(prev => prev + calculatedLeg.distanceMeters!);
      }
      if (calculatedLeg.durationMinutes) {
        setTotalDuration(prev => prev + calculatedLeg.durationMinutes!);
      }
    });

    setLastLocationRef(newLocation);
  }, [lastLocationRef, isActive, isPaused, trackingMode, networkStatus]);

  const finishJourney = async () => {
    if (!journeyId || legs.length === 0) {
      setErrorMessage('No active journey to finish');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/geo/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId,
          legs: legs.map(leg => ({
            origin: leg.origin,
            destination: leg.destination
          })),
          mode: trackingMode,
          units: 'metric'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`Journey completed! ${data.data.distanceMeters.toFixed(0)}m traveled in ${data.data.durationMinutes.toFixed(0)} minutes`);
        
        // Cleanup
        await releaseSmartWakeLock();
        stopLocationTracking();
        resetJourneyState();
        
        setTimeout(() => onJourneyEnd(), 2000);
      } else {
        setErrorMessage(data.error || 'Failed to finish journey');
      }
    } catch (error) {
      setErrorMessage('Network error: Failed to finish journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🎯 LOCATION TRACKING
  const startLocationTracking = useCallback(() => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }

    const options = getOptimalLocationOptions();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          heading: position.coords.heading || 0,
          altitude: position.coords.altitude || 0,
          timestamp: Date.now()
        };

        setCurrentLocation(newLocation);
        
        // Add leg if journey is active
        if (isActive) {
          addLeg(newLocation);
        }

        // Auto-adjust tracking mode based on speed
        const speedKmh = (newLocation.speed || 0) * 3.6;
        if (speedKmh > 25 && trackingMode !== 'car') setTrackingMode('car');
        else if (speedKmh > 8 && speedKmh <= 25 && trackingMode !== 'bike') setTrackingMode('bike');
        else if (speedKmh <= 8 && trackingMode !== 'walk') setTrackingMode('walk');
      },
      (error) => {
        setErrorMessage(`Location error: ${error.message}`);
      },
      options
    );

    setLocationWatchId(watchId);
  }, [getOptimalLocationOptions, isActive, addLeg, trackingMode]);

  const stopLocationTracking = () => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }
  };

  // 🛠 UTILITY FUNCTIONS
  const getBatteryInfo = async () => {
    if ('getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();
      return {
        level: Math.round(battery.level * 100),
        charging: battery.charging
      };
    }
    return { level: batteryLevel, charging: isCharging };
  };

  const getIPAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  };

  const resetJourneyState = () => {
    setJourneyId(null);
    setIsActive(false);
    setIsPaused(false);
    setLegs([]);
    setTotalDistance(0);
    setTotalDuration(0);
    setStartTime(null);
    setLastLocationRef(null);
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // 🚀 EFFECTS
  useEffect(() => {
    const initializeTracker = async () => {
      // Setup battery monitoring
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      }

      // Setup network monitoring
      window.addEventListener('online', () => setNetworkStatus('online'));
      window.addEventListener('offline', () => setNetworkStatus('offline'));

      // Get initial location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed || 0,
              heading: position.coords.heading || 0,
              altitude: position.coords.altitude || 0,
              timestamp: Date.now()
            });
          },
          (error) => setErrorMessage('Location access denied'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }
    };

    initializeTracker();

    return () => {
      stopLocationTracking();
      releaseSmartWakeLock();
    };
  }, []);

  // Smart wake lock management based on conditions
  useEffect(() => {
    if (isActive && batteryLevel > smartWakeLockConfig.batteryThreshold) {
      requestSmartWakeLock();
    } else if (batteryLevel <= smartWakeLockConfig.batteryThreshold) {
      releaseSmartWakeLock();
    }
  }, [isActive, batteryLevel, requestSmartWakeLock, releaseSmartWakeLock, smartWakeLockConfig.batteryThreshold]);

  // Loading state
  if (isLoading && !isActive) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Navigation className="w-10 h-10 text-white" />
          </div>
          <p className="text-white/80 font-medium text-lg">Initializing Journey Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* 🎯 PREMIUM HEADER */}
      <div className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onBack}
                  className="p-2 hover:bg-white/10 rounded-full text-white"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="h-12 w-12 border-2 border-white/20">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <Navigation className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-bold text-xl text-white">Smart Journey</h1>
                <div className="flex items-center space-x-3 text-sm text-white/60">
                  <div className={`w-2 h-2 rounded-full ${networkStatus === 'online' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                  <span>{trackingMode.toUpperCase()} Mode</span>
                  <Battery className={`w-4 h-4 ${batteryLevel > 20 ? 'text-green-400' : 'text-red-400'}`} />
                  <span>{batteryLevel}%</span>
                  {wakeLockStatus === 'active' && <Zap className="w-4 h-4 text-yellow-400" />}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10" data-testid="button-settings">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-2xl backdrop-blur-sm" data-testid="message-success">
            <p className="text-green-100 text-sm text-center font-medium">{successMessage}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-2xl backdrop-blur-sm" data-testid="message-error">
            <p className="text-red-100 text-sm text-center font-medium">{errorMessage}</p>
          </div>
        )}

        {!isActive ? (
          /* 🌟 START JOURNEY SCREEN */
          <>
            {/* Hero Section */}
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-purple-500/25">
                <Route className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Ready to Track?
              </h2>
              <p className="text-white/60 text-lg">Ultra-smart journey tracking with real-time optimization</p>
            </div>

            {/* Location Status */}
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
              <CardContent className="p-6">
                {currentLocation ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
                        <MapPin className="w-7 h-7 text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">Location Locked</h3>
                        <p className="text-white/60 text-sm">
                          {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </p>
                        <p className="text-white/40 text-xs">
                          Accuracy: {currentLocation.accuracy?.toFixed(0)}m
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-3 py-1">
                      <Signal className="w-3 h-3 mr-1" />
                      Ready
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center animate-pulse">
                        <AlertCircle className="w-7 h-7 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">Acquiring Location...</h3>
                        <p className="text-white/60 text-sm">Please enable GPS access</p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => window.location.reload()}
                      size="sm"
                      className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30"
                      data-testid="button-retry-location"
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transport Mode Selection */}
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
              <CardContent className="p-6">
                <h3 className="font-bold text-white mb-4">Transport Mode</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { mode: 'car', icon: Car, label: 'Car' },
                    { mode: 'bike', icon: Bike, label: 'Bike' },
                    { mode: 'walk', icon: Walk, label: 'Walk' }
                  ].map(({ mode, icon: Icon, label }) => (
                    <Button
                      key={mode}
                      onClick={() => setTrackingMode(mode as 'car' | 'bike' | 'walk')}
                      className={`h-16 rounded-2xl transition-all ${
                        trackingMode === mode
                          ? 'bg-purple-500/30 text-purple-300 border-purple-500/50'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                      data-testid={`button-mode-${mode}`}
                    >
                      <div className="flex flex-col items-center space-y-1">
                        <Icon className="w-6 h-6" />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                <CardContent className="p-4 text-center">
                  <Battery className={`w-8 h-8 mx-auto mb-2 ${batteryLevel > 20 ? 'text-green-400' : 'text-red-400'}`} />
                  <p className="text-white font-bold">{batteryLevel}%</p>
                  <p className="text-white/40 text-xs">{isCharging ? 'Charging' : 'Battery'}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                <CardContent className="p-4 text-center">
                  <div className={`w-8 h-8 mx-auto mb-2 flex items-center justify-center rounded-full ${
                    wakeLockStatus === 'active' ? 'bg-yellow-500/20' : 'bg-gray-500/20'
                  }`}>
                    <Zap className={`w-5 h-5 ${wakeLockStatus === 'active' ? 'text-yellow-400' : 'text-gray-400'}`} />
                  </div>
                  <p className="text-white font-bold text-sm">Wake Lock</p>
                  <p className="text-white/40 text-xs capitalize">{wakeLockStatus}</p>
                </CardContent>
              </Card>
            </div>

            {/* Start Button */}
            <Button
              onClick={startJourney}
              disabled={!currentLocation || isLoading || batteryLevel < 10}
              className="w-full h-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white text-xl font-bold rounded-3xl shadow-2xl shadow-purple-500/25 transform transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              data-testid="button-start-journey"
            >
              {isLoading ? (
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Starting Journey...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Play className="w-7 h-7" />
                  <span>Start Smart Journey</span>
                </div>
              )}
            </Button>
          </>
        ) : (
          /* 🎯 ACTIVE JOURNEY SCREEN */
          <>
            {/* Journey Status Hero */}
            <Card className="bg-gradient-to-r from-green-400/20 via-blue-500/20 to-purple-600/20 border border-white/20 backdrop-blur-xl shadow-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                      <Navigation className="w-8 h-8 text-white animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Journey Active</h3>
                      <p className="text-white/60">Ultra-smart tracking enabled</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {!isPaused && <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse" />}
                    <Badge className="bg-white/10 text-white border-white/20 px-3 py-1">
                      {isPaused ? 'Paused' : 'Active'}
                    </Badge>
                  </div>
                </div>

                {/* Live Stats Grid */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                      {startTime ? formatDuration((Date.now() - startTime.getTime()) / 60000) : '0m'}
                    </div>
                    <div className="text-white/60 text-sm flex items-center justify-center">
                      <Timer className="w-4 h-4 mr-1" />
                      Duration
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                      {formatDistance(totalDistance)}
                    </div>
                    <div className="text-white/60 text-sm flex items-center justify-center">
                      <Route className="w-4 h-4 mr-1" />
                      Distance
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">{legs.length}</div>
                    <div className="text-white/60 text-sm flex items-center justify-center">
                      <Target className="w-4 h-4 mr-1" />
                      Segments
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Location & Speed */}
            {currentLocation && (
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-6 h-6 text-blue-400" />
                      <div>
                        <p className="font-bold text-white">Live Position</p>
                        <p className="text-white/60 text-sm">
                          {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </p>
                        {currentLocation.speed && currentLocation.speed > 0 && (
                          <p className="text-white/40 text-xs">
                            Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {currentLocation.accuracy?.toFixed(0)}m
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Journey Controls */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => setIsPaused(!isPaused)}
                className="h-20 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 rounded-2xl shadow-lg"
                data-testid="button-pause-resume"
              >
                <div className="flex flex-col items-center space-y-2">
                  {isPaused ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
                  <span className="font-bold">{isPaused ? 'Resume' : 'Pause'}</span>
                </div>
              </Button>

              <Button
                onClick={finishJourney}
                disabled={isLoading}
                className="h-20 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-300 border border-red-500/30 rounded-2xl shadow-lg"
                data-testid="button-finish-journey"
              >
                <div className="flex flex-col items-center space-y-2">
                  <Square className="w-8 h-8" />
                  <span className="font-bold">Finish</span>
                </div>
              </Button>
            </div>

            {/* Real-time System Status */}
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Battery className={`w-5 h-5 ${batteryLevel > 20 ? 'text-green-400' : 'text-red-400'}`} />
                      <span className="text-white font-medium">{batteryLevel}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Wifi className={`w-5 h-5 ${networkStatus === 'online' ? 'text-green-400' : 'text-red-400'}`} />
                      <span className="text-white font-medium">{networkStatus}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-blue-400" />
                      <span className="text-white font-medium">{legs.length} legs</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs">
                      Mode: {trackingMode.toUpperCase()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}