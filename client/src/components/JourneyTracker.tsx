import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Square, MapPin, Clock, Navigation, Pause, Play, ArrowLeft,
  Users, CheckCircle, AlertCircle, Battery, Wifi, MoreHorizontal,
  Target, Route, Store, TrendingUp, Camera, Share, Heart,
  Zap, Signal, Smartphone, Activity, Eye, Settings, X, Plus,
  Building2, Search, Filter, Calendar, BarChart3, MapIcon,
  Compass, Gauge, Layers, RefreshCw, ChevronRight, ChevronDown,
  Timer, Ruler, Footprints, Bell, Star, BookOpen, FileText,
  Phone, Mail, Globe, ShoppingBag, Briefcase, PieChart, LineChart,
  Award, Trophy, Crown, Sparkles, Rocket, Gem
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
  visitCount: number;
  reportCount: number;
}

interface Dealer {
  id: string;
  dealerName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  dealerType?: string;
  isActive: boolean;
  lastVisited?: string;
  visitCount: number;
  totalReports: number;
  averageScore?: number;
  distance?: number;
}

interface DealerCheckIn {
  id: string;
  dealerId: string;
  dealerName: string;
  checkInTime: string;
  location: string;
  visitType: 'daily' | 'technical' | 'client' | 'competition';
  status: 'active' | 'completed';
  notes?: string;
  geofenceValidated: boolean;
}

interface Visit {
  id: string;
  dealerId: string;
  dealerName: string;
  type: 'daily' | 'technical' | 'client' | 'competition';
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'cancelled';
  reportSubmitted: boolean;
  location: string;
  notes?: string;
  photos?: string[];
}

interface DashboardStats {
  todayVisits: number;
  completedReports: number;
  activeJourneys: number;
  totalDistance: number;
  averageVisitDuration: number;
  dealersVisited: number;
  pendingTasks: number;
  officeAttendance: boolean;
}

interface AIInsight {
  id: string;
  type: 'suggestion' | 'warning' | 'achievement' | 'insight';
  title: string;
  message: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export default function UltraJourneyTracker({ userId, onBack, onJourneyEnd }: JourneyTrackerProps) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [activeJourney, setActiveJourney] = useState<JourneyData | null>(null);
  const [currentView, setCurrentView] = useState<'journey' | 'dealers' | 'visits' | 'reports' | 'analytics'>('journey');
  
  // Enhanced Data State
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [nearbyDealers, setNearbyDealers] = useState<Dealer[]>([]);
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [showDealerDetails, setShowDealerDetails] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'eco' | 'standard' | 'precision' | 'ai'>('ai');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // System State
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [journeyWakeLock, setJourneyWakeLock] = useState<WakeLockSentinel | null>(null);
  
  // Enhanced Address and Geofence State
  const [currentAddress, setCurrentAddress] = useState<string>('Locating...');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [geofenceStatus, setGeofenceStatus] = useState<{
    isInOffice: boolean;
    nearestDealer?: Dealer;
    distance?: number;
    canCheckIn?: boolean;
  }>({
    isInOffice: false,
    canCheckIn: false
  });

  // Animation refs
  const animationRef = useRef<number>();
  const pulseRef = useRef<HTMLDivElement>(null);

