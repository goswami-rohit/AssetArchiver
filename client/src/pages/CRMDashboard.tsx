import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Home, MessageCircle, MapPin, User, Plus, CheckCircle, Calendar, 
  Building2, Target, Send, Mic, Search, Filter, MoreHorizontal,
  Clock, Zap, FileText, TrendingUp, LogIn, LogOut, Navigation,
  Settings, Bell, Edit, Trash2, ChevronRight, ArrowLeft, 
  RotateCcw, Download, Upload, Eye, Briefcase, Users,
  Activity, BarChart3, PieChart, Smartphone, Laptop,
  Wifi, WifiOff, RefreshCw, X, Check, AlertCircle, Award,
  Calendar as CalendarIcon, DollarSign, TrendingDown, Star,
  Map, Locate, Globe, TrendingDown as Score, Camera, 
  UserCheck, Phone, Mail, Clock3, MapPinned, Receipt
} from 'lucide-react';

// Import your custom components
import ChatInterface from '@/components/ChatInterface';
import JourneyTracker from '@/components/JourneyTracker';

// ============= STATE MANAGEMENT =============
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  company: { companyName: string };
}

interface AppState {
  user: User | null;
  currentPage: string;
  attendanceStatus: 'in' | 'out';
  isLoading: boolean;
  isOnline: boolean;
  lastSync: Date | null;
  
  // Enhanced Data
  dailyTasks: any[];
  pjps: any[];
  dealers: any[];
  reports: any[];
  attendance: any[];
  leaveApplications: any[];
  clientReports: any[];
  competitionReports: any[];
  technicalVisitReports: any[];
  dailyVisitReports: any[];
  dashboardStats: any;
  userTargets: any[];
  dealerScores: any[];
  
  // UI State
  showCreateModal: boolean;
  createType: 'task' | 'pjp' | 'dealer' | 'dvr' | 'tvr' | 'leave' | 'client-report' | 'competition-report' | 'dealer-score';
  selectedItem: any;
  showDetailModal: boolean;
  searchQuery: string;
  filterType: string;
  
  // Actions
  setUser: (user: User | null) => void;
  setCurrentPage: (page: string) => void;
  setAttendanceStatus: (status: 'in' | 'out') => void;
  setLoading: (loading: boolean) => void;
  setOnlineStatus: (online: boolean) => void;
  updateLastSync: () => void;
  setData: (key: string, data: any) => void;
  setUIState: (key: string, value: any) => void;
  resetModals: () => void;
}

