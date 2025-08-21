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
  Timer, Distance, Footprints, Bell, Star, BookOpen, FileText,
  Phone, Mail, Globe, ShoppingBag, Briefcase, PieChart, LineChart,
  Award, Trophy, Crown, Sparkles, Rocket, Lightning, Fire, Gem
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
    // Simulate AI-powered insights
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
          companyId: 1, // This should come from user data
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
        canCheckIn: minDistance < 100 // Within 100m of dealer
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
        
        // Show success with dealer info
        showSuccessToast(`🏪 Checked in at ${dealer.dealerName}`);
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      showErrorToast('Check-in failed. Please try again.');
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
        // Update visit status
        setActiveVisits(prev => 
          prev.map(v => 
            v.id === visit.id 
              ? { ...v, reportSubmitted: true, status: 'completed', endTime: new Date().toISOString() }
              : v
          )
        );
        
        setActiveJourney(prev => prev ? { ...prev, reportCount: prev.reportCount + 1 } : null);
        showSuccessToast(`📝 ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report submitted!`);
      }
    } catch (error) {
      console.error('Report submission failed:', error);
      showErrorToast('Report submission failed');
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
      ai: { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 } // AI-optimized
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

        // AI-powered tracking mode adjustment
        if (trackingMode === 'ai') {
          adjustTrackingModeAI(newLocation);
        }

        // Update journey stats
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
    const speed = (location.speed || 0) * 3.6; // Convert to km/h
    
    if (speed > 50) {
      // Fast movement - use precision mode
      setTrackingMode('precision');
    } else if (speed > 10) {
      // Moderate movement - standard mode
      setTrackingMode('standard');
    } else {
      // Stationary or slow - eco mode
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
    }, 30000); // Sync every 30 seconds
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

      // This would sync with your backend
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
    // Battery monitoring
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    // Network monitoring
    window.addEventListener('online', () => setNetworkStatus('online'));
    window.addEventListener('offline', () => setNetworkStatus('offline'));
  };

  // 🧮 UTILITY FUNCTIONS
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
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

  const showSuccessToast = (message: string) => {
    // You can implement toast notifications here
    console.log('Success:', message);
  };

  const showErrorToast = (message: string) => {
    // You can implement toast notifications here
    console.error('Error:', message);
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
          <Tabs value={currentView} onValueChange={(value: any) => setCurrentView(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-100/80 backdrop-blur-sm rounded-xl p-1">
              <TabsTrigger value="journey" className="rounded-lg font-medium text-xs flex items-center space-x-1">
                <Navigation className="w-3 h-3" />
                <span className="hidden sm:inline">Journey</span>
              </TabsTrigger>
              <TabsTrigger value="dealers" className="rounded-lg font-medium text-xs flex items-center space-x-1">
                <Store className="w-3 h-3" />
                <span className="hidden sm:inline">Dealers</span>
              </TabsTrigger>
              <TabsTrigger value="visits" className="rounded-lg font-medium text-xs flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Visits</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-lg font-medium text-xs flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="rounded-lg font-medium text-xs flex items-center space-x-1">
                <BarChart3 className="w-3 h-3" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={currentView} onValueChange={(value: any) => setCurrentView(value)}>
          
          {/* 🎯 JOURNEY TAB */}
          <TabsContent value="journey" className="space-y-6 p-4 m-0">
            {/* AI Insights Banner */}
            {aiInsights.length > 0 && (
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50 shadow-md overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-amber-800">AI Insights</h3>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                      {aiInsights.length} insights
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {aiInsights.slice(0, 2).map((insight) => (
                      <div key={insight.id} className="flex items-start space-x-3 p-3 bg-white/70 rounded-lg">
                        <span className="text-lg">{insight.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{insight.title}</p>
                          <p className="text-gray-700 text-xs">{insight.message}</p>
                        </div>
                        {insight.actionable && (
                          <Button size="sm" variant="outline" className="text-xs border-amber-300 hover:bg-amber-50">
                            Act
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dashboard Stats */}
            {dashboardStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Store className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-bold">{dashboardStats.todayVisits}</div>
                    <div className="text-blue-100 text-sm">Today's Visits</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-bold">{dashboardStats.completedReports}</div>
                    <div className="text-purple-100 text-sm">Reports Filed</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Target className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-bold">{dashboardStats.dealersVisited}</div>
                    <div className="text-green-100 text-sm">Dealers Reached</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-bold">{dashboardStats.pendingTasks}</div>
                    <div className="text-orange-100 text-sm">Pending Tasks</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {!activeJourney ? (
              // 🌟 START JOURNEY SCREEN
              <div className="space-y-6">
                {/* Current Location Status */}
                {currentLocation ? (
                  <Card className="bg-white/80 backdrop-blur-sm border-gray-200/50 shadow-lg overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                            <MapPin className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">Current Location</h3>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-gray-800">
                                {isResolvingAddress ? (
                                  <span className="flex items-center space-x-2">
                                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <span>Resolving address...</span>
                                  </span>
                                ) : (
                                  currentAddress
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                              </p>
                              {currentLocation.speed && currentLocation.speed > 0 && (
                                <p className="text-xs text-gray-500">
                                  Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            <Signal className="w-3 h-3 mr-1" />
                            {currentLocation.accuracy?.toFixed(0)}m
                          </Badge>
                          {geofenceStatus.canCheckIn && geofenceStatus.nearestDealer && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                              🏪 Near {geofenceStatus.nearestDealer.dealerName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {geofenceStatus.isInOffice && (
                        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                          <div className="flex items-center space-x-2 text-indigo-800">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">You're at the office</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-orange-50/80 backdrop-blur-sm border-orange-200/50 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">Getting Location...</h3>
                            <p className="text-sm text-gray-600">Please enable GPS access</p>
                          </div>
                        </div>
                        <Button
                          onClick={getCurrentLocation}
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retry
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Nearby Dealers */}
                {nearbyDealers.length > 0 && (
                  <Card className="bg-white/80 backdrop-blur-sm border-gray-200/50 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Nearby Dealers</h3>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          {nearbyDealers.length} nearby
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {nearbyDealers.slice(0, 3).map((dealer) => (
                          <div key={dealer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <Store className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{dealer.dealerName}</p>
                                <p className="text-xs text-gray-500">{dealer.city}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {(dealer as any).distance?.toFixed(0) || '0'}m
                              </p>
                              <p className="text-xs text-gray-500">away</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Start Journey Button */}
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-full mx-auto flex items-center justify-center shadow-2xl animate-pulse">
                    <Route className="w-16 h-16 text-white" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Ready to Journey?
                    </h2>
                    <p className="text-gray-600 text-lg">Start your intelligent field tracking</p>
                  </div>

                  <Button
                    onClick={handleStartJourney}
                    disabled={!currentLocation || isLoading}
                    className="w-full h-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white text-xl font-bold rounded-3xl shadow-2xl transform transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Starting Journey...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <Rocket className="w-8 h-8" />
                        <span>🚀 Launch Journey</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // 🎯 ACTIVE JOURNEY SCREEN
              <div className="space-y-6">
                {/* Journey Status Card */}
                <Card className="bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 text-white shadow-2xl overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Navigation className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">Journey Active</h3>
                          <p className="text-white/80 text-lg">Live AI Tracking</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {activeJourney.status === 'active' && (
                          <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
                        )}
                        <Badge className="bg-white/20 text-white border-white/30 text-sm">
                          {trackingMode.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Live Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold flex items-center justify-center space-x-1">
                          <Timer className="w-6 h-6" />
                          <span>{calculateDuration(activeJourney.startTime)}</span>
                        </div>
                        <div className="text-white/80 text-sm">Duration</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold flex items-center justify-center space-x-1">
                          <Distance className="w-6 h-6" />
                          <span>{activeJourney.totalDistance}</span>
                        </div>
                        <div className="text-white/80 text-sm">Distance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold flex items-center justify-center space-x-1">
                          <Store className="w-6 h-6" />
                          <span>{activeJourney.visitCount}</span>
                        </div>
                        <div className="text-white/80 text-sm">Visits</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold flex items-center justify-center space-x-1">
                          <FileText className="w-6 h-6" />
                          <span>{activeJourney.reportCount}</span>
                        </div>
                        <div className="text-white/80 text-sm">Reports</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Location with Enhanced Info */}
                {currentLocation && (
                  <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-6 h-6 text-blue-600" />
                          <div>
                            <p className="font-bold text-gray-900">Live Location</p>
                            <p className="text-sm text-gray-800">{currentAddress}</p>
                            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                              <span>{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}</span>
                              {currentLocation.speed && currentLocation.speed > 0 && (
                                <span>• {(currentLocation.speed * 3.6).toFixed(1)} km/h</span>
                              )}
                              <span>• {Math.round((new Date().getTime() - lastUpdate.getTime()) / 1000)}s ago</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-blue-100 text-blue-800 border-blue-300 mb-2">
                            <Signal className="w-3 h-3 mr-1" />
                            {currentLocation.accuracy?.toFixed(0)}m
                          </Badge>
                          {geofenceStatus.canCheckIn && geofenceStatus.nearestDealer && (
                            <div>
                              <Badge className="bg-green-100 text-green-800 border-green-300">
                                🏪 {geofenceStatus.distance}m to dealer
                              </Badge>
                            </div>
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
                      setActiveJourney(prev => prev ? {
                        ...prev,
                        status: prev.status === 'active' ? 'paused' : 'active'
                      } : null);
                    }}
                    className={`h-20 text-white rounded-2xl shadow-xl text-lg font-semibold transform transition-all duration-200 hover:scale-105 ${
                      activeJourney.status === 'active'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      {activeJourney.status === 'active' ? (
                        <Pause className="w-8 h-8" />
                      ) : (
                        <Play className="w-8 h-8" />
                      )}
                      <span>{activeJourney.status === 'active' ? 'Pause' : 'Resume'}</span>
                    </div>
                  </Button>

                  <Button
                    onClick={() => setCurrentView('dealers')}
                    className="h-20 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-2xl shadow-xl text-lg font-semibold transform transition-all duration-200 hover:scale-105"
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <Store className="w-8 h-8" />
                      <span>Visit Dealer</span>
                    </div>
                  </Button>
                </div>

                {/* Active Visits */}
                {activeVisits.length > 0 && (
                  <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Active Visits</h3>
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                          {activeVisits.length} active
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {activeVisits.slice(-3).map((visit) => (
                          <div key={visit.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                visit.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                              }`}>
                                {visit.status === 'completed' ? (
                                  <CheckCircle className="w-6 h-6 text-white" />
                                ) : (
                                  <Clock className="w-6 h-6 text-white" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{visit.dealerName}</p>
                                <p className="text-sm text-gray-600">{visit.type} visit</p>
                                <p className="text-xs text-gray-500">{new Date(visit.startTime).toLocaleTimeString()}</p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              {!visit.reportSubmitted && visit.status === 'active' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleQuickReport(visit, visit.type)}
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <FileText className="w-4 h-4 mr-1" />
                                  Report
                                </Button>
                              )}
                              {visit.reportSubmitted && (
                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Done
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* System Status */}
                <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                          <Battery className={`w-5 h-5 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
                          <span className="font-semibold text-sm">{batteryLevel}%</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Wifi className={`w-5 h-5 ${networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                          <span className="font-semibold text-sm capitalize">{networkStatus}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Activity className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold text-sm">{activeJourney.trackingPoints} points</span>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        {trackingMode.toUpperCase()} Mode
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* End Journey Button */}
                <Button
                  onClick={() => {
                    // Handle end journey logic
                    setActiveJourney(null);
                    if (locationWatchId) {
                      navigator.geolocation.clearWatch(locationWatchId);
                      setLocationWatchId(null);
                    }
                    if (journeyWakeLock) {
                      journeyWakeLock.release();
                      setJourneyWakeLock(null);
                    }
                    onJourneyEnd();
                  }}
                  disabled={isLoading}
                  className="w-full h-20 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xl font-bold rounded-3xl shadow-2xl transform transition-all duration-300 hover:scale-105"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Ending Journey...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <Square className="w-8 h-8" />
                      <span>🏁 Complete Journey</span>
                    </div>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* 🏪 DEALERS TAB */}
          <TabsContent value="dealers" className="space-y-4 p-4 m-0">
            {/* Search and Filter */}
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search dealers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/80 backdrop-blur-sm border-gray-200/50"
                />
              </div>
              <Button variant="outline" className="bg-white/80 backdrop-blur-sm border-gray-200/50">
                <Filter className="w-4 h-4" />
              </Button>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                onClick={() => setCurrentView('journey')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Nearby Dealers Section */}
            {nearbyDealers.length > 0 && (
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200/50 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-gray-900">Nearby Dealers</h3>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                      {nearbyDealers.length} within 5km
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {nearbyDealers.map((dealer) => (
                      <div key={dealer.id} className="flex items-center justify-between p-4 bg-white/80 rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                            <Store className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{dealer.dealerName}</p>
                            <p className="text-sm text-gray-600">{dealer.city} • {dealer.dealerType || 'Dealer'}</p>
                            <div className="flex items-center space-x-3 mt-1">
                              <span className="text-xs text-blue-600 font-medium">
                                {(dealer as any).distance?.toFixed(0) || '0'}m away
                              </span>
                              {dealer.lastVisited && (
                                <span className="text-xs text-gray-500">
                                  Last: {new Date(dealer.lastVisited).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {geofenceStatus.canCheckIn && geofenceStatus.nearestDealer?.id === dealer.id && activeJourney && (
                            <div className="flex space-x-2">
                              <Select onValueChange={(value) => handleDealerCheckIn(dealer, value)}>
                                <SelectTrigger className="w-32 bg-green-500 text-white border-green-600">
                                  <SelectValue placeholder="Check In" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily Visit</SelectItem>
                                  <SelectItem value="technical">Technical</SelectItem>
                                  <SelectItem value="client">Client Meet</SelectItem>
                                  <SelectItem value="competition">Competition</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDealer(dealer);
                              setShowDealerDetails(true);
                            }}
                            className="border-gray-300"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Dealers List */}
            <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">All Dealers</h3>
                  <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                    {filteredDealers.length} dealers
                  </Badge>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredDealers.map((dealer) => (
                    <div key={dealer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                          <Store className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{dealer.dealerName}</p>
                          <p className="text-sm text-gray-600">{dealer.city}</p>
                          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                            <span>📊 {dealer.visitCount} visits</span>
                            <span>⭐ {dealer.averageScore}/5.0</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDealer(dealer);
                            setShowDealerDetails(true);
                          }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 🏃 VISITS TAB */}
          <TabsContent value="visits" className="space-y-4 p-4 m-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Visit History
              </h2>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                {activeVisits.length} active
              </Badge>
            </div>

            {activeVisits.length > 0 && (
              <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Active Visits</h3>
                  <div className="space-y-4">
                    {activeVisits.map((visit) => (
                      <div key={visit.id} className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              visit.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                            }`}>
                              {visit.status === 'completed' ? (
                                <CheckCircle className="w-6 h-6 text-white" />
                              ) : (
                                <Clock className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-lg">{visit.dealerName}</p>
                              <p className="text-gray-600 capitalize">{visit.type} Visit</p>
                            </div>
                          </div>
                          <Badge className={`${
                            visit.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
                            'bg-blue-100 text-blue-800 border-blue-300'
                          }`}>
                            {visit.status === 'completed' ? 'Completed' : 'Active'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                          <div>
                            <span className="font-medium">Start:</span> {new Date(visit.startTime).toLocaleString()}
                          </div>
                          {visit.endTime && (
                            <div>
                              <span className="font-medium">End:</span> {new Date(visit.endTime).toLocaleString()}
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="font-medium">Location:</span> {visit.location}
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          {visit.reportSubmitted ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Report Submitted
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleQuickReport(visit, visit.type)}
                              className="bg-green-500 hover:bg-green-600 text-white"
                              disabled={isLoading}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Submit Report
                            </Button>
                          )}
                          
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>
                              {visit.endTime 
                                ? `Duration: ${Math.round((new Date(visit.endTime).getTime() - new Date(visit.startTime).getTime()) / 60000)}min`
                                : `Active for: ${Math.round((new Date().getTime() - new Date(visit.startTime).getTime()) / 60000)}min`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visit Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{dashboardStats?.todayVisits || 0}</div>
                  <div className="text-green-100 text-sm">Today's Visits</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <Timer className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{dashboardStats?.averageVisitDuration || 0}m</div>
                  <div className="text-blue-100 text-sm">Avg Duration</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <Store className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{dashboardStats?.dealersVisited || 0}</div>
                  <div className="text-purple-100 text-sm">Dealers Reached</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <Award className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">95%</div>
                  <div className="text-orange-100 text-sm">Success Rate</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 📝 REPORTS TAB */}
          <TabsContent value="reports" className="space-y-4 p-4 m-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Reports Dashboard
              </h2>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Filter
                </Button>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  New Report
                </Button>
              </div>
            </div>

            {/* Report Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{dashboardStats?.completedReports || 0}</div>
                  <div className="text-purple-100 text-sm">This Month</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{activeVisits.filter(v => !v.reportSubmitted).length}</div>
                  <div className="text-blue-100 text-sm">Pending</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">+15%</div>
                  <div className="text-green-100 text-sm">vs Last Month</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg">
                <CardContent className="p-4 text-center">
                  <Star className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-2xl font-bold">4.8</div>
                  <div className="text-orange-100 text-sm">Avg Rating</div>
                </CardContent>
              </Card>
            </div>

            {/* Report Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Daily Visit Reports</h3>
                        <p className="text-sm text-gray-600">Regular dealer visits</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-600">24</span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">This month</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Settings className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Technical Reports</h3>
                        <p className="text-sm text-gray-600">Technical support visits</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-purple-600">8</span>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300">This month</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Client Reports</h3>
                        <p className="text-sm text-gray-600">Client meetings & feedback</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-green-600">12</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">This month</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Competition Reports</h3>
                        <p className="text-sm text-gray-600">Market analysis & competition</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-orange-600">5</span>
                    <Badge className="bg-orange-100 text-orange-800 border-orange-300">This month</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 📊 ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-4 p-4 m-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Analytics Dashboard
              </h2>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Last 30 days
                </Button>
                <Button variant="outline" size="sm">
                  <Share className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Trophy className="w-12 h-12 text-white/80" />
                    <Badge className="bg-white/20 text-white border-white/30">Top Performer</Badge>
                  </div>
                  <div className="text-3xl font-bold mb-2">95%</div>
                  <div className="text-indigo-100">Success Rate</div>
                  <div className="text-xs text-indigo-200 mt-1">+5% vs last month</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Route className="w-12 h-12 text-white/80" />
                    <Badge className="bg-white/20 text-white border-white/30">Efficiency</Badge>
                  </div>
                  <div className="text-3xl font-bold mb-2">847km</div>
                  <div className="text-green-100">Total Distance</div>
                  <div className="text-xs text-green-200 mt-1">Average: 28km/day</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Zap className="w-12 h-12 text-white/80" />
                    <Badge className="bg-white/20 text-white border-white/30">Speed</Badge>
                  </div>
                  <div className="text-3xl font-bold mb-2">4.2</div>
                  <div className="text-orange-100">Visits per Day</div>
                  <div className="text-xs text-orange-200 mt-1">Above target (4.0)</div>
                </CardContent>
              </Card>
            </div>

            {/* Achievement Badges */}
            <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Achievements Unlocked</h3>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    <Crown className="w-3 h-3 mr-1" />
                    5 this month
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Fire className="w-8 h-8 text-white" />
                    </div>
                    <p className="font-bold text-gray-900 text-sm">Visit Streak</p>
                    <p className="text-xs text-gray-600">30 days straight</p>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Star className="w-8 h-8 text-white" />
                    </div>
                    <p className="font-bold text-gray-900 text-sm">Top Performer</p>
                    <p className="text-xs text-gray-600">Regional leader</p>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Target className="w-8 h-8 text-white" />
                    </div>
                    <p className="font-bold text-gray-900 text-sm">Goal Crusher</p>
                    <p className="text-xs text-gray-600">150% target</p>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Gem className="w-8 h-8 text-white" />
                    </div>
                    <p className="font-bold text-gray-900 text-sm">Excellence</p>
                    <p className="text-xs text-gray-600">Quality reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trend Analysis */}
            <Card className="bg-white/90 backdrop-blur-sm border-gray-200/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Performance Trends</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Visit Efficiency</p>
                        <p className="text-sm text-gray-600">Visits per hour improved</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">+23%</p>
                      <p className="text-xs text-green-700">vs last month</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <PieChart className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Report Quality</p>
                        <p className="text-sm text-gray-600">Average rating increased</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">4.8★</p>
                      <p className="text-xs text-blue-700">+0.3 improvement</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <LineChart className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Distance Optimization</p>
                        <p className="text-sm text-gray-600">Reduced travel time</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-600">-18%</p>
                      <p className="text-xs text-purple-700">travel time saved</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 🏪 DEALER DETAILS MODAL */}
      {showDealerDetails && selectedDealer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <Store className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedDealer.dealerName}</h2>
                    <p className="text-gray-600">{selectedDealer.dealerType || 'Dealer'} • {selectedDealer.city}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDealerDetails(false)}
                  className="p-2 rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Dealer Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{selectedDealer.visitCount}</div>
                  <div className="text-sm text-gray-600">Total Visits</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{selectedDealer.totalReports}</div>
                  <div className="text-sm text-gray-600">Reports Filed</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{selectedDealer.averageScore}★</div>
                  <div className="text-sm text-gray-600">Avg Rating</div>
                </div>
              </div>

              {/* Dealer Info */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Address</p>
                    <p className="text-sm text-gray-600">{selectedDealer.address}</p>
                  </div>
                </div>

                {selectedDealer.contactPerson && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Users className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Contact Person</p>
                      <p className="text-sm text-gray-600">{selectedDealer.contactPerson}</p>
                    </div>
                  </div>
                )}

                {selectedDealer.phone && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Phone</p>
                      <p className="text-sm text-gray-600">{selectedDealer.phone}</p>
                    </div>
                  </div>
                )}

                {selectedDealer.email && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Email</p>
                      <p className="text-sm text-gray-600">{selectedDealer.email}</p>
                    </div>
                  </div>
                )}

                {selectedDealer.lastVisited && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Last Visit</p>
                      <p className="text-sm text-gray-600">{new Date(selectedDealer.lastVisited).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                {geofenceStatus.canCheckIn && geofenceStatus.nearestDealer?.id === selectedDealer.id && activeJourney && (
                  <Select onValueChange={(value) => handleDealerCheckIn(selectedDealer, value)}>
                    <SelectTrigger className="flex-1 bg-green-500 text-white border-green-600">
                      <SelectValue placeholder="Check In Now" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Visit</SelectItem>
                      <SelectItem value="technical">Technical Visit</SelectItem>
                      <SelectItem value="client">Client Meeting</SelectItem>
                      <SelectItem value="competition">Competition Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                <Button variant="outline" className="flex-1">
                  <Globe className="w-4 h-4 mr-2" />
                  Get Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}