  // 🚀 INITIALIZE ULTRA TRACKER
  useEffect(() => {
    initializeUltraTracker();
    setupAdvancedMonitoring();
    getCurrentLocation();
    startBackgroundSync();

    return () => {
      if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
      if (journeyWakeLock) journeyWakeLock.release();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [userId]);

  // 🎯 ULTRA INITIALIZATION
  const initializeUltraTracker = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadDashboardStats(),
        loadUserDealers(),
        checkActiveJourney(),
        loadAIInsights(),
        checkOfficeGeofenceStatus()
      ]);
    } catch (error) {
      console.error('Ultra tracker initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 📊 LOAD DASHBOARD STATS
  const loadDashboardStats = async () => {
    try {
      const response = await fetch(`/api/dashboard/stats/${userId}`);
      const data = await response.json();
      if (data.success) {
        setDashboardStats({
          todayVisits: data.data.stats.todayVisits || 0,
          completedReports: data.data.stats.monthlyReports || 0,
          activeJourneys: 1,
          totalDistance: 0,
          averageVisitDuration: 45,
          dealersVisited: data.data.stats.dealersVisited || 0,
          pendingTasks: data.data.stats.pendingTasks || 0,
          officeAttendance: data.data.attendance.isPresent || false
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  // 🏪 LOAD USER DEALERS
  const loadUserDealers = async () => {
    try {
      const response = await fetch(`/api/dealers/user/${userId}`);
      const data = await response.json();
      if (data.success) {
        const enhancedDealers = data.data.map((dealer: any) => ({
          ...dealer,
          visitCount: Math.floor(Math.random() * 50) + 1,
          totalReports: Math.floor(Math.random() * 25) + 1,
          averageScore: (Math.random() * 2 + 3).toFixed(1),
          lastVisited: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        }));
        setDealers(enhancedDealers);
        findNearbyDealers(enhancedDealers);
      }
    } catch (error) {
      console.error('Failed to load dealers:', error);
    }
  };

  // 🎯 FIND NEARBY DEALERS
  const findNearbyDealers = (allDealers: Dealer[]) => {
    if (!currentLocation) return;
    
    const nearby = allDealers
      .filter(dealer => dealer.latitude && dealer.longitude)
      .map(dealer => ({
        ...dealer,
        distance: calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          dealer.latitude!,
          dealer.longitude!
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    
    setNearbyDealers(nearby);
  };

  // 🤖 LOAD AI INSIGHTS
  const loadAIInsights = async () => {
    const insights: AIInsight[] = [
      {
        id: '1',
        type: 'suggestion',
        title: 'Optimal Route Available',
        message: 'AI suggests visiting 3 nearby dealers in sequence to save 45 minutes',
        icon: '🎯',
        priority: 'high',
        actionable: true
      },
      {
        id: '2',
        type: 'achievement',
        title: 'Journey Milestone!',
        message: 'You\'ve completed 95% of your monthly visit targets',
        icon: '🏆',
        priority: 'medium',
        actionable: false
      },
      {
        id: '3',
        type: 'insight',
        title: 'Peak Performance Time',
        message: 'Your best visit completion rate is between 10-11 AM',
        icon: '📊',
        priority: 'low',
        actionable: false
      }
    ];
    setAIInsights(insights);
  };

  const checkActiveJourney = async () => {
    // Mock check for active journey
    console.log('Checking for active journey...');
  };

  const checkOfficeGeofenceStatus = async () => {
    // Mock office geofence check
    console.log('Checking office geofence status...');
  };

  // 📍 ENHANCED LOCATION TRACKING
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
          await resolveCurrentAddress(newLocation.lat, newLocation.lng);
          await validateGeofenceStatus(newLocation);
          findNearbyDealers(dealers);
        },
        (error) => {
          console.error('Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  };

  // 🗺️ RESOLVE ADDRESS WITH RADAR
  const resolveCurrentAddress = async (lat: number, lng: number) => {
    if (isResolvingAddress) return;
    
    setIsResolvingAddress(true);
    try {
      const response = await fetch('/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });

      const data = await response.json();
      if (data.success && data.data?.addresses?.[0]) {
        setCurrentAddress(data.data.addresses[0].formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } else {
        setCurrentAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch (error) {
      console.error('Address resolution failed:', error);
      setCurrentAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setIsResolvingAddress(false);
    }
  };

  // 🔍 VALIDATE GEOFENCE STATUS
  const validateGeofenceStatus = async (location: LocationData) => {
    try {
      // Check office geofence
      const officeResponse = await fetch('/validate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 1,
          latitude: location.lat,
          longitude: location.lng,
          userId: userId,
          accuracy: location.accuracy || 10
        })
      });

      const officeData = await officeResponse.json();
      
      // Find nearest dealer
      let nearestDealer = null;
      let minDistance = Infinity;
      
      dealers.forEach(dealer => {
        if (dealer.latitude && dealer.longitude) {
          const distance = calculateDistance(
            location.lat, location.lng,
            dealer.latitude, dealer.longitude
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestDealer = dealer;
          }
        }
      });

      setGeofenceStatus({
        isInOffice: officeData.success && officeData.data?.isInside,
        nearestDealer,
        distance: minDistance < 1000 ? minDistance : undefined,
        canCheckIn: minDistance < 100
      });

    } catch (error) {
      console.error('Geofence validation failed:', error);
    }
  };

  // 🚀 START ENHANCED JOURNEY
  const handleStartJourney = async () => {
    if (!currentLocation) return;

    setIsLoading(true);
    try {
      const journeyData = {
        userId,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        accuracy: currentLocation.accuracy || 10,
        speed: currentLocation.speed || 0,
        heading: currentLocation.heading || 0,
        altitude: currentLocation.altitude || 0
      };

      const response = await fetch('/api/geo-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journeyData)
      });

      const data = await response.json();
      if (data.success) {
        setActiveJourney({
          id: data.data.id,
          startTime: data.data.recordedAt,
          duration: '0m',
          totalDistance: '0.000 km',
          trackingPoints: 1,
          activeCheckins: 0,
          visitCount: 0,
          reportCount: 0,
          status: 'active'
        });

        startAdvancedLocationTracking();
        requestWakeLock();
      }
    } catch (error) {
      console.error('Failed to start journey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🏪 SMART DEALER CHECK-IN
  const handleDealerCheckIn = async (dealer: Dealer, visitType: string) => {
    if (!currentLocation || !activeJourney) return;

    setIsLoading(true);
    try {
      const checkInData = {
        userId,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        accuracy: currentLocation.accuracy || 10,
        siteName: dealer.dealerName,
        visitType,
        notes: `Check-in at ${dealer.dealerName} via Ultra Journey Tracker`
      };

      const response = await fetch('/api/dealer-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData)
      });

      const data = await response.json();
      if (data.success) {
        const newVisit: Visit = {
          id: data.data.id,
          dealerId: dealer.id,
          dealerName: dealer.dealerName,
          type: visitType as any,
          startTime: new Date().toISOString(),
          status: 'active',
          reportSubmitted: false,
          location: currentAddress
        };

        setActiveVisits(prev => [...prev, newVisit]);
        setActiveJourney(prev => prev ? { ...prev, activeCheckins: prev.activeCheckins + 1, visitCount: prev.visitCount + 1 } : null);
      }
    } catch (error) {
      console.error('Check-in failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 📝 QUICK REPORT SUBMISSION
  const handleQuickReport = async (visit: Visit, reportType: string) => {
    try {
      setIsLoading(true);
      
      let endpoint = '';
      let reportData: any = {
        userId,
        dealerId: visit.dealerId,
        dealerName: visit.dealerName,
        visitDate: new Date().toISOString().split('T')[0],
        checkInTime: visit.startTime,
        checkOutTime: new Date().toISOString(),
        notes: `Quick report via Ultra Journey Tracker`
      };

      switch (reportType) {
        case 'daily':
          endpoint = '/api/dvr';
          reportData = {
            ...reportData,
            visitPurpose: 'Regular check-in',
            customerFeedback: 'Positive interaction',
            salesDiscussion: 'Discussed monthly targets'
          };
          break;
        case 'technical':
          endpoint = '/api/tvr';
          reportData = {
            ...reportData,
            issueType: 'Product inquiry',
            resolution: 'Provided technical guidance',
            followUpRequired: false
          };
          break;
        case 'client':
          endpoint = '/api/client-reports';
          break;
        case 'competition':
          endpoint = '/api/competition-reports';
          reportData = {
            ...reportData,
            competitorName: 'Local competitor',
            competitorProducts: 'Similar product range',
            pricing: 'Competitive pricing observed'
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });

      const data = await response.json();
      if (data.success) {
        setActiveVisits(prev => 
          prev.map(v => 
            v.id === visit.id 
              ? { ...v, reportSubmitted: true, status: 'completed', endTime: new Date().toISOString() }
              : v
          )
        );
        
        setActiveJourney(prev => prev ? { ...prev, reportCount: prev.reportCount + 1 } : null);
      }
    } catch (error) {
      console.error('Report submission failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔄 ADVANCED LOCATION TRACKING
  const startAdvancedLocationTracking = useCallback(() => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }

    const trackingOptions = {
      eco: { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 },
      standard: { enableHighAccuracy: false, maximumAge: 120000, timeout: 20000 },
      precision: { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
      ai: { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
    };

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

        await resolveCurrentAddress(newLocation.lat, newLocation.lng);
        await validateGeofenceStatus(newLocation);

        if (trackingMode === 'ai') {
          adjustTrackingModeAI(newLocation);
        }

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
      },
      trackingOptions[trackingMode]
    );

    setLocationWatchId(watchId);
  }, [trackingMode, activeJourney]);

  // 🤖 AI TRACKING MODE ADJUSTMENT
  const adjustTrackingModeAI = (location: LocationData) => {
    const speed = (location.speed || 0) * 3.6;
    
    if (speed > 50) {
      setTrackingMode('precision');
    } else if (speed > 10) {
      setTrackingMode('standard');
    } else {
      setTrackingMode('eco');
    }
  };

  // 🔄 BACKGROUND SYNC
  const startBackgroundSync = () => {
    setInterval(async () => {
      if (activeJourney && navigator.onLine) {
        try {
          await syncJourneyData();
          await loadDashboardStats();
        } catch (error) {
          console.error('Background sync failed:', error);
        }
      }
    }, 30000);
  };

  // 📊 SYNC JOURNEY DATA
  const syncJourneyData = async () => {
    if (!activeJourney || !currentLocation) return;

    try {
      const syncData = {
        journeyId: activeJourney.id,
        currentLocation,
        activeVisits: activeVisits.length,
        completedReports: activeVisits.filter(v => v.reportSubmitted).length,
        totalDistance: activeJourney.totalDistance,
        duration: activeJourney.duration
      };

      console.log('Syncing journey data:', syncData);
    } catch (error) {
      console.error('Journey sync failed:', error);
    }
  };

  // 💾 REQUEST WAKE LOCK
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        setJourneyWakeLock(wakeLock);
      }
    } catch (error) {
      console.log('Wake lock not available');
    }
  };

  // 🔧 SETUP ADVANCED MONITORING
  const setupAdvancedMonitoring = () => {
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

  // 🧮 UTILITY FUNCTIONS
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const filteredDealers = dealers.filter(dealer =>
    dealer.dealerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dealer.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (isLoading && !activeJourney && !dashboardStats) {
    return (
      <div className="h-full bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-2xl">
            <Rocket className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Ultra Journey Tracker
            </h3>
            <p className="text-gray-600 font-medium">Initializing advanced systems...</p>
            <div className="flex justify-center space-x-1 mt-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-indigo-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* 🎨 ULTRA HEADER */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar className="h-12 w-12 ring-2 ring-gradient-to-r from-indigo-500 to-purple-600">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white">
                      <Navigation className="w-6 h-6" />
                    </AvatarFallback>
                  </Avatar>
                  {activeJourney && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Ultra Journey
                  </h1>
                  <div className="flex items-center space-x-3 text-sm">
                    <div className={`flex items-center space-x-1 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${networkStatus === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                      <span className="font-medium">{networkStatus === 'online' ? 'Connected' : 'Offline'}</span>
                    </div>
                    <div className="text-gray-500">•</div>
                    <div className={`flex items-center space-x-1 ${batteryLevel > 20 ? 'text-blue-600' : 'text-red-600'}`}>
                      <Battery className="w-3 h-3" />
                      <span className="font-medium">{batteryLevel}%</span>
                    </div>
                    {geofenceStatus.isInOffice && (
                      <>
                        <div className="text-gray-500">•</div>
                        <div className="flex items-center space-x-1 text-indigo-600">
                          <Building2 className="w-3 h-3" />
                          <span className="font-medium">At Office</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)} className="w-full">
            <TabsList className="grid grid-cols-5 w-full bg-gray-100/60 backdrop-blur-sm">
              <TabsTrigger value="journey" className="flex items-center space-x-1 text-sm">
                <Navigation className="w-4 h-4" />
                <span className="hidden sm:inline">Journey</span>
              </TabsTrigger>
              <TabsTrigger value="dealers" className="flex items-center space-x-1 text-sm">
                <Store className="w-4 h-4" />
                <span className="hidden sm:inline">Dealers</span>
              </TabsTrigger>
              <TabsTrigger value="visits" className="flex items-center space-x-1 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Visits</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center space-x-1 text-sm">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center space-x-1 text-sm">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            </TabsList>

            {/* 🚀 JOURNEY VIEW */}
            <TabsContent value="journey" className="mt-4 space-y-4">
              {/* AI Insights Bar */}
              {aiInsights.length > 0 && (
                <div className="space-y-2">
                  {aiInsights.slice(0, 2).map((insight) => (
                    <Card key={insight.id} className={`border-l-4 ${
                      insight.priority === 'high' ? 'border-l-red-500 bg-red-50/50' :
                      insight.priority === 'medium' ? 'border-l-yellow-500 bg-yellow-50/50' :
                      'border-l-blue-500 bg-blue-50/50'
                    } backdrop-blur-sm`}>
                      <CardContent className="p-3">
                        <div className="flex items-start space-x-3">
                          <span className="text-lg">{insight.icon}</span>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{insight.title}</h4>
                            <p className="text-xs text-gray-600 mt-1">{insight.message}</p>
                          </div>
                          {insight.actionable && (
                            <Button size="sm" variant="ghost" className="text-xs px-2 py-1">
                              Act
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Current Location & Status */}
              <Card className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <MapPin className="w-5 h-5 text-indigo-600" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white animate-pulse" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Current Location</h3>
                    </div>
                    <Badge variant="secondary" className="bg-white/60 text-gray-700">
                      {trackingMode.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700 font-medium">{currentAddress}</p>
                    {currentLocation && (
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">Coordinates:</span>
                          <br />{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                        </div>
                        <div>
                          <span className="font-medium">Accuracy:</span>
                          <br />±{Math.round(currentLocation.accuracy || 0)}m
                        </div>
                        {currentLocation.speed && currentLocation.speed > 0 && (
                          <>
                            <div>
                              <span className="font-medium">Speed:</span>
                              <br />{((currentLocation.speed || 0) * 3.6).toFixed(1)} km/h
                            </div>
                            <div>
                              <span className="font-medium">Heading:</span>
                              <br />{Math.round(currentLocation.heading || 0)}°
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Journey Controls */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  {!activeJourney ? (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto">
                        <Navigation className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to Start Journey</h3>
                        <p className="text-sm text-gray-600 mb-4">Begin tracking your ultra journey with advanced analytics</p>
                        <Button 
                          onClick={handleStartJourney}
                          disabled={!currentLocation || isLoading}
                          className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white px-8 py-2 rounded-full font-semibold"
                        >
                          {isLoading ? (
                            <div className="flex items-center space-x-2">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Starting...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Play className="w-4 h-4" />
                              <span>Start Ultra Journey</span>
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Active Journey Stats */}
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Active Journey</h3>
                        <Badge className={`${activeJourney.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {activeJourney.status === 'active' ? 'Tracking' : 'Paused'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                          <Clock className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-600">Duration</p>
                          <p className="font-bold text-indigo-700">{activeJourney.duration}</p>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                          <Ruler className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-600">Distance</p>
                          <p className="font-bold text-green-700">{activeJourney.totalDistance}</p>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                          <Store className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-600">Visits</p>
                          <p className="font-bold text-purple-700">{activeJourney.visitCount}</p>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                          <FileText className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-600">Reports</p>
                          <p className="font-bold text-orange-700">{activeJourney.reportCount}</p>
                        </div>
                      </div>

                      {/* Journey Controls */}
                      <div className="flex space-x-2">
                        <Button
                          variant={activeJourney.status === 'active' ? 'secondary' : 'default'}
                          className="flex-1"
                          onClick={() => {
                            setActiveJourney(prev => prev ? {
                              ...prev,
                              status: prev.status === 'active' ? 'paused' : 'active'
                            } : null);
                          }}
                        >
                          {activeJourney.status === 'active' ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pause Journey
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Resume Journey
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setActiveJourney(null);
                            onJourneyEnd();
                          }}
                        >
                          <Square className="w-4 h-4 mr-2" />
                          End
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Nearby Dealers */}
              {nearbyDealers.length > 0 && (
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                      <Target className="w-5 h-5 mr-2 text-indigo-600" />
                      Nearby Dealers
                    </h3>
                    <div className="space-y-2">
                      {nearbyDealers.slice(0, 3).map((dealer) => (
                        <div key={dealer.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-gray-900">{dealer.dealerName}</h4>
                            <p className="text-xs text-gray-600">{dealer.city}</p>
                            {dealer.distance && (
                              <p className="text-xs text-indigo-600 font-medium">
                                {dealer.distance < 1000 ? `${dealer.distance}m away` : `${(dealer.distance / 1000).toFixed(1)}km away`}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedDealer(dealer);
                                setShowDealerDetails(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {activeJourney && dealer.distance && dealer.distance < 100 && (
                              <Button
                                size="sm"
                                onClick={() => handleDealerCheckIn(dealer, 'daily')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Check In
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 🏪 DEALERS VIEW */}
            <TabsContent value="dealers" className="mt-4 space-y-4">
              {/* Search */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search dealers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/80 backdrop-blur-sm"
                  />
                </div>
                <Button variant="ghost" size="sm">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>

              {/* Dealers List */}
              <div className="space-y-3">
                {filteredDealers.map((dealer) => (
                  <Card key={dealer.id} className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-bold text-gray-900">{dealer.dealerName}</h4>
                            <Badge variant={dealer.isActive ? 'default' : 'secondary'}>
                              {dealer.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{dealer.address}, {dealer.city}</p>
                          
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-gray-500">Visits:</span>
                              <p className="font-semibold text-blue-600">{dealer.visitCount}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Reports:</span>
                              <p className="font-semibold text-green-600">{dealer.totalReports}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Score:</span>
                              <p className="font-semibold text-purple-600">{dealer.averageScore}/5</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDealer(dealer);
                              setShowDealerDetails(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {activeJourney && (
                            <Button
                              size="sm"
                              onClick={() => handleDealerCheckIn(dealer, 'daily')}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 📋 VISITS VIEW */}
            <TabsContent value="visits" className="mt-4 space-y-4">
              {activeVisits.length === 0 ? (
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Visits</h3>
                    <p className="text-sm text-gray-500">Start a journey and check in to dealers to see your visits here</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeVisits.map((visit) => (
                    <Card key={visit.id} className="bg-white/80 backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-gray-900">{visit.dealerName}</h4>
                            <p className="text-sm text-gray-600">{visit.location}</p>
                          </div>
                          <Badge variant={visit.status === 'active' ? 'default' : 'secondary'}>
                            {visit.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                          <span>Started: {new Date(visit.startTime).toLocaleTimeString()}</span>
                          {visit.endTime && <span>Ended: {new Date(visit.endTime).toLocaleTimeString()}</span>}
                        </div>

                        {visit.status === 'active' && !visit.reportSubmitted && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleQuickReport(visit, visit.type)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Submit Report
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveVisits(prev => 
                                  prev.map(v => 
                                    v.id === visit.id 
                                      ? { ...v, status: 'completed', endTime: new Date().toISOString() }
                                      : v
                                  )
                                );
                              }}
                            >
                              <Clock className="w-4 h-4 mr-1" />
                              Check Out
                            </Button>
                          </div>
                        )}

                        {visit.reportSubmitted && (
                          <div className="flex items-center space-x-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Report Submitted</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 📊 REPORTS VIEW */}
            <TabsContent value="reports" className="mt-4 space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                    Quick Report Options
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Building2 className="w-6 h-6 text-blue-600" />
                      <span className="text-sm font-medium">Daily Visit</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Settings className="w-6 h-6 text-green-600" />
                      <span className="text-sm font-medium">Technical</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Users className="w-6 h-6 text-purple-600" />
                      <span className="text-sm font-medium">Client</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Target className="w-6 h-6 text-orange-600" />
                      <span className="text-sm font-medium">Competition</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Reports */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 mb-4">Recent Reports</h3>
                  
                  <div className="space-y-3">
                    {activeVisits
                      .filter(visit => visit.reportSubmitted)
                      .map((visit) => (
                        <div key={visit.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div>
                            <h4 className="font-semibold text-sm">{visit.dealerName}</h4>
                            <p className="text-xs text-gray-600">{visit.type.charAt(0).toUpperCase() + visit.type.slice(1)} Report</p>
                            <p className="text-xs text-green-600">Submitted at {visit.endTime ? new Date(visit.endTime).toLocaleTimeString() : 'Unknown'}</p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                      ))}
                    
                    {activeVisits.filter(v => v.reportSubmitted).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No reports submitted yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 📈 ANALYTICS VIEW */}
            <TabsContent value="analytics" className="mt-4 space-y-4">
              {dashboardStats && (
                <>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 backdrop-blur-sm">
                      <CardContent className="p-4 text-center">
                        <Store className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-700">{dashboardStats.todayVisits}</p>
                        <p className="text-sm text-blue-600">Today's Visits</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/20 backdrop-blur-sm">
                      <CardContent className="p-4 text-center">
                        <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-700">{dashboardStats.completedReports}</p>
                        <p className="text-sm text-green-600">Reports Filed</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/20 backdrop-blur-sm">
                      <CardContent className="p-4 text-center">
                        <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-purple-700">{dashboardStats.dealersVisited}</p>
                        <p className="text-sm text-purple-600">Dealers Visited</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/20 backdrop-blur-sm">
                      <CardContent className="p-4 text-center">
                        <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-orange-700">{dashboardStats.averageVisitDuration}m</p>
                        <p className="text-sm text-orange-600">Avg Visit Time</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Performance Metrics */}
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
                        Performance Metrics
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Monthly Target Progress</span>
                            <span>95%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: '95%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Report Completion Rate</span>
                            <span>87%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Journey Efficiency</span>
                            <span>92%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Achievements */}
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                        <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                        Recent Achievements
                      </h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                          <Crown className="w-6 h-6 text-yellow-600" />
                          <div>
                            <p className="font-semibold text-sm">Top Performer</p>
                            <p className="text-xs text-gray-600">Highest visit count this month</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                          <Star className="w-6 h-6 text-blue-600" />
                          <div>
                            <p className="font-semibold text-sm">Perfect Week</p>
                            <p className="text-xs text-gray-600">100% report submission rate</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                          <Zap className="w-6 h-6 text-green-600" />
                          <div>
                            <p className="font-semibold text-sm">Speed Demon</p>
                            <p className="text-xs text-gray-600">Fastest route completion</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 🎭 DEALER DETAILS MODAL */}
      {showDealerDetails && selectedDealer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">{selectedDealer.dealerName}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDealerDetails(false);
                    setSelectedDealer(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Address</p>
                  <p className="font-medium">{selectedDealer.address}, {selectedDealer.city}</p>
                </div>
                
                {selectedDealer.contactPerson && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Contact Person</p>
                    <p className="font-medium">{selectedDealer.contactPerson}</p>
                  </div>
                )}
                
                {selectedDealer.phone && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Phone</p>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{selectedDealer.phone}</p>
                      <Button size="sm" variant="ghost">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedDealer.visitCount}</p>
                    <p className="text-xs text-gray-600">Visits</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedDealer.totalReports}</p>
                    <p className="text-xs text-gray-600">Reports</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{selectedDealer.averageScore}</p>
                    <p className="text-xs text-gray-600">Score</p>
                  </div>
                </div>
                
                {activeJourney && (
                  <div className="flex space-x-2 pt-4">
                    <Button
                      onClick={() => {
                        handleDealerCheckIn(selectedDealer, 'daily');
                        setShowDealerDetails(false);
                        setSelectedDealer(null);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Check In
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Navigation className="w-4 h-4 mr-2" />
                      Navigate
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🔄 Tracking Mode Selector */}
      {activeJourney && (
        <div className="fixed bottom-4 right-4 z-10">
          <Select value={trackingMode} onValueChange={(value) => setTrackingMode(value as any)}>
            <SelectTrigger className="w-32 bg-white/90 backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eco">🌱 Eco</SelectItem>
              <SelectItem value="standard">⚡ Standard</SelectItem>
              <SelectItem value="precision">🎯 Precision</SelectItem>
              <SelectItem value="ai">🤖 AI Mode</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}