const useAppStore = create<AppState>((set, get) => ({
  user: null,
  currentPage: 'home',
  attendanceStatus: 'out',
  isLoading: false,
  isOnline: true,
  lastSync: null,
  
  dailyTasks: [],
  pjps: [],
  dealers: [],
  reports: [],
  attendance: [],
  leaveApplications: [],
  clientReports: [],
  competitionReports: [],
  technicalVisitReports: [],
  dailyVisitReports: [],
  dashboardStats: {},
  userTargets: [],
  dealerScores: [],
  
  showCreateModal: false,
  createType: 'task',
  selectedItem: null,
  showDetailModal: false,
  searchQuery: '',
  filterType: 'all',
  
  setUser: (user) => set({ user }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setAttendanceStatus: (status) => set({ attendanceStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setOnlineStatus: (online) => set({ isOnline: online }),
  updateLastSync: () => set({ lastSync: new Date() }),
  setData: (key, data) => set({ [key]: data }),
  setUIState: (key, value) => set({ [key]: value }),
  resetModals: () => set({ 
    showCreateModal: false, 
    showDetailModal: false, 
    selectedItem: null 
  })
}));

// ============= ENHANCED API HOOKS =============
const useAPI = () => {
  const { user, setLoading, setData, updateLastSync } = useAppStore();
  
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      updateLastSync();
      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [updateLastSync]);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [
        tasksRes,
        pjpsRes,
        dealersRes,
        dvrRes,
        tvrRes,
        attendanceRes,
        leaveRes,
        clientRes,
        competitionRes,
        dealerScoresRes
      ] = await Promise.allSettled([
        apiCall(`/api/daily-tasks/user/${user.id}`),
        apiCall(`/api/pjp/user/${user.id}`),
        apiCall(`/api/dealers/user/${user.id}`),
        apiCall(`/api/daily-visit-reports/user/${user.id}?limit=20`),
        apiCall(`/api/technical-visit-reports/user/${user.id}`),
        apiCall(`/api/salesman-attendance/user/${user.id}`),
        apiCall(`/api/leave-applications/user/${user.id}`),
        apiCall(`/api/client-reports/user/${user.id}`),
        apiCall(`/api/competition-reports/user/${user.id}`),
        apiCall(`/api/dealer-reports-and-scores/user/${user.id}`)
      ]);

      if (tasksRes.status === 'fulfilled') setData('dailyTasks', tasksRes.value.data || []);
      if (pjpsRes.status === 'fulfilled') setData('pjps', pjpsRes.value.data || []);
      if (dealersRes.status === 'fulfilled') setData('dealers', dealersRes.value.data || []);
      if (dvrRes.status === 'fulfilled') setData('dailyVisitReports', dvrRes.value.data || []);
      if (tvrRes.status === 'fulfilled') setData('technicalVisitReports', tvrRes.value.data || []);
      if (attendanceRes.status === 'fulfilled') setData('attendance', attendanceRes.value.data || []);
      if (leaveRes.status === 'fulfilled') setData('leaveApplications', leaveRes.value.data || []);
      if (clientRes.status === 'fulfilled') setData('clientReports', clientRes.value.data || []);
      if (competitionRes.status === 'fulfilled') setData('competitionReports', competitionRes.value.data || []);
      if (dealerScoresRes.status === 'fulfilled') setData('dealerScores', dealerScoresRes.value.data || []);
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, apiCall, setData, setLoading]);

  const handleAttendancePunch = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      const endpoint = useAppStore.getState().attendanceStatus === 'out' 
        ? '/api/salesman-attendance/punch-in' 
        : '/api/salesman-attendance/punch-out';

      const response = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          inTimeLatitude: latitude,
          inTimeLongitude: longitude,
          locationName: 'Mobile App Location',
          accuracy: position.coords.accuracy
        })
      });

      if (response.success) {
        useAppStore.getState().setAttendanceStatus(
          useAppStore.getState().attendanceStatus === 'out' ? 'in' : 'out'
        );
        await fetchAllData();
      }
    } catch (error) {
      console.error('Attendance punch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user, apiCall, setLoading, fetchAllData]);

  const createRecord = useCallback(async (type: string, data: any) => {
    if (!user) return;

    const endpoints = {
      task: '/api/daily-tasks',
      pjp: '/api/pjp',
      dealer: '/api/dealers',
      dvr: '/api/daily-visit-reports',
      tvr: '/api/technical-visit-reports',
      leave: '/api/leave-applications',
      'client-report': '/api/client-reports',
      'competition-report': '/api/competition-reports',
      'dealer-score': '/api/dealer-reports-and-scores'
    };

    try {
      setLoading(true);
      const response = await apiCall(endpoints[type as keyof typeof endpoints], {
        method: 'POST',
        body: JSON.stringify({ ...data, userId: user.id })
      });

      if (response.success) {
        useAppStore.getState().resetModals();
        await fetchAllData();
        return response;
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, apiCall, setLoading, fetchAllData]);

  const updateRecord = useCallback(async (type: string, id: string, data: any) => {
    if (!user) return;

    const endpoints = {
      task: `/api/daily-tasks/${id}`,
      pjp: `/api/pjp/${id}`,
      dealer: `/api/dealers/${id}`,
      dvr: `/api/daily-visit-reports/${id}`,
      tvr: `/api/technical-visit-reports/${id}`,
      leave: `/api/leave-applications/${id}`,
      'client-report': `/api/client-reports/${id}`,
      'competition-report': `/api/competition-reports/${id}`,
      'dealer-score': `/api/dealer-reports-and-scores/${id}`
    };

    try {
      setLoading(true);
      const response = await apiCall(endpoints[type as keyof typeof endpoints], {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      if (response.success) {
        await fetchAllData();
        return response;
      }
    } catch (error) {
      console.error(`Failed to update ${type}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, apiCall, setLoading, fetchAllData]);

  const deleteRecord = useCallback(async (type: string, id: string) => {
    if (!user) return;

    const endpoints = {
      task: `/api/daily-tasks/${id}`,
      pjp: `/api/pjp/${id}`,
      dealer: `/api/dealers/${id}`,
      dvr: `/api/daily-visit-reports/${id}`,
      tvr: `/api/technical-visit-reports/${id}`,
      leave: `/api/leave-applications/${id}`,
      'client-report': `/api/client-reports/${id}`,
      'competition-report': `/api/competition-reports/${id}`,
      'dealer-score': `/api/dealer-reports-and-scores/${id}`
    };

    try {
      setLoading(true);
      const response = await apiCall(endpoints[type as keyof typeof endpoints], {
        method: 'DELETE'
      });

      if (response.success) {
        await fetchAllData();
        return response;
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, apiCall, setLoading, fetchAllData]);

  return {
    fetchAllData,
    handleAttendancePunch,
    createRecord,
    updateRecord,
    deleteRecord
  };
};

// ============= ENHANCED LOCATION PICKER WITH RADAR.IO INTEGRATION =============
const LocationPicker = ({ 
  onLocationSelect, 
  currentLocation,
  showCoordinates = false 
}: { 
  onLocationSelect: (location: string, coords?: { lat: number; lng: number }) => void;
  currentLocation?: string;
  showCoordinates?: boolean;
}) => {
  const [searchQuery, setSearchQuery] = useState(currentLocation || '');
  const [isLoading, setIsLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const getCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      const { latitude, longitude } = position.coords;
      setCoordinates({ lat: latitude, lng: longitude });
      
      // Enhanced location name with Radar.io integration
      const locationName = `📍 Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      onLocationSelect(locationName, { lat: latitude, lng: longitude });
      setSearchQuery(locationName);
    } catch (error) {
      console.error('Failed to get current location:', error);
      alert('Unable to get location. Please enable location services.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex space-x-2">
        <Input 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onLocationSelect(e.target.value, coordinates || undefined);
          }}
          placeholder="Search location, address, or area..."
          className="bg-gray-900/50 border-gray-600 text-white flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={getCurrentLocation}
          disabled={isLoading}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Locate className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      {showCoordinates && coordinates && (
        <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
          📍 Lat: {coordinates.lat.toFixed(6)}, Lng: {coordinates.lng.toFixed(6)}
        </div>
      )}
      
      <div className="flex space-x-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onLocationSelect(searchQuery, coordinates || undefined);
          }}
          className="text-blue-400 hover:bg-blue-400/10"
        >
          <MapPinned className="w-4 h-4 mr-1" />
          Use This Location
        </Button>
      </div>
    </div>
  );
};

// ============= ENHANCED STATUS BAR =============
const StatusBar = () => {
  const { isOnline, lastSync } = useAppStore();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-2 bg-gray-900/50 backdrop-blur-lg border-b border-gray-800"
    >
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-400">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      
      {lastSync && (
        <span className="text-xs text-gray-500">
          Last sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </motion.div>
  );
};

// ============= LOADING SKELETON =============
const LoadingSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <Card key={i} className="bg-gray-900/30 border-gray-800">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-12 w-12 rounded-full bg-gray-700" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4 bg-gray-700" />
              <Skeleton className="h-3 w-1/2 bg-gray-700" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// ============= MAIN DASHBOARD COMPONENT =============
export default function AdvancedCRM() {
  const {
    user,
    currentPage,
    attendanceStatus,
    isLoading,
    dailyTasks,
    pjps,
    dealers,
    dailyVisitReports,
    technicalVisitReports,
    clientReports,
    competitionReports,
    dashboardStats,
    userTargets,
    dealerScores,
    showCreateModal,
    createType,
    setUser,
    setCurrentPage,
    setUIState,
    resetModals
  } = useAppStore();

  const { 
    fetchAllData, 
    handleAttendancePunch, 
    createRecord, 
    updateRecord, 
    deleteRecord
  } = useAPI();

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }
    };

    initializeApp();
  }, [setUser]);

  // Fetch data when user changes
  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => useAppStore.getState().setOnlineStatus(true);
    const handleOffline = () => useAppStore.getState().setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Memoized filtered data
  const filteredTasks = useMemo(() => 
    dailyTasks.filter(task => task.status !== 'Completed').slice(0, 5),
    [dailyTasks]
  );

  const activePJPs = useMemo(() => 
    pjps.filter(pjp => pjp.status === 'active' || pjp.status === 'planned').slice(0, 5),
    [pjps]
  );

  const recentReports = useMemo(() => 
    [...dailyVisitReports, ...technicalVisitReports].slice(0, 3),
    [dailyVisitReports, technicalVisitReports]
  );

  // ============= HOME PAGE =============
  const HomePage = () => (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      <StatusBar />
      
      <div className="flex-1 overflow-y-auto">
        {/* Header Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
          <div className="relative px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-14 w-14 ring-2 ring-blue-500/50">
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg font-bold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <motion.h1 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-2xl font-bold text-white"
                  >
                    {user?.firstName} {user?.lastName}
                  </motion.h1>
                  <p className="text-blue-200">{user?.company?.companyName}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleAttendancePunch}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg ${
                    attendanceStatus === 'in' 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : attendanceStatus === 'in' ? (
                    <LogOut className="w-4 h-4 mr-2" />
                  ) : (
                    <LogIn className="w-4 h-4 mr-2" />
                  )}
                  {attendanceStatus === 'in' ? 'Punch Out' : 'Punch In'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  <Bell className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  label: "Today's Tasks", 
                  value: filteredTasks.length, 
                  icon: CheckCircle, 
                  color: "from-blue-500 to-blue-600" 
                },
                { 
                  label: "Active PJPs", 
                  value: activePJPs.length, 
                  icon: Calendar, 
                  color: "from-purple-500 to-purple-600" 
                },
                { 
                  label: "Total Dealers", 
                  value: dealers.length, 
                  icon: Building2, 
                  color: "from-orange-500 to-orange-600" 
                },
                { 
                  label: "Total Reports", 
                  value: recentReports.length, 
                  icon: BarChart3, 
                  color: "from-green-500 to-green-600" 
                }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700 hover:bg-gray-800/70 transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">{stat.label}</p>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                          <stat.icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-6 pb-32 space-y-8">
          {/* Enhanced Reports Section with All Types */}
          <Section
            title="Reports & Visits"
            icon={FileText}
            onAdd={() => {
              setUIState('createType', 'dvr');
              setUIState('showCreateModal', true);
            }}
          >
            <div className="flex space-x-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUIState('createType', 'dvr');
                  setUIState('showCreateModal', true);
                }}
                className="border-blue-600 text-blue-400 hover:bg-blue-400/10"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Daily Visit Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUIState('createType', 'tvr');
                  setUIState('showCreateModal', true);
                }}
                className="border-purple-600 text-purple-400 hover:bg-purple-400/10"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Technical Visit Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUIState('createType', 'client-report');
                  setUIState('showCreateModal', true);
                }}
                className="border-green-600 text-green-400 hover:bg-green-400/10"
              >
                <Users className="w-4 h-4 mr-2" />
                Client Report
              </Button>
            </div>
            
            {recentReports.length > 0 ? (
              <AnimatePresence>
                {recentReports.map((report, index) => (
                  <ReportCard 
                    key={report.id} 
                    report={report} 
                    index={index}
                    onView={(report) => {
                      setUIState('selectedItem', report);
                      setUIState('showDetailModal', true);
                    }}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No reports yet</p>
              </div>
            )}
          </Section>

          {/* Tasks Section */}
          <Section
            title="Today's Tasks"
            icon={CheckCircle}
            onAdd={() => {
              setUIState('createType', 'task');
              setUIState('showCreateModal', true);
            }}
          >
            {isLoading ? (
              <LoadingSkeleton rows={3} />
            ) : filteredTasks.length > 0 ? (
              <AnimatePresence>
                {filteredTasks.map((task, index) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    index={index}
                    onEdit={(task) => {
                      setUIState('selectedItem', task);
                      setUIState('createType', 'task');
                      setUIState('showCreateModal', true);
                    }}
                    onDelete={(taskId) => deleteRecord('task', taskId)}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks for today</p>
              </div>
            )}
          </Section>

          {/* Journey Plans Section */}
          <Section
            title="Journey Plans"
            icon={Navigation}
            onAdd={() => {
              setUIState('createType', 'pjp');
              setUIState('showCreateModal', true);
            }}
          >
            {activePJPs.length > 0 ? (
              <AnimatePresence>
                {activePJPs.map((pjp, index) => (
                  <PJPCard 
                    key={pjp.id} 
                    pjp={pjp} 
                    index={index}
                    onEdit={(pjp) => {
                      setUIState('selectedItem', pjp);
                      setUIState('createType', 'pjp');
                      setUIState('showCreateModal', true);
                    }}
                    onDelete={(pjpId) => deleteRecord('pjp', pjpId)}
                    onView={(pjp) => {
                      setUIState('selectedItem', pjp);
                      setUIState('showDetailModal', true);
                    }}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Navigation className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active journey plans</p>
              </div>
            )}
          </Section>

          {/* Dealers Section */}
          <Section
            title="Dealers & Clients"
            icon={Building2}
            onAdd={() => {
              setUIState('createType', 'dealer');
              setUIState('showCreateModal', true);
            }}
          >
            {dealers.length > 0 ? (
              <AnimatePresence>
                {dealers.slice(0, 5).map((dealer, index) => (
                  <DealerCard 
                    key={dealer.id} 
                    dealer={dealer} 
                    index={index}
                    onEdit={(dealer) => {
                      setUIState('selectedItem', dealer);
                      setUIState('createType', 'dealer');
                      setUIState('showCreateModal', true);
                    }}
                    onDelete={(dealerId) => deleteRecord('dealer', dealerId)}
                    onView={(dealer) => {
                      setUIState('selectedItem', dealer);
                      setUIState('showDetailModal', true);
                    }}
                    onScore={(dealer) => {
                      setUIState('selectedItem', dealer);
                      setUIState('createType', 'dealer-score');
                      setUIState('showCreateModal', true);
                    }}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No dealers added yet</p>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );

  // ============= PROFILE PAGE =============
  const ProfilePage = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col"
    >
      <StatusBar />
      
      <div className="flex-1 overflow-y-auto px-6 py-8 pb-32">
        {/* Profile Header */}
        <div className="text-center mb-8">
          <Avatar className="h-24 w-24 mx-auto mb-4 ring-4 ring-blue-500/30">
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-2xl font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold text-white mb-1">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-gray-400">{user?.email}</p>
          <Badge className="mt-2 bg-blue-600 text-white">{user?.role}</Badge>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <FileText className="w-5 h-5 text-blue-400 mr-2" />
                <p className="text-2xl font-bold text-white">{recentReports.length}</p>
              </div>
              <p className="text-sm text-gray-400">Total Reports</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Building2 className="w-5 h-5 text-orange-400 mr-2" />
                <p className="text-2xl font-bold text-white">{dealers.length}</p>
              </div>
              <p className="text-sm text-gray-400">Dealers Managed</p>
            </CardContent>
          </Card>
        </div>

        {/* Profile Actions */}
        <div className="space-y-4">
          <Button 
            onClick={() => {
              localStorage.removeItem('user');
              setUser(null);
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </motion.div>
  );

  // ============= SECTION COMPONENT =============
  const Section = ({ 
    title, 
    icon: Icon, 
    children, 
    onAdd
  }: {
    title: string;
    icon: any;
    children: React.ReactNode;
    onAdd: () => void;
  }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Icon className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
        <Button
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </motion.div>
  );

  // ============= CARD COMPONENTS =============
  const TaskCard = ({ 
    task, 
    index, 
    onEdit, 
    onDelete 
  }: { 
    task: any; 
    index: number;
    onEdit: (task: any) => void;
    onDelete: (taskId: string) => void;
  }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700 hover:bg-gray-800/70 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-white">{task.visitType || task.title}</h3>
              <p className="text-sm text-gray-400 mt-1">{task.description}</p>
              <div className="flex items-center space-x-2 mt-3">
                <Badge variant={task.priority === 'high' ? 'destructive' : 'default'}>
                  {task.priority || 'Normal'}
                </Badge>
                <span className="text-xs text-gray-500">{task.taskDate}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-blue-400"
                onClick={() => onEdit(task)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-red-400"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const PJPCard = ({ 
    pjp, 
    index, 
    onEdit, 
    onDelete,
    onView
  }: { 
    pjp: any; 
    index: number;
    onEdit: (pjp: any) => void;
    onDelete: (pjpId: string) => void;
    onView: (pjp: any) => void;
  }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700 hover:bg-gray-800/70 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1" onClick={() => onView(pjp)} style={{ cursor: 'pointer' }}>
              <h3 className="font-semibold text-white">{pjp.objective}</h3>
              <p className="text-sm text-gray-400 mt-1">{pjp.siteName || pjp.location}</p>
              <div className="flex items-center space-x-2 mt-3">
                <Badge 
                  variant="outline" 
                  className={
                    pjp.status === 'active' ? 'text-green-400 border-green-400' :
                    pjp.status === 'planned' ? 'text-blue-400 border-blue-400' :
                    'text-yellow-400 border-yellow-400'
                  }
                >
                  {pjp.status}
                </Badge>
                <span className="text-xs text-gray-500">{pjp.planDate}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-blue-400"
                onClick={() => onView(pjp)}
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-blue-400"
                onClick={() => onEdit(pjp)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-red-400"
                onClick={() => onDelete(pjp.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const DealerCard = ({ 
    dealer, 
    index, 
    onEdit, 
    onDelete, 
    onView,
    onScore 
  }: { 
    dealer: any; 
    index: number;
    onEdit: (dealer: any) => void;
    onDelete: (dealerId: string) => void;
    onView: (dealer: any) => void;
    onScore: (dealer: any) => void;
  }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700 hover:bg-gray-800/70 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1" onClick={() => onView(dealer)} style={{ cursor: 'pointer' }}>
              <h3 className="font-semibold text-white">{dealer.name}</h3>
              <p className="text-sm text-gray-400 mt-1">{dealer.region} - {dealer.area}</p>
              <div className="flex items-center space-x-2 mt-3">
                <Badge variant="outline">{dealer.type}</Badge>
                <span className="text-xs text-gray-500">₹{dealer.totalPotential}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-yellow-400"
                onClick={() => onScore(dealer)}
              >
                <Star className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-blue-400"
                onClick={() => onEdit(dealer)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-red-400"
                onClick={() => onDelete(dealer.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const ReportCard = ({ 
    report, 
    index, 
    onView 
  }: { 
    report: any; 
    index: number;
    onView: (report: any) => void;
  }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700 hover:bg-gray-800/70 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1" onClick={() => onView(report)} style={{ cursor: 'pointer' }}>
              <h3 className="font-semibold text-white">{report.visitType || report.title || 'Report'}</h3>
              <p className="text-sm text-gray-400 mt-1">{report.location || report.siteNameConcernedPerson}</p>
              <div className="flex items-center space-x-2 mt-3">
                <Badge variant="outline">{report.reportDate ? 'TVR' : 'DVR'}</Badge>
                <span className="text-xs text-gray-500">{report.reportDate || report.date}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-blue-400"
                onClick={() => onView(report)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Other pages (AI, Journey) remain the same
  const AIPage = () => (
    <div className="h-full">
      <ChatInterface
        onBack={() => setCurrentPage('home')}
      />
    </div>
  );

  const JourneyPage = () => (
    <div className="h-full">
      <JourneyTracker
        userId={user?.id || 1}
        onBack={() => setCurrentPage('home')}
        onJourneyEnd={() => {
          fetchAllData();
          setCurrentPage('home');
        }}
      />
    </div>
  );

  // ============= RENDER PAGE =============
  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'ai': return <AIPage />;
      case 'journey': return <JourneyPage />;
      case 'profile': return <ProfilePage />;
      default: return <HomePage />;
    }
  };

  // ============= MAIN RENDER =============
  return (
    <div className="h-screen flex flex-col bg-gray-900 max-w-md mx-auto relative overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      {(currentPage !== 'ai' && currentPage !== 'journey') && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700/50 shadow-2xl safe-area-pb"
        >
          <div className="flex items-center justify-around py-3 px-4">
            {[
              { key: 'home', icon: Home, label: 'Home' },
              { key: 'ai', icon: MessageCircle, label: 'AI' },
              { key: 'journey', icon: MapPin, label: 'Journey' },
              { key: 'profile', icon: User, label: 'Profile' }
            ].map((nav) => (
              <motion.button
                key={nav.key}
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setCurrentPage(nav.key)}
                className={`
                  flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-2xl 
                  transition-all duration-300 min-w-[60px] relative overflow-hidden
                  ${currentPage === nav.key 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }
                `}
              >
                {currentPage === nav.key && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <nav.icon className={`w-5 h-5 relative z-10 ${currentPage === nav.key ? 'text-white' : ''}`} />
                <span className={`text-xs font-medium relative z-10 ${currentPage === nav.key ? 'text-white' : ''}`}>
                  {nav.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Enhanced Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateModal 
            type={createType}
            onClose={resetModals}
            onCreate={createRecord}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============= COMPREHENSIVE CREATE MODAL WITH ALL FORMS =============
const CreateModal = ({ 
  type, 
  onClose, 
  onCreate 
}: {
  type: string;
  onClose: () => void;
  onCreate: (type: string, data: any) => Promise<any>;
}) => {
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const { user, dealers } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let transformedData = { ...formData };
      
      // Technical Visit Report (TVR) - Exact Schema Alignment
      if (type === 'tvr') {
        transformedData = {
          userId: user?.id || 1,
          reportDate: formData.reportDate || new Date().toISOString().split('T')[0],
          visitType: formData.visitType || 'Technical Visit',
          siteNameConcernedPerson: formData.siteNameConcernedPerson || '',
          phoneNo: formData.phoneNo || '',
          emailId: formData.emailId || null,
          clientsRemarks: formData.clientsRemarks || '',
          salespersonRemarks: formData.salespersonRemarks || '',
          checkInTime: formData.checkInTime || new Date().toISOString(),
          checkOutTime: formData.checkOutTime || null,
          inTimeImageUrl: formData.inTimeImageUrl || null,
          outTimeImageUrl: formData.outTimeImageUrl || null
        };
      }

      // Daily Visit Report (DVR)
      if (type === 'dvr') {
        transformedData = {
          userId: user?.id || 1,
          reportDate: formData.reportDate || new Date().toISOString().split('T')[0],
          location: formData.location || '',
          dealerName: formData.dealerName || '',
          visitPurpose: formData.visitPurpose || '',
          visitOutcome: formData.visitOutcome || '',
          orderValue: formData.orderValue || '0',
          collectionAmount: formData.collectionAmount || '0',
          marketFeedback: formData.marketFeedback || '',
          competitorActivity: formData.competitorActivity || '',
          nextActionPlan: formData.nextActionPlan || ''
        };
      }

      // Client Report - Exact Schema Alignment
      if (type === 'client-report') {
        transformedData = {
          userId: user?.id || 1,
          dealerType: formData.dealerType || '',
          dealerSubDealerName: formData.dealerSubDealerName || '',
          location: formData.location || '',
          typeBestNonBest: formData.typeBestNonBest || '',
          dealerTotalPotential: formData.dealerTotalPotential || '0.00',
          dealerBestPotential: formData.dealerBestPotential || '0.00',
          brandSelling: selectedBrands,
          contactPerson: formData.contactPerson || '',
          contactPersonPhoneNo: formData.contactPersonPhoneNo || '',
          todayOrderMT: formData.todayOrderMT || '0.00',
          todayCollection: formData.todayCollection || '0.00',
          feedbacks: formData.feedbacks || '',
          solutionsAsPerSalesperson: formData.solutionsAsPerSalesperson || '',
          anyRemarks: formData.anyRemarks || '',
          checkOutTime: formData.checkOutTime || new Date().toISOString()
        };
      }

      // Competition Report
      if (type === 'competition-report') {
        transformedData = {
          userId: user?.id || 1,
          competitorName: formData.competitorName || '',
          location: formData.location || '',
          products: formData.products || '',
          pricing: formData.pricing || '',
          promotions: formData.promotions || '',
          marketShare: formData.marketShare || '',
          strengths: formData.strengths || '',
          weaknesses: formData.weaknesses || '',
          opportunities: formData.opportunities || '',
          threats: formData.threats || ''
        };
      }

      // Dealer Score - Exact Schema Alignment
      if (type === 'dealer-score') {
        transformedData = {
          dealerId: formData.dealerId || useAppStore.getState().selectedItem?.id,
          dealerScore: formData.dealerScore || 0,
          trustWorthinessScore: formData.trustWorthinessScore || 0,
          creditWorthinessScore: formData.creditWorthinessScore || 0,
          orderHistoryScore: formData.orderHistoryScore || 0,
          visitFrequencyScore: formData.visitFrequencyScore || 0,
          lastUpdatedDate: new Date().toISOString()
        };
      }

      // Other forms remain the same
      if (type === 'task') {
        transformedData = {
          userId: user?.id || 1,
          assignedByUserId: user?.id || 1,
          taskDate: formData.taskDate || new Date().toISOString().split('T')[0],
          visitType: formData.title || formData.visitType || 'General Task',
          relatedDealerId: formData.relatedDealerId || null,
          siteName: formData.siteName || formData.title || '',
          description: formData.description || ''
        };
      }

      if (type === 'pjp') {
        transformedData = {
          userId: user?.id || 1,
          planDate: formData.plannedDate || formData.planDate,
          visitType: formData.visitType || 'Field Visit',
          siteName: formData.location || formData.siteName,
          areaToBeVisited: formData.area || formData.areaToBeVisited || formData.location,
          objective: formData.objective || '',
          expectedOutcome: formData.expectedOutcome || '',
          status: 'planned'
        };
      }

      if (type === 'dealer') {
        transformedData = {
          userId: user?.id || 1,
          name: formData.name,
          region: formData.region,
          area: formData.area,
          type: formData.type || 'Standard',
          contact: formData.contact || '',
          address: formData.address || formData.location || '',
          totalPotential: formData.totalPotential || '0'
        };
      }

      await onCreate(type, transformedData);
      onClose();
    } catch (error) {
      console.error('Failed to create record:', error);
      alert('Failed to create record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles = {
    task: 'Create New Task',
    pjp: 'Create New PJP',
    dealer: 'Create New Dealer',
    dvr: 'Create Daily Visit Report',
    tvr: 'Create Technical Visit Report',
    leave: 'Apply for Leave',
    'client-report': 'Create Client Report',
    'competition-report': 'Create Competition Report',
    'dealer-score': 'Score Dealer Performance'
  };

  const brandOptions = [
    'Brand A', 'Brand B', 'Brand C', 'Brand D', 'Brand E',
    'Competitor X', 'Competitor Y', 'Others'
  ];

  const handleBrandToggle = (brand: string) => {
    setSelectedBrands(prev => 
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-700/50"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {titles[type as keyof typeof titles]}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* TECHNICAL VISIT REPORT (TVR) FORM - Exact Schema Alignment */}
          {type === 'tvr' && (
            <>
              <div>
                <Label className="text-gray-300">Report Date *</Label>
                <Input 
                  type="date"
                  value={formData.reportDate || ''}
                  onChange={(e) => setFormData({...formData, reportDate: e.target.value})}
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Visit Type *</Label>
                <Select 
                  value={formData.visitType || ''} 
                  onValueChange={(value) => setFormData({...formData, visitType: value})}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Select visit type" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="Technical Support">Technical Support</SelectItem>
                    <SelectItem value="Product Demo">Product Demo</SelectItem>
                    <SelectItem value="Installation">Installation</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Troubleshooting">Troubleshooting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Site Name / Concerned Person *</Label>
                <Input 
                  value={formData.siteNameConcernedPerson || ''}
                  onChange={(e) => setFormData({...formData, siteNameConcernedPerson: e.target.value})}
                  placeholder="Site name or person to meet"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Phone Number *</Label>
                <Input 
                  value={formData.phoneNo || ''}
                  onChange={(e) => setFormData({...formData, phoneNo: e.target.value})}
                  placeholder="Contact phone number"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Email ID</Label>
                <Input 
                  type="email"
                  value={formData.emailId || ''}
                  onChange={(e) => setFormData({...formData, emailId: e.target.value})}
                  placeholder="Contact email address"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Client's Remarks *</Label>
                <Textarea 
                  value={formData.clientsRemarks || ''}
                  onChange={(e) => setFormData({...formData, clientsRemarks: e.target.value})}
                  placeholder="What did the client say?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={3}
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Salesperson Remarks *</Label>
                <Textarea 
                  value={formData.salespersonRemarks || ''}
                  onChange={(e) => setFormData({...formData, salespersonRemarks: e.target.value})}
                  placeholder="Your observations and notes"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Check In Time *</Label>
                  <Input 
                    type="datetime-local"
                    value={formData.checkInTime || ''}
                    onChange={(e) => setFormData({...formData, checkInTime: e.target.value})}
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Check Out Time</Label>
                  <Input 
                    type="datetime-local"
                    value={formData.checkOutTime || ''}
                    onChange={(e) => setFormData({...formData, checkOutTime: e.target.value})}
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Location</Label>
                <LocationPicker 
                  currentLocation={formData.location}
                  onLocationSelect={(location, coords) => {
                    setFormData({
                      ...formData, 
                      location,
                      latitude: coords?.lat,
                      longitude: coords?.lng
                    });
                  }}
                  showCoordinates={true}
                />
              </div>
            </>
          )}

          {/* DAILY VISIT REPORT (DVR) FORM */}
          {type === 'dvr' && (
            <>
              <div>
                <Label className="text-gray-300">Report Date *</Label>
                <Input 
                  type="date"
                  value={formData.reportDate || ''}
                  onChange={(e) => setFormData({...formData, reportDate: e.target.value})}
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Location *</Label>
                <LocationPicker 
                  currentLocation={formData.location}
                  onLocationSelect={(location, coords) => {
                    setFormData({
                      ...formData, 
                      location,
                      latitude: coords?.lat,
                      longitude: coords?.lng
                    });
                  }}
                />
              </div>
              <div>
                <Label className="text-gray-300">Dealer Name *</Label>
                <Input 
                  value={formData.dealerName || ''}
                  onChange={(e) => setFormData({...formData, dealerName: e.target.value})}
                  placeholder="Dealer or client name"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Visit Purpose *</Label>
                <Select 
                  value={formData.visitPurpose || ''} 
                  onValueChange={(value) => setFormData({...formData, visitPurpose: value})}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Select visit purpose" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="Sales Meeting">Sales Meeting</SelectItem>
                    <SelectItem value="Order Collection">Order Collection</SelectItem>
                    <SelectItem value="Payment Collection">Payment Collection</SelectItem>
                    <SelectItem value="Relationship Building">Relationship Building</SelectItem>
                    <SelectItem value="Market Survey">Market Survey</SelectItem>
                    <SelectItem value="Support Visit">Support Visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Visit Outcome *</Label>
                <Textarea 
                  value={formData.visitOutcome || ''}
                  onChange={(e) => setFormData({...formData, visitOutcome: e.target.value})}
                  placeholder="What was achieved during this visit?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Order Value (₹)</Label>
                  <Input 
                    type="number"
                    value={formData.orderValue || ''}
                    onChange={(e) => setFormData({...formData, orderValue: e.target.value})}
                    placeholder="0"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Collection Amount (₹)</Label>
                  <Input 
                    type="number"
                    value={formData.collectionAmount || ''}
                    onChange={(e) => setFormData({...formData, collectionAmount: e.target.value})}
                    placeholder="0"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Market Feedback</Label>
                <Textarea 
                  value={formData.marketFeedback || ''}
                  onChange={(e) => setFormData({...formData, marketFeedback: e.target.value})}
                  placeholder="Market conditions, competitor activity, etc."
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-gray-300">Next Action Plan</Label>
                <Textarea 
                  value={formData.nextActionPlan || ''}
                  onChange={(e) => setFormData({...formData, nextActionPlan: e.target.value})}
                  placeholder="What needs to be done next?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* CLIENT REPORT FORM - Exact Schema Alignment */}
          {type === 'client-report' && (
            <>
              <div>
                <Label className="text-gray-300">Dealer Type *</Label>
                <Select 
                  value={formData.dealerType || ''} 
                  onValueChange={(value) => setFormData({...formData, dealerType: value})}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Select dealer type" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="Distributor">Distributor</SelectItem>
                    <SelectItem value="Retailer">Retailer</SelectItem>
                    <SelectItem value="Wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="Sub Dealer">Sub Dealer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Dealer/Sub Dealer Name *</Label>
                <Input 
                  value={formData.dealerSubDealerName || ''}
                  onChange={(e) => setFormData({...formData, dealerSubDealerName: e.target.value})}
                  placeholder="Business name"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Location *</Label>
                <LocationPicker 
                  currentLocation={formData.location}
                  onLocationSelect={(location) => setFormData({...formData, location})}
                />
              </div>
              <div>
                <Label className="text-gray-300">Type - Best/Non-Best *</Label>
                <Select 
                  value={formData.typeBestNonBest || ''} 
                  onValueChange={(value) => setFormData({...formData, typeBestNonBest: value})}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="Best">Best</SelectItem>
                    <SelectItem value="Non-Best">Non-Best</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Total Potential (₹) *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.dealerTotalPotential || ''}
                    onChange={(e) => setFormData({...formData, dealerTotalPotential: e.target.value})}
                    placeholder="0.00"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Best Potential (₹) *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.dealerBestPotential || ''}
                    onChange={(e) => setFormData({...formData, dealerBestPotential: e.target.value})}
                    placeholder="0.00"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Brands Selling *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {brandOptions.map(brand => (
                    <div key={brand} className="flex items-center space-x-2">
                      <Checkbox
                        id={brand}
                        checked={selectedBrands.includes(brand)}
                        onCheckedChange={() => handleBrandToggle(brand)}
                      />
                      <Label htmlFor={brand} className="text-sm text-gray-300">{brand}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Contact Person *</Label>
                  <Input 
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    placeholder="Contact name"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Phone Number *</Label>
                  <Input 
                    value={formData.contactPersonPhoneNo || ''}
                    onChange={(e) => setFormData({...formData, contactPersonPhoneNo: e.target.value})}
                    placeholder="Phone number"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Today Order MT *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.todayOrderMT || ''}
                    onChange={(e) => setFormData({...formData, todayOrderMT: e.target.value})}
                    placeholder="0.00"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Today Collection (₹) *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.todayCollection || ''}
                    onChange={(e) => setFormData({...formData, todayCollection: e.target.value})}
                    placeholder="0.00"
                    className="bg-gray-900/50 border-gray-600 text-white mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Feedbacks *</Label>
                <Textarea 
                  value={formData.feedbacks || ''}
                  onChange={(e) => setFormData({...formData, feedbacks: e.target.value})}
                  placeholder="Client feedbacks and comments"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={3}
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Solutions as per Salesperson *</Label>
                <Textarea 
                  value={formData.solutionsAsPerSalesperson || ''}
                  onChange={(e) => setFormData({...formData, solutionsAsPerSalesperson: e.target.value})}
                  placeholder="Your recommended solutions"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={3}
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Any Remarks *</Label>
                <Textarea 
                  value={formData.anyRemarks || ''}
                  onChange={(e) => setFormData({...formData, anyRemarks: e.target.value})}
                  placeholder="Additional remarks"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                  required
                />
              </div>
            </>
          )}

          {/* COMPETITION REPORT FORM */}
          {type === 'competition-report' && (
            <>
              <div>
                <Label className="text-gray-300">Competitor Name *</Label>
                <Input 
                  value={formData.competitorName || ''}
                  onChange={(e) => setFormData({...formData, competitorName: e.target.value})}
                  placeholder="Competitor business name"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Location *</Label>
                <LocationPicker 
                  currentLocation={formData.location}
                  onLocationSelect={(location) => setFormData({...formData, location})}
                />
              </div>
              <div>
                <Label className="text-gray-300">Products/Services *</Label>
                <Textarea 
                  value={formData.products || ''}
                  onChange={(e) => setFormData({...formData, products: e.target.value})}
                  placeholder="What products/services do they offer?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Pricing Strategy *</Label>
                <Textarea 
                  value={formData.pricing || ''}
                  onChange={(e) => setFormData({...formData, pricing: e.target.value})}
                  placeholder="Their pricing model and strategies"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Promotions & Marketing</Label>
                <Textarea 
                  value={formData.promotions || ''}
                  onChange={(e) => setFormData({...formData, promotions: e.target.value})}
                  placeholder="Their marketing campaigns and promotions"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-gray-300">Market Share Estimate</Label>
                <Input 
                  value={formData.marketShare || ''}
                  onChange={(e) => setFormData({...formData, marketShare: e.target.value})}
                  placeholder="Estimated market share percentage"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Strengths</Label>
                <Textarea 
                  value={formData.strengths || ''}
                  onChange={(e) => setFormData({...formData, strengths: e.target.value})}
                  placeholder="Their competitive advantages"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-gray-300">Weaknesses</Label>
                <Textarea 
                  value={formData.weaknesses || ''}
                  onChange={(e) => setFormData({...formData, weaknesses: e.target.value})}
                  placeholder="Their vulnerabilities and weak points"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-gray-300">Opportunities for Us</Label>
                <Textarea 
                  value={formData.opportunities || ''}
                  onChange={(e) => setFormData({...formData, opportunities: e.target.value})}
                  placeholder="How can we capitalize on this intelligence?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-gray-300">Threats to Our Business</Label>
                <Textarea 
                  value={formData.threats || ''}
                  onChange={(e) => setFormData({...formData, threats: e.target.value})}
                  placeholder="How might they affect our business?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* DEALER SCORING FORM - Exact Schema Alignment */}
          {type === 'dealer-score' && (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Score: {useAppStore.getState().selectedItem?.name}
                </h3>
              </div>
              <div>
                <Label className="text-gray-300 flex justify-between">
                  <span>Overall Dealer Score</span>
                  <span>{formData.dealerScore || 0}/10</span>
                </Label>
                <Slider
                  value={[formData.dealerScore || 0]}
                  onValueChange={(value) => setFormData({...formData, dealerScore: value[0]})}
                  max={10}
                  step={0.1}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-gray-300 flex justify-between">
                  <span>Trustworthiness Score</span>
                  <span>{formData.trustWorthinessScore || 0}/10</span>
                </Label>
                <Slider
                  value={[formData.trustWorthinessScore || 0]}
                  onValueChange={(value) => setFormData({...formData, trustWorthinessScore: value[0]})}
                  max={10}
                  step={0.1}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-gray-300 flex justify-between">
                  <span>Credit Worthiness Score</span>
                  <span>{formData.creditWorthinessScore || 0}/10</span>
                </Label>
                <Slider
                  value={[formData.creditWorthinessScore || 0]}
                  onValueChange={(value) => setFormData({...formData, creditWorthinessScore: value[0]})}
                  max={10}
                  step={0.1}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-gray-300 flex justify-between">
                  <span>Order History Score</span>
                  <span>{formData.orderHistoryScore || 0}/10</span>
                </Label>
                <Slider
                  value={[formData.orderHistoryScore || 0]}
                  onValueChange={(value) => setFormData({...formData, orderHistoryScore: value[0]})}
                  max={10}
                  step={0.1}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-gray-300 flex justify-between">
                  <span>Visit Frequency Score</span>
                  <span>{formData.visitFrequencyScore || 0}/10</span>
                </Label>
                <Slider
                  value={[formData.visitFrequencyScore || 0]}
                  onValueChange={(value) => setFormData({...formData, visitFrequencyScore: value[0]})}
                  max={10}
                  step={0.1}
                  className="mt-2"
                />
              </div>
            </>
          )}

          {/* OTHER FORMS (Task, PJP, Dealer) remain the same as before */}
          {type === 'task' && (
            <>
              <div>
                <Label className="text-gray-300">Task Title</Label>
                <Input 
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Enter task title"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Description</Label>
                <Textarea 
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Task description"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Task Date</Label>
                <Input 
                  type="date"
                  value={formData.taskDate || ''}
                  onChange={(e) => setFormData({...formData, taskDate: e.target.value})}
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">Site/Location</Label>
                <LocationPicker 
                  currentLocation={formData.siteName}
                  onLocationSelect={(location) => setFormData({...formData, siteName: location})}
                />
              </div>
            </>
          )}

          {type === 'pjp' && (
            <>
              <div>
                <Label className="text-gray-300">Objective</Label>
                <Input 
                  value={formData.objective || ''}
                  onChange={(e) => setFormData({...formData, objective: e.target.value})}
                  placeholder="Journey objective"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Location</Label>
                <LocationPicker 
                  currentLocation={formData.location}
                  onLocationSelect={(location) => setFormData({...formData, location})}
                />
              </div>
              <div>
                <Label className="text-gray-300">Planned Date</Label>
                <Input 
                  type="date"
                  value={formData.plannedDate || ''}
                  onChange={(e) => setFormData({...formData, plannedDate: e.target.value})}
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Expected Outcome</Label>
                <Textarea 
                  value={formData.expectedOutcome || ''}
                  onChange={(e) => setFormData({...formData, expectedOutcome: e.target.value})}
                  placeholder="What do you expect to achieve?"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                />
              </div>
            </>
          )}

          {type === 'dealer' && (
            <>
              <div>
                <Label className="text-gray-300">Dealer Name</Label>
                <Input 
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Dealer name"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Region</Label>
                <Input 
                  value={formData.region || ''}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  placeholder="Region"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Area</Label>
                <Input 
                  value={formData.area || ''}
                  onChange={(e) => setFormData({...formData, area: e.target.value})}
                  placeholder="Area"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">Address/Location</Label>
                <LocationPicker 
                  currentLocation={formData.location}
                  onLocationSelect={(location) => setFormData({...formData, location})}
                />
              </div>
              <div>
                <Label className="text-gray-300">Contact</Label>
                <Input 
                  value={formData.contact || ''}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  placeholder="Phone number"
                  className="bg-gray-900/50 border-gray-600 text-white mt-1"
                />
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};