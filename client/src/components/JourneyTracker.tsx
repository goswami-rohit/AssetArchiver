import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Square, MapPin, Clock, Navigation, Pause, Play, ArrowLeft,
  Users, CheckCircle, AlertCircle, Battery, Wifi, MoreHorizontal,
  Target, Route, Store, TrendingUp, Camera, Share, Heart,
  Zap, Signal, Smartphone, Activity, Eye, Settings, Shield,
  Radar, Bell, MapPinned, Navigation2, Moon, Sun, Globe,
  Locate, RefreshCw, AlertTriangle, Info, Award, BarChart3,
  Car, Bike, MapPinIcon, PhoneCall, MessageCircle, Timer,
  Footprints, Gauge, Compass, Satellite, Radio, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  timestamp?: string;
}

interface JourneyData {
  id: string;
  tripId?: string;
  startTime: string;
  duration: string;
  totalDistance: string;
  trackingPoints: number;
  activeCheckins: number;
  status: 'active' | 'paused' | 'completed';
  fraudDetected: boolean;
  locationValidated: boolean;
  mode: 'car' | 'walking' | 'bike';
  metadata?: any;
}

interface DealerCheckIn {
  id: string;
  dealerName: string;
  checkInTime: string;
  location: string;
  validated: boolean;
  distance?: number;
  orderValue?: number;
  visitType?: string;
}

interface ApproachAlert {
  isApproaching: boolean;
  dealerName?: string;
  eta?: string;
  distance?: number;
  geofenceId?: string;
}

interface GeofenceEvent {
  type: 'enter' | 'exit';
  geofenceName: string;
  timestamp: string;
  confidence: number;
}

interface AnalyticsData {
  totalJourneys: number;
  totalDistance: string;
  totalTime: string;
  averageSpeed: string;
  dealersVisited: number;
  efficiency: number;
}

