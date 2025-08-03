import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Square, MapPin, Clock, Navigation, Pause, Play,
  Users, CheckCircle, AlertCircle, Battery, Wifi,
  Target, Route, Store, TrendingUp
} from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
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
  wakeLock?: WakeLockSentinel | null;
}

interface DealerCheckIn {
  id: string;
  dealerName: string;
  checkInTime: string;
  location: string;
}

export default function JourneyTracker({ userId, onJourneyEnd }: JourneyTrackerProps) {
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
  const [showQuickActions, setShowQuickActions] = useState(false);
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
      // ✅ HOOK TO RIGHT ENDPOINT: Check active journey
      const response = await fetch(`/api/journey/active/${userId}`);
      const data = await response.json();

      if (data.success && data.hasActiveJourney && data.data) {
        setActiveJourney({
          id: data.data.journey.id,
          startTime: data.data.journey.checkInTime,
          duration: data.data.status.duration,
          totalDistance: data.data.status.totalDistance,
          trackingPoints: data.data.status.trackingPoints,
          activeCheckins: data.data.status.activeCheckins,
          status: 'active'
        });

        // Get active dealer check-ins
        if (data.data.activeCheckins) {
          setDealerCheckins(data.data.activeCheckins);
        }

        startLocationTracking();
      }
    } catch (error) {
      console.error('Error checking active journey:', error);
      setErrorMessage('Failed to check journey status');
    } finally {
      setIsLoading(false);
    }
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

        // Automatically send tracking data if journey is active
        if (activeJourney) {
          sendLocationUpdate(newLocation);
        }

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

  // 📡 SEND LOCATION UPDATE TO BACKEND
  const sendLocationUpdate = async (location: LocationData) => {
    if (!activeJourney) return;

    try {
      // ✅ HOOK TO RIGHT ENDPOINT: Track location during journey
      const response = await fetch('/api/journey/track', {
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
          batteryLevel,
          networkStatus,
          appState: 'active'
        })
      });

      const data = await response.json();
      if (data.success && data.progress) {
        // Update journey stats from backend response
        setActiveJourney(prev => prev ? {
          ...prev,
          totalDistance: data.progress.totalDistance,
          trackingPoints: (prev.trackingPoints || 0) + 1
        } : null);
      }
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  };

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

    // 🛡️ SAFE: Wake lock wrapped in try-catch
    let wakeLock = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        setJourneyWakeLock(wakeLock); // Store in separate state
        console.log('Screen Wake Lock activated');
      }
    } catch (wakeLockError) {
      console.log('Wake lock not available, continuing without it');
    }

    try {
      // Your existing API call stays exactly the same
      const response = await fetch('/api/journey/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          journeyType: 'simple',
          plannedDealers: [],
          siteName: 'New Journey',
          accuracy: currentLocation.accuracy,
          batteryLevel,
          isCharging: false,
          networkStatus,
          description: 'Journey started from PWA',
          priority: 'medium'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Your existing setActiveJourney stays exactly the same
        setActiveJourney({
          id: data.data.id,
          startTime: data.data.checkInTime,
          duration: '0 min',
          totalDistance: '0.000 km',
          trackingPoints: 0,
          activeCheckins: 0,
          status: 'active'
        });

        startLocationTracking();
        setErrorMessage('');
      } else {
        // Clean up wake lock if journey failed
        if (wakeLock) {
          wakeLock.release();
          setJourneyWakeLock(null);
        }
        setErrorMessage(data.error || 'Failed to start journey');
      }
    } catch (error) {
      // Clean up wake lock on error
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

  const handlePauseResume = async () => {
    if (!activeJourney) return;

    const newStatus = activeJourney.status === 'active' ? 'paused' : 'active';

    try {
      const endpoint = newStatus === 'paused' ? '/api/journey/pause' : '/api/journey/resume';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          journeyId: activeJourney.id,
          location: currentLocation
        })
      });

      const data = await response.json();
      if (data.success) {
        // Handle wake lock
        if (newStatus === 'paused') {
          // Release wake lock when pausing
          if (journeyWakeLock) {
            try {
              journeyWakeLock.release();
              setJourneyWakeLock(null);
              console.log('Wake lock released - journey paused');
            } catch (wakeLockError) {
              console.log('Wake lock release failed, continuing normally');
            }
          }
        } else {
          // Request wake lock when resuming
          try {
            if ('wakeLock' in navigator) {
              const newWakeLock = await navigator.wakeLock.request('screen');
              setJourneyWakeLock(newWakeLock);
              console.log('Wake lock reactivated - journey resumed');
            }
          } catch (wakeLockError) {
            console.log('Wake lock not available on resume, continuing without it');
          }
        }

        setActiveJourney(prev => prev ? { ...prev, status: newStatus } : null);

        if (newStatus === 'paused') {
          if (locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            setLocationWatchId(null);
          }
        } else {
          startLocationTracking();
        }
      }
    } catch (error) {
      console.error('Error pausing/resuming journey:', error);
      setErrorMessage('Failed to pause/resume journey');
    }
  };

  // 🏪 QUICK DEALER CHECK-IN
  const handleQuickDealerCheckIn = async () => {
    if (!currentLocation || !activeJourney) return;

    setIsLoading(true);
    try {
      // ✅ FIXED: Use correct API parameters
      const response = await fetch('/api/journey/dealer-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dealerId: 'quick-checkin-location', // ✅ FIXED: Need a dealerId
          latitude: currentLocation.lat, // ✅ FIXED: Changed from endLatitude
          longitude: currentLocation.lng, // ✅ FIXED: Changed from endLongitude
          accuracy: currentLocation.accuracy,
          visitPurpose: 'quick_visit', // ✅ FIXED: Use underscore format
          expectedDuration: '30 minutes',
          notes: 'Quick check-in from journey tracker',
          batteryLevel: batteryLevel,
          networkStatus: networkStatus
        })
      });

      const data = await response.json();
      if (data.success) {
        // 🛡️ SAFE: Refresh wake lock during check-in (optional safety measure)
        if (activeJourney.wakeLock) {
          try {
            // Just check if wake lock is still active, don't change anything
            if (activeJourney.wakeLock.released) {
              console.log('Wake lock was released, journey still continues normally');
            }
          } catch (wakeLockError) {
            // Silently continue - this is just a health check
            console.log('Wake lock check during checkin - no issues');
          }
        }

        const newCheckin: DealerCheckIn = {
          id: data.data.id,
          dealerName: data.dealerVisit?.dealer?.name || 'Quick Check-in Location',
          checkInTime: data.data.checkInTime,
          location: `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
        };

        setDealerCheckins(prev => [...prev, newCheckin]);
        setActiveJourney(prev => prev ? { ...prev, activeCheckins: prev.activeCheckins + 1 } : null);
        setErrorMessage('');
      } else {
        setErrorMessage(data.error || 'Failed to check in');
      }
    } catch (error) {
      console.error('Error with dealer check-in:', error);
      setErrorMessage('Failed to check in at location');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔚 END JOURNEY
  const handleEndJourney = async () => {
    if (!activeJourney) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/journey/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng,
          journeyNotes: 'Journey completed via PWA tracker',
          totalStops: dealerCheckins.length,
          fuelUsed: 'Not specified',
          expensesClaimed: 'Not specified'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Release wake lock when journey ends
        if (journeyWakeLock) {
          try {
            journeyWakeLock.release();
            setJourneyWakeLock(null);
            console.log('Wake lock released - journey ended');
          } catch (wakeLockError) {
            console.log('Wake lock release failed, continuing normally');
          }
        }

        // Your existing logic stays the same
        const summary = data.journeyStats || {
          duration: activeJourney.duration,
          totalDistance: activeJourney.totalDistance,
          dealersVisited: dealerCheckins.length
        };

        alert(`🎉 Journey Complete!\n\n📊 Summary:\n⏱️ Duration: ${summary.duration}\n📍 Distance: ${summary.totalDistance}\n🏪 Dealers Visited: ${summary.stops || dealerCheckins.length}\n\nGreat work! 👏`);

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
      // Fallback cleanup
      if (journeyWakeLock) {
        try {
          journeyWakeLock.release();
          setJourneyWakeLock(null);
        } catch (wakeLockError) {
          console.log('Fallback wake lock release failed, no issues');
        }
      }
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

    // Network status monitoring
    window.addEventListener('online', () => setNetworkStatus('online'));
    window.addEventListener('offline', () => setNetworkStatus('offline'));
  };

  // 🎨 UI HELPERS
  const getTrackingModeColor = () => {
    switch (trackingMode) {
      case 'conservative': return 'bg-green-100 text-green-800';
      case 'balanced': return 'bg-blue-100 text-blue-800';
      case 'precise': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // 📱 RENDER
  if (isLoading) {
    return (
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="p-6 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-blue-700">Loading journey tracker...</p>
        </CardContent>
      </Card>
    );
  }

  if (!activeJourney) {
    return (
      <Card className="mb-6 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center">
            <Route className="w-5 h-5 mr-2 text-blue-600" />
            Start Your Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {currentLocation && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>📍 Location Ready</span>
                <span>{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}</span>
              </div>
            )}

            <Button
              onClick={handleStartJourney}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
              disabled={!currentLocation}
            >
              <Navigation className="w-5 h-5 mr-2" />
              Start New Journey
            </Button>

            <p className="text-xs text-gray-500 text-center">
              {!currentLocation ? 'Getting your location...' : 'Ready to track your journey!'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-green-800 flex items-center justify-between">
          <div className="flex items-center">
            <Navigation className="w-5 h-5 mr-2" />
            Journey Active
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getTrackingModeColor()}>
              {trackingMode}
            </Badge>
            {activeJourney.status === 'active' && (
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {errorMessage && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Journey Stats - Kid Friendly with Emojis */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/70 rounded-lg p-3">
              <div className="text-xl font-bold text-green-700">
                ⏱️ {activeJourney.startTime ? formatDuration(activeJourney.startTime) : '0m'}
              </div>
              <div className="text-xs text-green-600">Time</div>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              <div className="text-xl font-bold text-blue-700">
                📍 {activeJourney.totalDistance}
              </div>
              <div className="text-xs text-blue-600">Distance</div>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              <div className="text-xl font-bold text-purple-700">
                🏪 {dealerCheckins.length}
              </div>
              <div className="text-xs text-purple-600">Visits</div>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-white/70 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {activeJourney.status === 'active' ? '🚗 Tracking your location...' : '⏸️ Journey paused'}
              </span>
              <span className="text-xs text-gray-500">
                Updated {Math.round((new Date().getTime() - lastUpdate.getTime()) / 1000)}s ago
              </span>
            </div>

            {currentLocation && (
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>📱 GPS: {currentLocation.accuracy?.toFixed(0)}m accuracy</span>
                <span>🔋 {batteryLevel}% • {networkStatus === 'online' ? '🌐' : '📴'}</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handlePauseResume}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-100"
              disabled={isLoading}
            >
              {activeJourney.status === 'active' ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              )}
            </Button>

            <Button
              onClick={handleQuickDealerCheckIn}
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-100"
              disabled={isLoading || !currentLocation}
            >
              <Store className="w-4 h-4 mr-2" />
              Check-in
            </Button>
          </div>

          {/* Active Check-ins */}
          {dealerCheckins.length > 0 && (
            <div className="bg-white/70 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">🏪 Recent Check-ins</h4>
              <div className="space-y-2">
                {dealerCheckins.slice(-3).map(checkin => (
                  <div key={checkin.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{checkin.dealerName}</span>
                    <span className="text-gray-500">
                      {new Date(checkin.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Journey Button */}
          <Button
            onClick={handleEndJourney}
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
          >
            <Square className="w-4 h-4 mr-2" />
            {isLoading ? 'Ending Journey...' : '🏁 End Journey'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}