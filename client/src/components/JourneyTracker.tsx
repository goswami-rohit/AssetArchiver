import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Square, MapPin, Clock, Navigation, Pause, Play, ArrowLeft,
  Users, CheckCircle, AlertCircle, Battery, Wifi, MoreHorizontal,
  Target, Route, Store, TrendingUp, Camera, Share, Heart,
  Zap, Signal, Smartphone, Activity, Eye, Settings
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

export default function JourneyTracker({ userId, onBack, onJourneyEnd }: JourneyTrackerProps) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [activeJourney, setActiveJourney] = useState<JourneyData | null>(null);
  const [dealerCheckins, setDealerCheckins] = useState<DealerCheckIn[]>([]);
  const [trackingMode, setTrackingMode] = useState<'conservative' | 'balanced' | 'precise'>('balanced');
  const [journeyWakeLock, setJourneyWakeLock] = useState<WakeLockSentinel | null>(null);

  // Battery & Network Status
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  // UI State
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [errorMessage, setErrorMessage] = useState<string>('');

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

  // 🚀 INITIALIZE - CHECK FOR ACTIVE JOURNEY
  useEffect(() => {
    initializeJourneyTracker();
    setupBatteryMonitoring();
    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [userId]);

  const initializeJourneyTracker = async () => {
    setIsLoading(true);
    try {
      // ✅ UPDATED: Use correct geo-tracking endpoint
      const response = await fetch(`/api/geo-tracking/user/${userId}?dateFrom=${new Date().toISOString().split('T')[0]}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        // Check if there's an active journey (no checkout time)
        const activeGeoTracking = data.data.find((track: any) => !track.checkOutTime);
        
        if (activeGeoTracking) {
          setActiveJourney({
            id: activeGeoTracking.id,
            startTime: activeGeoTracking.checkInTime,
            duration: calculateDuration(activeGeoTracking.checkInTime),
            totalDistance: '0.000 km', // Calculate from tracking data
            trackingPoints: 0,
            activeCheckins: 1,
            status: 'active'
          });

          startLocationTracking();
        }
      }
    } catch (error) {
      console.error('Error checking active journey:', error);
      setErrorMessage('Failed to check journey status');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate duration helper
  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  };

  // 🌍 START LOCATION TRACKING WITH BATTERY OPTIMIZATION
  const startLocationTracking = useCallback(() => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }

    const options = getLocationOptions();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
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
      },
      (error) => {
        console.error('Location tracking error:', error);
        setErrorMessage(`Location error: ${error.message}`);
      },
      options
    );

    setLocationWatchId(watchId);
  }, [activeJourney, trackingMode]);

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

  // 🏁 START NEW JOURNEY
  const handleStartJourney = async () => {
    if (!currentLocation) {
      setErrorMessage('Please enable location services');
      return;
    }

    setIsLoading(true);

    // Wake lock
    let wakeLock = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        setJourneyWakeLock(wakeLock);
      }
    } catch (wakeLockError) {
      console.log('Wake lock not available, continuing without it');
    }

    try {
      // ✅ UPDATED: Use correct geo-tracking checkin endpoint
      const response = await fetch('/api/geo-tracking/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          accuracy: currentLocation.accuracy || 10,
          speed: currentLocation.speed || 0,
          heading: currentLocation.heading || 0,
          altitude: currentLocation.altitude || 0
        })
      });

      const data = await response.json();
      if (data.success) {
        setActiveJourney({
          id: data.data.id,
          startTime: data.data.checkInTime,
          duration: '0 min',
          totalDistance: '0.000 km',
          trackingPoints: 0,
          activeCheckins: 1,
          status: 'active'
        });

        startLocationTracking();
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
      setErrorMessage('Failed to start journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔚 END JOURNEY
  const handleEndJourney = async () => {
    if (!activeJourney) return;

    setIsLoading(true);
    try {
      // ✅ UPDATED: Use correct geo-tracking checkout endpoint
      const response = await fetch('/api/geo-tracking/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          trackingId: activeJourney.id,
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng,
          notes: 'Journey completed via PWA tracker'
        })
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

        const duration = activeJourney.startTime ? calculateDuration(activeJourney.startTime) : '0m';
        
        // Success notification
        alert(`🎉 Journey Complete!\n\n📊 Summary:\n⏱️ Duration: ${duration}\n🏪 Check-ins: ${dealerCheckins.length}\n\nGreat work! 👏`);

        setActiveJourney(null);
        setDealerCheckins([]);
        if (locationWatchId) {
          navigator.geolocation.clearWatch(locationWatchId);
          setLocationWatchId(null);
        }

        onJourneyEnd();
      } else {
        setErrorMessage(data.error || 'Failed to end journey');
      }
    } catch (error) {
      console.error('Error ending journey:', error);
      setErrorMessage('Failed to end journey');
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
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="p-2 rounded-full">
                <Camera className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 rounded-full">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto pb-6">
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

            {/* Location Status */}
            {currentLocation && (
              <Card className="mb-6 bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Location Ready</h3>
                        <p className="text-sm text-gray-600">
                          {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
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
            )}

            {/* System Status */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card className="bg-white/60 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4 text-center">
                  <Battery className={`w-6 h-6 mx-auto mb-2 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium">{batteryLevel}% Battery</p>
                </CardContent>
              </Card>
              <Card className="bg-white/60 backdrop-blur-sm border border-gray-200/50">
                <CardContent className="p-4 text-center">
                  <Wifi className={`w-6 h-6 mx-auto mb-2 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium">{networkStatus === 'online' ? 'Online' : 'Offline'}</p>
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
                  <span>Starting Journey...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Play className="w-6 h-6" />
                  <span>Start Journey</span>
                </div>
              )}
            </Button>

            {errorMessage && (
              <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-2xl">
                <p className="text-red-700 text-center">{errorMessage}</p>
              </div>
            )}
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
                    <Badge className="bg-white/20 text-white border-white/30">
                      {trackingMode}
                    </Badge>
                  </div>
                </div>

                {/* Live Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      ⏱️ {activeJourney.startTime ? calculateDuration(activeJourney.startTime) : '0m'}
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
                onClick={() => {
                  // Handle pause/resume logic here
                }}
                className="h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-lg"
              >
                <div className="flex flex-col items-center space-y-1">
                  {activeJourney.status === 'active' ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  <span className="text-sm">{activeJourney.status === 'active' ? 'Pause' : 'Resume'}</span>
                </div>
              </Button>

              <Button
                onClick={() => {
                  // Handle quick check-in
                }}
                className="h-16 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-lg"
              >
                <div className="flex flex-col items-center space-y-1">
                  <Store className="w-6 h-6" />
                  <span className="text-sm">Check-in</span>
                </div>
              </Button>
            </div>

            {/* System Status */}
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
              className="w-full h-16 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-semibold rounded-3xl shadow-2xl"
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
    </div>
  );
}