// ============= ENHANCED WAKE LOCK MANAGER =============
class SmartWakeLock {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean;
  private listeners: ((isActive: boolean) => void)[] = [];
  private releaseTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.isSupported = 'wakeLock' in navigator;
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.scheduleRelease('app_backgrounded', 30000); // 30 seconds delay
      } else if (document.visibilityState === 'visible' && this.shouldMaintainWakeLock()) {
        this.clearScheduledRelease();
        this.requestWakeLock('app_foregrounded');
      }
    });
  }

  private shouldMaintainWakeLock(): boolean {
    return document.body.dataset.journeyActive === 'true';
  }

  private scheduleRelease(reason: string, delay: number) {
    this.clearScheduledRelease();
    this.releaseTimeout = setTimeout(() => {
      this.releaseWakeLock(reason);
    }, delay);
  }

  private clearScheduledRelease() {
    if (this.releaseTimeout) {
      clearTimeout(this.releaseTimeout);
      this.releaseTimeout = null;
    }
  }

  async requestWakeLock(reason: string = 'journey_active'): Promise<boolean> {
    if (!this.isSupported) {
      console.log('Wake Lock not supported');
      return false;
    }

    try {
      this.clearScheduledRelease();
      
      if (this.wakeLock) {
        await this.releaseWakeLock('replacing_lock');
      }

      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      console.log(`🔐 Wake Lock acquired: ${reason}`);
      
      document.body.dataset.journeyActive = 'true';
      
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
    this.clearScheduledRelease();
    
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
  // ============= CORE STATE =============
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [activeJourney, setActiveJourney] = useState<JourneyData | null>(null);
  const [dealerCheckins, setDealerCheckins] = useState<DealerCheckIn[]>([]);
  const [trackingMode, setTrackingMode] = useState<'conservative' | 'balanced' | 'precise'>('balanced');
  const [journeyMode, setJourneyMode] = useState<'car' | 'walking' | 'bike'>('car');

  // ============= RADAR INTEGRATION STATE =============
  const [approachAlert, setApproachAlert] = useState<ApproachAlert>({ isApproaching: false });
  const [radarTripId, setRadarTripId] = useState<string | null>(null);
  const [locationValidation, setLocationValidation] = useState({ isValid: true, confidence: 100 });
  const [fraudAlerts, setFraudAlerts] = useState<string[]>([]);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [publishableKey, setPublishableKey] = useState<string>('');

  // ============= SMART WAKE LOCK STATE =============
  const [wakeLockManager] = useState(() => new SmartWakeLock());
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // ============= SYSTEM STATUS =============
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [signalStrength, setSignalStrength] = useState<number>(4);

  // ============= UI STATE =============
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ============= REFS =============
  const trackingInterval = useRef<NodeJS.Timeout | null>(null);
  const syncInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // ============= WAKE LOCK SETUP =============
  useEffect(() => {
    wakeLockManager.onStateChange((isActive) => {
      setWakeLockActive(isActive);
    });

    return () => {
      wakeLockManager.releaseWakeLock('component_unmount');
    };
  }, [wakeLockManager]);

  // ============= INITIALIZATION =============
  useEffect(() => {
    initializeJourneyTracker();
    setupSystemMonitoring();
    
    return () => {
      cleanup();
    };
  }, [userId]);

  const cleanup = () => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
    }
    if (syncInterval.current) {
      clearInterval(syncInterval.current);
    }
    wakeLockManager.releaseWakeLock('cleanup');
  };

  // ============= SYSTEM MONITORING =============
  const setupSystemMonitoring = () => {
    // Battery monitoring
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
        
        battery.addEventListener('levelchange', () => {
          const newBatteryLevel = Math.round(battery.level * 100);
          setBatteryLevel(newBatteryLevel);
          
          if (newBatteryLevel < 10 && wakeLockManager.isActive()) {
            wakeLockManager.releaseWakeLock('critical_low_battery');
            toast({
              title: "Battery Critical",
              description: "Screen lock released to save battery",
              variant: "destructive",
            });
          }
        });

        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      });
    }

    // Network monitoring
    window.addEventListener('online', () => {
      setNetworkStatus('online');
      toast({
        title: "Back Online",
        description: "Journey data will sync automatically",
      });
    });
    
    window.addEventListener('offline', () => {
      setNetworkStatus('offline');
      toast({
        title: "Offline Mode",
        description: "Journey data stored locally",
        variant: "destructive",
      });
    });

    // Connection quality monitoring
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const updateSignalStrength = () => {
        const effectiveType = connection.effectiveType;
        const strengthMap = { '4g': 4, '3g': 3, '2g': 2, 'slow-2g': 1 };
        setSignalStrength(strengthMap[effectiveType] || 4);
      };
      
      updateSignalStrength();
      connection.addEventListener('change', updateSignalStrength);
    }
  };

  // ============= LOCATION TRACKING OPTIONS =============
  const getLocationOptions = useCallback(() => {
    const options = {
      conservative: {
        enableHighAccuracy: false,
        maximumAge: 300000, // 5 minutes
        timeout: 30000,
        distanceFilter: 200
      },
      balanced: {
        enableHighAccuracy: true,
        maximumAge: 120000, // 2 minutes
        timeout: 20000,
        distanceFilter: 50
      },
      precise: {
        enableHighAccuracy: true,
        maximumAge: 30000, // 30 seconds
        timeout: 15000,
        distanceFilter: 10
      }
    };
    return options[trackingMode];
  }, [trackingMode]);

  // ============= INITIALIZATION =============
  const initializeJourneyTracker = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Get Radar publishable key
      const keyResponse = await fetch('/api/radar/publishable-key');
      if (keyResponse.ok) {
        const keyData = await keyResponse.json();
        setPublishableKey(keyData.publishableKey);
      }

      // Check for active journey from geo-tracking
      const today = new Date().toISOString().split('T')[0];
      const geoResponse = await fetch(`/api/geo-tracking?userId=${userId}&startDate=${today}&endDate=${today}&limit=50`);
      
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        const trackingEntries = geoData.data || [];
        
        // Find active journey
        const activeTracking = trackingEntries.find((entry: any) => 
          entry.activityType === 'journey_tracking' && !entry.checkOutTime
        );

        if (activeTracking) {
          const journeyStats = calculateJourneyStats(trackingEntries, activeTracking.id);
          
          setActiveJourney({
            id: activeTracking.id,
            tripId: activeTracking.tripId,
            startTime: activeTracking.recordedAt,
            duration: journeyStats.duration,
            totalDistance: journeyStats.distance,
            trackingPoints: journeyStats.points,
            activeCheckins: journeyStats.checkins,
            status: 'active',
            fraudDetected: false,
            locationValidated: true,
            mode: activeTracking.mode || 'car',
            metadata: activeTracking.metadata
          });

          setRadarTripId(activeTracking.tripId);
          await wakeLockManager.requestWakeLock('resumed_active_journey');
          startLocationTracking();
          
          toast({
            title: "Journey Resumed",
            description: "Continuing your active journey with smart tracking",
          });
        }

        // Load recent check-ins
        loadRecentCheckins();
        
        // Load analytics
        loadAnalytics();
      }

      await getCurrentLocation();
      setIsInitialized(true);
      
    } catch (error) {
      console.error('Initialization failed:', error);
      setErrorMessage('Failed to initialize journey tracker');
      toast({
        title: "Initialization Failed",
        description: "Unable to connect to tracking services",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= JOURNEY STATS CALCULATION =============
  const calculateJourneyStats = (trackingEntries: any[], journeyId: string) => {
    const journeyEntries = trackingEntries.filter((entry: any) => 
      entry.journeyId === journeyId || entry.id === journeyId
    ).sort((a: any, b: any) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    if (journeyEntries.length === 0) {
      return { duration: '0m', distance: '0.000 km', points: 0, checkins: 0 };
    }

    // Calculate duration
    const start = new Date(journeyEntries[0].recordedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    // Calculate distance using Haversine formula
    let totalDistance = 0;
    for (let i = 1; i < journeyEntries.length; i++) {
      const prev = journeyEntries[i - 1];
      const curr = journeyEntries[i];
      
      const R = 6371; // Earth's radius in km
      const dLat = (parseFloat(curr.latitude) - parseFloat(prev.latitude)) * Math.PI / 180;
      const dLon = (parseFloat(curr.longitude) - parseFloat(prev.longitude)) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(parseFloat(prev.latitude) * Math.PI / 180) * 
                Math.cos(parseFloat(curr.latitude) * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }

    const checkins = trackingEntries.filter((entry: any) => 
      entry.activityType === 'dealer_checkin'
    ).length;

    return {
      duration,
      distance: `${totalDistance.toFixed(3)} km`,
      points: journeyEntries.length,
      checkins
    };
  };

  // ============= LOAD RECENT CHECK-INS =============
  const loadRecentCheckins = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/daily-visit-reports?userId=${userId}&reportDate=${today}&limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        const checkins = (data.data || []).map((report: any) => ({
          id: report.id,
          dealerName: report.dealerName,
          checkInTime: new Date(report.createdAt).toLocaleTimeString(),
          location: report.location,
          validated: !!report.locationValidation,
          distance: report.distance,
          orderValue: parseFloat(report.orderValue || '0'),
          visitType: report.visitPurpose
        }));
        
        setDealerCheckins(checkins);
      }
    } catch (error) {
      console.error('Failed to load check-ins:', error);
    }
  };

  // ============= LOAD ANALYTICS =============
  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/radar/analytics/region/default?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData({
          totalJourneys: data.totalJourneys || 0,
          totalDistance: data.totalDistance || '0 km',
          totalTime: data.totalTime || '0h',
          averageSpeed: data.averageSpeed || '0 km/h',
          dealersVisited: data.dealersVisited || 0,
          efficiency: data.efficiency || 0
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  // ============= GET CURRENT LOCATION =============
  const getCurrentLocation = () => {
    return new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation not supported';
        setErrorMessage(error);
        reject(new Error(error));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
            altitude: position.coords.altitude || 0,
            timestamp: new Date().toISOString()
          };
          
          setCurrentLocation(location);
          setErrorMessage('');
          resolve();
        },
        (error) => {
          console.error('Location error:', error);
          const errorMsg = error.code === 1 ? 'Location access denied' : 'Location unavailable';
          setErrorMessage(errorMsg);
          toast({
            title: "Location Error",
            description: errorMsg + ". Please enable GPS.",
            variant: "destructive",
          });
          reject(error);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 60000 
        }
      );
    });
  };

  // ============= START LOCATION TRACKING =============
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
          altitude: position.coords.altitude || 0,
          timestamp: new Date().toISOString()
        };

        setCurrentLocation(newLocation);
        setLastUpdate(new Date());

        // Smart wake lock based on movement and battery
        const speedKmh = (newLocation.speed || 0) * 3.6;
        if (speedKmh > 1 && !wakeLockManager.isActive() && batteryLevel > 15) {
          await wakeLockManager.requestWakeLock('movement_detected');
        } else if (speedKmh < 0.5 && wakeLockManager.isActive() && batteryLevel < 20) {
          setTimeout(() => {
            if ((currentLocation?.speed || 0) * 3.6 < 0.5) {
              wakeLockManager.releaseWakeLock('stationary_low_battery');
            }
          }, 30000);
        }

        // Auto-adjust tracking mode based on speed
        autoAdjustTrackingMode(newLocation.speed || 0);
        
        // Check for approaching dealers
        await checkApproachingDealers(newLocation);
        
        // Log tracking point
        await logTrackingPoint(newLocation);
        
        // Update journey stats
        updateJourneyStats();
        
      },
      (error) => {
        console.error('Location tracking error:', error);
        toast({
          title: "Tracking Error",
          description: `Location error: ${error.message}`,
          variant: "destructive",
        });
      },
      options
    );

    setLocationWatchId(watchId);
  }, [activeJourney, trackingMode, getLocationOptions, batteryLevel]);

  // ============= AUTO ADJUST TRACKING MODE =============
  const autoAdjustTrackingMode = (speed: number) => {
    const speedKmh = speed * 3.6;
    let newMode: 'conservative' | 'balanced' | 'precise' = 'conservative';
    
    if (speedKmh > 50) newMode = 'precise';
    else if (speedKmh > 10) newMode = 'balanced';
    else newMode = 'conservative';

    if (newMode !== trackingMode) {
      setTrackingMode(newMode);
      toast({
        title: "Tracking Mode",
        description: `Switched to ${newMode} tracking`,
      });
    }
  };

  // ============= CHECK APPROACHING DEALERS =============
  const checkApproachingDealers = async (location: LocationData) => {
    try {
      const response = await fetch('/api/radar/context', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const contextData = await response.json();
        
        // Check if approaching any geofences
        if (contextData.geofences && contextData.geofences.length > 0) {
          const nearestGeofence = contextData.geofences[0];
          
          setApproachAlert({
            isApproaching: true,
            dealerName: nearestGeofence.description,
            distance: Math.round(nearestGeofence.distance),
            eta: calculateETA(nearestGeofence.distance, location.speed || 0),
            geofenceId: nearestGeofence.id
          });
        } else {
          setApproachAlert({ isApproaching: false });
        }
      }
    } catch (error) {
      console.warn('Dealer approach check failed:', error);
    }
  };

  const calculateETA = (distance: number, speed: number): string => {
    if (speed <= 0) return '∞';
    const timeInSeconds = distance / (speed || 1);
    const minutes = Math.round(timeInSeconds / 60);
    return minutes > 0 ? `${minutes}m` : '<1m';
  };

  // ============= LOG TRACKING POINT =============
  const logTrackingPoint = async (location: LocationData) => {
    if (!activeJourney) return;

    try {
      await fetch('/api/radar/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.toString(),
          latitude: location.lat,
          longitude: location.lng,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          altitude: location.altitude,
          batteryLevel: batteryLevel,
          isCharging: isCharging,
          networkStatus: networkStatus,
          appState: 'foreground',
          locationType: trackingMode,
          activityType: 'journey_tracking',
          siteName: `Journey Point ${new Date().toLocaleTimeString()}`,
          journeyId: activeJourney.id,
          tripId: radarTripId
        })
      });
    } catch (error) {
      console.warn('Failed to log tracking point:', error);
    }
  };

  // ============= UPDATE JOURNEY STATS =============
  const updateJourneyStats = () => {
    if (!activeJourney) return;

    const duration = calculateDuration(activeJourney.startTime);
    
    setActiveJourney(prev => prev ? {
      ...prev,
      duration,
      trackingPoints: prev.trackingPoints + 1
    } : null);
  };

  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // ============= START NEW JOURNEY =============
  const handleStartJourney = async () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please enable location services to start journey",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Request wake lock
      const wakeLockAcquired = await wakeLockManager.requestWakeLock('journey_started');

      // Start Radar journey
      const journeyId = `journey_${userId}_${Date.now()}`;
      
      const radarResponse = await fetch('/api/radar/journey/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.toString(),
          dealerId: 'mobile_journey',
          mode: journeyMode,
          metadata: {
            startedFrom: 'mobile_app',
            trackingMode,
            wakeLockActive: wakeLockAcquired,
            journeyId: journeyId,
            deviceInfo: {
              batteryLevel,
              isCharging,
              networkStatus,
              signalStrength
            }
          }
        })
      });

      let tripData = null;
      if (radarResponse.ok) {
        tripData = await radarResponse.json();
        setRadarTripId(tripData.trip?.externalId || journeyId);
      }

      // Create initial geo-tracking record
      const trackingResponse = await fetch('/api/geo-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recordedAt: new Date().toISOString(),
          latitude: currentLocation.lat.toString(),
          longitude: currentLocation.lng.toString(),
          accuracy: currentLocation.accuracy?.toString(),
          speed: currentLocation.speed?.toString(),
          heading: currentLocation.heading?.toString(),
          altitude: currentLocation.altitude?.toString(),
          batteryLevel,
          isCharging,
          networkStatus,
          appState: 'foreground',
          siteName: `Journey Start - ${new Date().toLocaleTimeString()}`,
          activityType: 'journey_tracking',
          locationType: trackingMode,
          journeyId: journeyId,
          tripId: radarTripId,
          mode: journeyMode
        })
      });

      if (trackingResponse.ok) {
        const trackingData = await trackingResponse.json();
        
        setActiveJourney({
          id: journeyId,
          tripId: radarTripId || journeyId,
          startTime: new Date().toISOString(),
          duration: '0m',
          totalDistance: '0.000 km',
          trackingPoints: 1,
          activeCheckins: 0,
          status: 'active',
          fraudDetected: false,
          locationValidated: true,
          mode: journeyMode,
          metadata: { wakeLockActive: wakeLockAcquired }
        });

        startLocationTracking();
        
        toast({
          title: "Journey Started",
          description: `Smart tracking active ${wakeLockAcquired ? 'with screen lock' : 'with battery optimization'}`,
        });
        
        setSuccessMessage(`🚀 Journey started in ${journeyMode} mode!`);
      } else {
        throw new Error('Failed to create tracking record');
      }

    } catch (error) {
      await wakeLockManager.releaseWakeLock('journey_start_failed');
      console.error('Error starting journey:', error);
      setErrorMessage('Failed to start journey');
      toast({
        title: "Journey Start Failed",
        description: "Unable to start journey tracking",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= PAUSE/RESUME JOURNEY =============
  const handlePauseResumeJourney = async () => {
    if (!activeJourney || !radarTripId) return;

    setIsLoading(true);
    
    try {
      const action = activeJourney.status === 'active' ? 'pause' : 'resume';
      
      // Update Radar journey
      const response = await fetch(`/api/radar/journey/${radarTripId}/${action === 'pause' ? 'cancel' : 'start'}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            pausedAt: action === 'pause' ? new Date().toISOString() : undefined,
            resumedAt: action === 'resume' ? new Date().toISOString() : undefined
          }
        })
      });

      if (action === 'pause') {
        await wakeLockManager.releaseWakeLock('journey_paused');
        if (locationWatchId) {
          navigator.geolocation.clearWatch(locationWatchId);
          setLocationWatchId(null);
        }
        toast({
          title: "Journey Paused",
          description: "Screen lock released to save battery",
        });
      } else {
        const wakeLockAcquired = await wakeLockManager.requestWakeLock('journey_resumed');
        startLocationTracking();
        toast({
          title: "Journey Resumed",
          description: `Tracking resumed ${wakeLockAcquired ? 'with screen lock' : 'with battery optimization'}`,
        });
      }

      setActiveJourney(prev => prev ? {
        ...prev,
        status: prev.status === 'active' ? 'paused' : 'active'
      } : null);

    } catch (error) {
      console.error('Error pausing/resuming journey:', error);
      toast({
        title: "Action Failed",
        description: "Unable to pause/resume journey",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= END JOURNEY =============
  const handleEndJourney = async () => {
    if (!activeJourney) return;

    setIsLoading(true);
    
    try {
      // Complete Radar journey
      if (radarTripId) {
        await fetch(`/api/radar/journey/${radarTripId}/complete`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: {
              completedAt: new Date().toISOString(),
              finalLocation: currentLocation,
              totalCheckins: dealerCheckins.length
            }
          })
        });
      }

      // Update geo-tracking record
      if (currentLocation) {
        await fetch('/api/geo-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            recordedAt: new Date().toISOString(),
            latitude: currentLocation.lat.toString(),
            longitude: currentLocation.lng.toString(),
            accuracy: currentLocation.accuracy?.toString(),
            siteName: `Journey End - ${new Date().toLocaleTimeString()}`,
            activityType: 'journey_completed',
            locationType: trackingMode,
            journeyId: activeJourney.id,
            tripId: radarTripId,
            checkOutTime: new Date().toISOString()
          })
        });
      }

      // Release wake lock
      await wakeLockManager.releaseWakeLock('journey_completed');

      // Stop location tracking
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        setLocationWatchId(null);
      }

      const duration = calculateDuration(activeJourney.startTime);
      
      toast({
        title: "Journey Complete",
        description: `Duration: ${duration} • Screen lock released`,
      });

      // Reset state
      setActiveJourney(null);
      setDealerCheckins([]);
      setRadarTripId(null);
      setApproachAlert({ isApproaching: false });
      setErrorMessage('');

      // Reload analytics
      await loadAnalytics();

      setTimeout(() => {
        onJourneyEnd();
      }, 2000);

    } catch (error) {
      console.error('Error ending journey:', error);
      toast({
        title: "End Journey Failed",
        description: "Unable to complete journey",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= QUICK CHECK-IN =============
  const handleQuickCheckIn = async () => {
    if (!activeJourney || !currentLocation) {
      toast({
        title: "Check-in Failed",
        description: "No active journey or location unavailable",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const checkInData = {
        userId,
        reportDate: new Date().toISOString().split('T')[0],
        location: `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`,
        dealerName: `Quick Check-in ${dealerCheckins.length + 1}`,
        visitPurpose: 'Quick Check-in',
        visitOutcome: 'Quick check-in via journey tracker',
        orderValue: '0',
        collectionAmount: '0',
        marketFeedback: 'Mobile app check-in',
        nextActionPlan: 'Follow up visit',
        latitude: currentLocation.lat.toString(),
        longitude: currentLocation.lng.toString()
      };

      const response = await fetch('/api/daily-visit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData)
      });

      if (response.ok) {
        const data = await response.json();
        
        const newCheckIn: DealerCheckIn = {
          id: data.id || `checkin_${Date.now()}`,
          dealerName: checkInData.dealerName,
          checkInTime: new Date().toLocaleTimeString(),
          location: checkInData.location,
          validated: true,
          visitType: 'Quick Check-in'
        };

        setDealerCheckins(prev => [...prev, newCheckIn]);
        setActiveJourney(prev => prev ? { 
          ...prev, 
          activeCheckins: prev.activeCheckins + 1 
        } : null);

        toast({
          title: "Check-in Recorded",
          description: "Quick check-in saved with location validation",
        });
        
      } else {
        throw new Error('Failed to create check-in');
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      toast({
        title: "Check-in Failed",
        description: "Unable to record check-in",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= LOADING STATE =============
  if (isLoading && !isInitialized) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center"
      >
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl"
          >
            <Radar className="w-10 h-10 text-white" />
          </motion.div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Initializing Smart Tracker</h3>
          <p className="text-gray-600">Connecting to Radar.io services...</p>
          <div className="mt-4 flex justify-center">
            <Progress value={33} className="w-48" />
          </div>
        </div>
      </motion.div>
    );
  }

  // ============= MAIN RENDER =============
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col"
    >
      {/* ============= ENHANCED HEADER ============= */}
      <motion.div 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="bg-white/90 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-20 shadow-lg"
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {onBack && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="h-12 w-12 ring-2 ring-blue-500/30">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 text-white">
                  <Radar className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-bold text-lg text-gray-900">Journey Tracker</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full transition-colors ${
                    networkStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span>Radar.io</span>
                  <div className="flex items-center space-x-1">
                    <Battery className={`w-3 h-3 ${
                      batteryLevel > 20 ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <span>{batteryLevel}%</span>
                    {isCharging && <Zap className="w-3 h-3 text-yellow-500" />}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Signal className="w-3 h-3" />
                    <div className="flex space-x-px">
                      {[1,2,3,4].map(bar => (
                        <div key={bar} className={`w-1 h-2 rounded-sm ${
                          bar <= signalStrength ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {wakeLockActive && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center space-x-1 bg-blue-100 px-2 py-1 rounded-full"
                >
                  <Sun className="w-3 h-3 text-blue-600" />
                  <span className="text-xs text-blue-700 font-medium">Screen Lock</span>
                </motion.div>
              )}
              
              {approachAlert.isApproaching && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="bg-orange-100 p-2 rounded-full"
                >
                  <Bell className="w-4 h-4 text-orange-600" />
                </motion.div>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============= APPROACH ALERT ============= */}
      <AnimatePresence>
        {approachAlert.isApproaching && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-4 p-4 bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-300 rounded-xl shadow-lg"
          >
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <MapPinned className="w-6 h-6 text-orange-600" />
              </motion.div>
              <div className="flex-1">
                <p className="font-semibold text-orange-800">Approaching Dealer</p>
                <p className="text-sm text-orange-700">
                  {approachAlert.dealerName} • {approachAlert.distance}m away • ETA: {approachAlert.eta}
                </p>
              </div>
              <Button
                onClick={handleQuickCheckIn}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Check In
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============= MAIN CONTENT ============= */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-4 mt-4 p-3 bg-green-100 border border-green-300 rounded-xl"
            >
              <p className="text-green-700 text-sm text-center font-medium">{successMessage}</p>
            </motion.div>
          )}
          
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-4 mt-4 p-3 bg-red-100 border border-red-300 rounded-xl"
            >
              <p className="text-red-700 text-sm text-center font-medium">{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {!activeJourney ? (
          /* ============= START JOURNEY SCREEN ============= */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 pb-8"
          >
            {/* Hero Section */}
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="w-32 h-32 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl"
              >
                <Navigation2 className="w-16 h-16 text-white" />
              </motion.div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ready for Smart Journey?
              </h2>
              <p className="text-gray-600 text-lg mb-4">Intelligent tracking with battery optimization</p>
            </div>

            {/* Journey Mode Selection */}
            <Card className="mb-6 bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Car className="w-5 h-5" />
                  <span>Journey Mode</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'car', icon: Car, label: 'Car' },
                    { key: 'walking', icon: Footprints, label: 'Walking' },
                    { key: 'bike', icon: Bike, label: 'Bike' }
                  ].map((mode) => (
                    <Button
                      key={mode.key}
                      variant={journeyMode === mode.key ? "default" : "outline"}
                      className={`h-16 flex flex-col space-y-1 ${
                        journeyMode === mode.key 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setJourneyMode(mode.key as any)}
                    >
                      <mode.icon className="w-6 h-6" />
                      <span className="text-sm">{mode.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Location Status */}
            {currentLocation ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                          <Satellite className="w-8 h-8 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">GPS Ready</h3>
                          <p className="text-sm text-gray-600 mb-1">
                            {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                          </p>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <Signal className="w-3 h-3 mr-1" />
                              {currentLocation.accuracy?.toFixed(0)}m accuracy
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                              {trackingMode}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Getting Location...</h3>
                        <p className="text-sm text-gray-600">Please enable GPS access</p>
                      </div>
                    </div>
                    <Button 
                      onClick={getCurrentLocation}
                      size="sm"
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <Battery className={`w-8 h-8 ${
                      batteryLevel > 20 ? 'text-green-600' : 'text-red-600'
                    }`} />
                    {isCharging && <Zap className="w-4 h-4 text-yellow-500 ml-1" />}
                  </div>
                  <p className="text-lg font-bold">{batteryLevel}%</p>
                  <p className="text-xs text-gray-500">
                    {batteryLevel < 20 ? 'Low Battery Mode' : 'Optimized Tracking'}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <Radio className={`w-8 h-8 ${
                      networkStatus === 'online' ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                  <p className="text-lg font-bold capitalize">{networkStatus}</p>
                  <p className="text-xs text-gray-500">
                    {networkStatus === 'online' ? 'Cloud Sync Active' : 'Local Storage'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Analytics Preview */}
            {analyticsData && (
              <Card className="mb-8 bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Your Journey History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{analyticsData.totalJourneys}</p>
                      <p className="text-xs text-gray-500">Journeys</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{analyticsData.totalDistance}</p>
                      <p className="text-xs text-gray-500">Distance</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{analyticsData.dealersVisited}</p>
                      <p className="text-xs text-gray-500">Dealers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Start Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleStartJourney}
                disabled={!currentLocation || isLoading}
                className="w-full h-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white text-xl font-bold rounded-3xl shadow-2xl transform transition-all duration-300"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 border-3 border-white border-t-transparent rounded-full"
                    />
                    <span>Starting Journey...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Play className="w-8 h-8" />
                    <span>Start Smart Journey</span>
                  </div>
                )}
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          /* ============= ACTIVE JOURNEY SCREEN ============= */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 space-y-6 pb-8"
          >
            {/* Journey Status Card */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <Card className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 text-white shadow-2xl overflow-hidden">
                <CardContent className="p-6 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                          className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center"
                        >
                          <Navigation className="w-8 h-8" />
                        </motion.div>
                        <div>
                          <h3 className="text-2xl font-bold">Journey Active</h3>
                          <div className="flex items-center space-x-2 text-white/90">
                            <Badge className="bg-white/20 text-white border-white/30">
                              {journeyMode}
                            </Badge>
                            <Badge className="bg-white/20 text-white border-white/30">
                              {trackingMode}
                            </Badge>
                            {wakeLockActive && (
                              <span className="flex items-center space-x-1 text-xs">
                                <Sun className="w-3 h-3" />
                                <span>Screen Lock</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {activeJourney.status === 'active' && (
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-4 h-4 bg-white rounded-full"
                          />
                        )}
                      </div>
                    </div>

                    {/* Live Stats */}
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <motion.div 
                          key={activeJourney.duration}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="text-3xl font-bold mb-1"
                        >
                          ⏱️ {activeJourney.duration}
                        </motion.div>
                        <div className="text-white/80 text-sm">Duration</div>
                      </div>
                      <div className="text-center">
                        <motion.div 
                          key={activeJourney.totalDistance}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="text-3xl font-bold mb-1"
                        >
                          📍 {activeJourney.totalDistance}
                        </motion.div>
                        <div className="text-white/80 text-sm">Distance</div>
                      </div>
                      <div className="text-center">
                        <motion.div 
                          key={activeJourney.activeCheckins}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="text-3xl font-bold mb-1"
                        >
                          🏪 {activeJourney.activeCheckins}
                        </motion.div>
                        <div className="text-white/80 text-sm">Check-ins</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Current Location */}
            {currentLocation && (
              <Card className="bg-white/90 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Current Location</p>
                        <p className="text-sm text-gray-600 font-mono">
                          {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </p>
                        {currentLocation.speed && currentLocation.speed > 0 && (
                          <div className="flex items-center space-x-2 mt-1">
                            <Gauge className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-gray-500">
                              {(currentLocation.speed * 3.6).toFixed(1)} km/h
                            </span>
                            {currentLocation.heading && (
                              <>
                                <Compass className="w-3 h-3 text-blue-500" />
                                <span className="text-xs text-gray-500">
                                  {currentLocation.heading.toFixed(0)}°
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        ±{currentLocation.accuracy?.toFixed(0)}m
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round((new Date().getTime() - lastUpdate.getTime()) / 1000)}s ago
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handlePauseResumeJourney}
                  disabled={isLoading}
                  className={`h-20 w-full rounded-2xl shadow-lg text-white font-semibold ${
                    activeJourney.status === 'active' 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700' 
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    {activeJourney.status === 'active' ? (
                      <Pause className="w-8 h-8" />
                    ) : (
                      <Play className="w-8 h-8" />
                    )}
                    <span className="text-sm">
                      {activeJourney.status === 'active' ? 'Pause & Save Battery' : 'Resume Tracking'}
                    </span>
                  </div>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleQuickCheckIn}
                  disabled={isLoading}
                  className="h-20 w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg"
                >
                  <div className="flex flex-col items-center space-y-2">
                    <Store className="w-8 h-8" />
                    <span className="text-sm">Quick Check-in</span>
                  </div>
                </Button>
              </motion.div>
            </div>

            {/* Recent Check-ins */}
            {dealerCheckins.length > 0 && (
              <Card className="bg-white/90 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Store className="w-5 h-5" />
                    <span>Recent Check-ins</span>
                    <Badge className="bg-blue-100 text-blue-800">{dealerCheckins.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dealerCheckins.slice(-3).map((checkin, index) => (
                      <motion.div
                        key={checkin.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            checkin.validated ? 'bg-green-100' : 'bg-orange-100'
                          }`}>
                            {checkin.validated ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-orange-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{checkin.dealerName}</p>
                            <p className="text-xs text-gray-500">{checkin.visitType}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">{checkin.checkInTime}</p>
                          {checkin.validated && (
                            <div className="flex items-center space-x-1 mt-1">
                              <Shield className="w-3 h-3 text-green-600" />
                              <span className="text-xs text-green-600">Verified</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status */}
            <Card className="bg-white/90 backdrop-blur-sm border border-gray-200/50 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Battery className={`w-5 h-5 ${
                        batteryLevel > 20 ? 'text-green-600' : 'text-red-600'
                      }`} />
                      <span className="text-sm font-medium">{batteryLevel}%</span>
                      {isCharging && <Zap className="w-4 h-4 text-yellow-500" />}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Radio className={`w-5 h-5 ${
                        networkStatus === 'online' ? 'text-green-600' : 'text-red-600'
                      }`} />
                      <span className="text-sm font-medium capitalize">{networkStatus}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {wakeLockActive ? (
                        <>
                          <Sun className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">Screen Lock</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-5 h-5 text-gray-500" />
                          <span className="text-sm font-medium text-gray-500">Battery Save</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {activeJourney.trackingPoints} tracking points
                    </p>
                    <p className="text-xs text-gray-500">
                      Mode: {trackingMode}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* End Journey */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleEndJourney}
                disabled={isLoading}
                className="w-full h-20 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xl font-bold rounded-3xl shadow-2xl transform transition-all duration-300"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 border-3 border-white border-t-transparent rounded-full"
                    />
                    <span>Ending Journey...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Square className="w-8 h-8" />
                    <span>🏁 End Journey & Release Lock</span>
                  </div>
                )}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}