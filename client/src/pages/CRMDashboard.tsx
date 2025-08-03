import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock, MapPin, Users, CheckCircle, Play, Square, Calendar, Building2, MessageCircle, Send, Mic, Camera,
  Navigation, Plus, List, UserPlus, CalendarDays, LogIn, LogOut, Briefcase, TrendingUp, Zap, Star, Heart,
  Sparkles, Target, Route, Store, BarChart3, Settings, AlertCircle, Loader2, RefreshCw, Eye, Edit, Trash2,
  Home, Phone, Mail, Globe, Award, Battery, Wifi, Signal, ChevronRight, Activity, FileText, Users2,
  MapPinned, Timer, DollarSign, Package, ShoppingCart, TrendingDown, PieChart, BarChart, LineChart
} from 'lucide-react';
import ChatInterface from '@/components/ChatInterface';
import JourneyTracker from '@/components/JourneyTracker';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  company: {
    companyName: string;
  };
}

interface Dealer {
  id: string;
  name: string;
  type: string;
  region: string;
  area: string;
  phoneNo: string;
  address: string;
  totalPotential: string;
  bestPotential: string;
  brandSelling: string[];
  feedbacks: string;
}

interface DashboardStats {
  attendance: {
    isCheckedIn: boolean;
    checkInTime?: string;
    totalHours: number;
    weeklyHours: number;
  };
  journey: {
    isActive: boolean;
    totalDistance: string;
    activeDuration: string;
    dealerVisits: number;
  };
  reports: {
    dvrCount: number;
    tvrCount: number;
    competitionCount: number;
    pendingReports: number;
  };
  tasks: {
    pending: number;
    completed: number;
    overdue: number;
  };
  dealers: {
    total: number;
    visited: number;
    pending: number;
  };
  leave: {
    pending: number;
    approved: number;
    remaining: number;
  };
}

export default function CRMDashboard() {
  // Core State
  const [user, setUser] = useState<User | null>(null);
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [chatContext, setChatContext] = useState<string>('dashboard');
  const [attendanceStatus, setAttendanceStatus] = useState<'out' | 'in' | null>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);

  // Data State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [showDealerForm, setShowDealerForm] = useState(false);
  const [showDealersList, setShowDealersList] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Form State
  const [dealerForm, setDealerForm] = useState({
    name: '', type: 'Dealer', region: '', area: '', phoneNo: '', address: '',
    totalPotential: '', bestPotential: '', brandSelling: [''], feedbacks: '', remarks: ''
  });

  const [leaveForm, setLeaveForm] = useState({
    leaveType: '', startDate: '', endDate: '', reason: '', totalDays: 1
  });

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium', dueDate: '', assignedTo: ''
  });

  // 🚀 INITIALIZATION
  useEffect(() => {
    initializeDashboard();
    setupLocationTracking();
    setupAutoRefresh();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllDashboardData();
    }
  }, [user]);

  const initializeDashboard = async () => {
    setIsLoading(true);
    try {
      // Get user data from localStorage or API
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } else {
        // Fallback: fetch user data from API if not in localStorage
        await fetchUserData();
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      addError('Failed to initialize dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const setupLocationTracking = () => {
    if (navigator.geolocation) {
      // High accuracy location for better tracking
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Location error:', error);
          addError('Location services unavailable');
        },
        options
      );

      // Watch position for real-time updates
      navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.warn('Location watch error:', error),
        options
      );
    }
  };

  const setupAutoRefresh = () => {
    // Auto-refresh dashboard data every 5 minutes
    const interval = setInterval(() => {
      if (user && !refreshing) {
        refreshDashboard();
      }
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  };

  // 🎯 COMPREHENSIVE DATA FETCHING - HOOKS TO ALL YOUR ENDPOINTS
  const fetchAllDashboardData = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      await Promise.all([
        fetchAttendanceStatus(),
        fetchJourneyStatus(),
        fetchDashboardStats(),
        fetchTasks(),
        fetchDealers(),
        fetchRecentReports(),
        fetchLeaveApplications()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      addError('Failed to load dashboard data');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchAttendanceStatus = async () => {
    if (!user) return;

    try {
      console.log('🔍 Fetching attendance for user:', user.id); // DEBUG
      const response = await fetch(`/api/attendance/today/${user.id}`);
      const data = await response.json();
      console.log('🔍 API Response:', data); // DEBUG

      if (data.success) {
        // 🔥 UPDATED: Handle new API response structure with multiple sessions
        if (data.hasAttendance) {
          console.log('🔍 Has attendance data'); // DEBUG
          console.log('🔍 Active session:', data.activeSession); // DEBUG
          console.log('🔍 Total sessions:', data.totalSessions); // DEBUG
          console.log('🔍 Currently punched in:', data.punchedIn); // DEBUG

          // 🔥 NEW: Set attendance data to active session or latest session
          const attendanceToDisplay = data.activeSession || data.latestSession;
          if (attendanceToDisplay) {
            setAttendanceData(attendanceToDisplay);
          }

          // 🔥 UPDATED: Use the API's calculated punchedIn status
          const newStatus = data.punchedIn ? 'in' : 'out';
          console.log('🔍 Setting status to:', newStatus); // DEBUG
          setAttendanceStatus(newStatus);
        } else {
          console.log('🔍 No attendance data, setting to out'); // DEBUG
          setAttendanceStatus('out');
          setAttendanceData(null); // 🔥 SAFETY: Clear any old data
        }
      } else {
        console.log('🔍 API not successful, setting to out'); // DEBUG
        setAttendanceStatus('out');
        setAttendanceData(null); // 🔥 SAFETY: Clear any old data
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceStatus('out');
      setAttendanceData(null); // 🔥 SAFETY: Clear any old data
    }
  };

  const fetchJourneyStatus = async () => {
    if (!user) return;

    try {
      // ✅ HOOK TO YOUR JOURNEY ENDPOINT
      const response = await fetch(`/api/journey/active/${user.id}`);
      const data = await response.json();

      if (data.success && data.hasActiveJourney) {
        setIsJourneyActive(true);
        setChatContext('journey_active');
      } else {
        setIsJourneyActive(false);
      }
    } catch (error) {
      console.error('Error fetching journey status:', error);
      setIsJourneyActive(false);
    }
  };

  const fetchDashboardStats = async () => {
    if (!user) return;

    try {
      // ✅ PARALLEL FETCH FROM MULTIPLE ENDPOINTS FOR COMPREHENSIVE STATS - UNCHANGED
      const [attendanceRes, journeyRes, reportsRes, tasksRes, dealersRes, leaveRes] = await Promise.all([
        fetch(`/api/attendance/recent?userId=${user.id}&limit=7`),
        fetch(`/api/journey/analytics/${user.id}?days=30`),
        fetch(`/api/dvr/recent?userId=${user.id}&limit=100`),
        fetch(`/api/tasks/recent?userId=${user.id}&limit=100`),
        fetch(`/api/dealers/recent?limit=1000`),
        fetch(`/api/leave/user/${user.id}?limit=50`)
      ]);

      const [attendanceData, journeyData, reportsData, tasksData, dealersData, leaveData] = await Promise.all([
        attendanceRes.json(),
        journeyRes.json(),
        reportsRes.json(),
        tasksData.json(),
        dealersRes.json(),
        leaveRes.json()
      ]);

      // 🔥 UPDATED: Get current active session info for more accurate stats
      let currentActiveSession = null;
      let todayCheckInTime = null;

      if (attendanceData.data && attendanceData.data.length > 0) {
        // Find today's active session (if any)
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = attendanceData.data.filter((session: any) =>
          session.attendanceDate === today
        );

        // Get active session (not punched out) or latest session for check-in time
        currentActiveSession = todaySessions.find((session: any) => !session.outTimeTimestamp);
        todayCheckInTime = currentActiveSession?.inTimeTimestamp ||
          (todaySessions.length > 0 ? todaySessions[0].inTimeTimestamp : null);
      }

      // Build comprehensive stats - MOSTLY UNCHANGED
      const stats: DashboardStats = {
        attendance: {
          isCheckedIn: attendanceStatus === 'in', // ✅ UNCHANGED - uses existing state
          checkInTime: todayCheckInTime, // 🔥 UPDATED - shows current/latest check-in time
          totalHours: calculateTotalHours(attendanceData.data || []), // ✅ UNCHANGED - function will handle multiple sessions
          weeklyHours: calculateWeeklyHours(attendanceData.data || []) // ✅ UNCHANGED - function will handle multiple sessions
        },
        journey: {
          isActive: isJourneyActive,
          totalDistance: journeyData.analytics?.totalDistance || '0 km',
          activeDuration: journeyData.analytics?.totalDuration || '0 minutes',
          dealerVisits: journeyData.analytics?.dealerVisits?.total || 0
        },
        reports: {
          dvrCount: reportsData.total || 0,
          tvrCount: 0, // Will fetch separately
          competitionCount: 0, // Will fetch separately
          pendingReports: 0
        },
        tasks: {
          pending: tasksData.data?.filter((t: any) => t.status === 'pending')?.length || 0,
          completed: tasksData.data?.filter((t: any) => t.status === 'completed')?.length || 0,
          overdue: tasksData.data?.filter((t: any) => isOverdue(t.dueDate))?.length || 0
        },
        dealers: {
          total: dealersData.total || 0,
          visited: calculateVisitedDealers(),
          pending: calculatePendingDealers()
        },
        leave: {
          pending: leaveData.data?.filter((l: any) => l.status === 'Pending')?.length || 0,
          approved: leaveData.data?.filter((l: any) => l.status === 'Approved')?.length || 0,
          remaining: calculateRemainingLeave(leaveData.data || [])
        }
      };

      setDashboardStats(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    try {
      // ✅ HOOK TO YOUR TASKS ENDPOINT
      const response = await fetch(`/api/tasks/recent?userId=${user.id}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setTasks(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const fetchDealers = async () => {
    if (!user) return;

    try {
      // ✅ HOOK TO YOUR DEALERS ENDPOINT
      const response = await fetch(`/api/dealers/recent?limit=100`);
      const data = await response.json();

      if (data.success) {
        setDealers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching dealers:', error);
      setDealers([]);
    }
  };

  const fetchRecentReports = async () => {
    if (!user) return;

    try {
      // ✅ HOOK TO MULTIPLE REPORT ENDPOINTS
      const [dvrRes, tvrRes, compRes] = await Promise.all([
        fetch(`/api/dvr/recent?userId=${user.id}&limit=10`),
        fetch(`/api/tvr/recent?userId=${user.id}&limit=10`),
        fetch(`/api/competition/recent?userId=${user.id}&limit=10`)
      ]);

      const [dvrData, tvrData, compData] = await Promise.all([
        dvrRes.json(),
        tvrRes.json(),
        compRes.json()
      ]);

      const allReports = [
        ...(dvrData.data || []).map((r: any) => ({ ...r, type: 'DVR' })),
        ...(tvrData.data || []).map((r: any) => ({ ...r, type: 'TVR' })),
        ...(compData.data || []).map((r: any) => ({ ...r, type: 'Competition' }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRecentReports(allReports);
    } catch (error) {
      console.error('Error fetching recent reports:', error);
      setRecentReports([]);
    }
  };

  const fetchLeaveApplications = async () => {
    if (!user) return;

    try {
      // ✅ HOOK TO YOUR LEAVE ENDPOINT
      const response = await fetch(`/api/leave/user/${user.id}?limit=10`);
      const data = await response.json();

      if (data.success) {
        setLeaveApplications(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching leave applications:', error);
      setLeaveApplications([]);
    }
  };

  // 🎯 SMART ATTENDANCE HANDLING
  const handleAttendancePunch = async () => {
    if (!user || !currentLocation) {
      addError('Location services required for attendance');
      return;
    }

    setIsLoading(true);
    try {
      if (attendanceStatus === 'out') {
        // ✅ PUNCH IN - UNCHANGED LOGIC
        const response = await fetch('/api/attendance/punch-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            locationName: 'Mobile App Check-in',
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            accuracy: 10,
            speed: 0,
            heading: 0,
            altitude: 0,
            imageUrl: null,
            imageCaptured: false
          })
        });

        const data = await response.json();
        if (data.success) {
          // ✅ SUCCESS: New punch-in recorded - UNCHANGED
          setAttendanceStatus('in');
          setAttendanceData(data.data);
          showSuccess('✅ Punched in successfully! Have a productive day!');
          await fetchDashboardStats();
        } else {
          // 🔥 UPDATED: Handle "already punched in" with better logic
          if (data.error && data.error.includes('Already punched in')) {
            // For multiple cycles: this means they have an ACTIVE session
            if (data.data) {
              setAttendanceData(data.data);
              setAttendanceStatus('in'); // They're currently punched in
              showSuccess('You are already punched in! Ready to punch out when done.');
            } else {
              setAttendanceStatus('in');
              showSuccess('You are already punched in! Ready to punch out when done.');
            }
          } else {
            addError(`Punch in failed: ${data.error || 'Unknown error'}`);
          }
        }
      } else {
        // ✅ PUNCH OUT - UNCHANGED LOGIC
        const response = await fetch('/api/attendance/punch-out', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            accuracy: 10,
            speed: 0,
            heading: 0,
            altitude: 0,
            imageUrl: null,
            imageCaptured: false
          })
        });

        const data = await response.json();
        if (data.success) {
          // ✅ SUCCESS: Punch-out recorded - UNCHANGED
          setAttendanceStatus('out');
          setAttendanceData(data.data);
          showSuccess('✅ Punched out successfully! Great work today!');
          await fetchDashboardStats();
        } else {
          // 🔥 UPDATED: Better error handling for multiple cycles
          if (data.error && data.error.includes('No punch-in record') ||
            data.error && data.error.includes('No active punch-in session')) {
            // For multiple cycles: no active session found
            setAttendanceStatus('out');
            addError('Please punch in first before punching out.');
          } else {
            addError(`Punch out failed: ${data.error || 'Unknown error'}`);
          }
        }
      }
    } catch (error) {
      console.error('Error with attendance:', error);
      addError('Failed to update attendance');
    } finally {
      setIsLoading(false);
    }
  };
  // 🗺️ SMART JOURNEY HANDLING
  const handleStartJourney = async () => {
    if (!user || !currentLocation) {
      addError('Location services required for journey tracking');
      return;
    }

    setIsLoading(true);
    try {
      // ✅ HOOK TO YOUR JOURNEY START ENDPOINT
      const response = await fetch('/api/journey/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          journeyType: 'field_visit',
          plannedDealers: [],
          siteName: 'Field Visit Journey',
          accuracy: 10,
          batteryLevel: await getBatteryLevel(),
          isCharging: await getChargingStatus(),
          networkStatus: navigator.onLine ? 'online' : 'offline',
          ipAddress: await getIPAddress(),
          description: 'Journey started from mobile dashboard',
          estimatedDuration: '8 hours',
          priority: 'medium'
        })
      });

      const data = await response.json();
      if (data.success) {
        setIsJourneyActive(true);
        setChatContext('journey_active');
        showSuccess('🚗 Journey started! GPS tracking is now active.');
        await fetchDashboardStats(); // Refresh stats
      } else {
        addError(`Journey start failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error starting journey:', error);
      addError('Failed to start journey');
    } finally {
      setIsLoading(false);
    }
  };

  // 🏢 SMART DEALER MANAGEMENT
  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      // ✅ HOOK TO YOUR DEALERS ENDPOINT WITH PROPER VALIDATION
      const response = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: dealerForm.type,
          name: dealerForm.name.trim(),
          region: dealerForm.region.trim(),
          area: dealerForm.area.trim(),
          phoneNo: dealerForm.phoneNo.trim(),
          address: dealerForm.address.trim(),
          totalPotential: parseFloat(dealerForm.totalPotential) || 0,
          bestPotential: parseFloat(dealerForm.bestPotential) || 0,
          brandSelling: dealerForm.brandSelling.filter(brand => brand.trim() !== ''),
          feedbacks: dealerForm.feedbacks.trim(),
          remarks: dealerForm.remarks.trim() || null
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowDealerForm(false);
        resetDealerForm();
        await fetchDealers();
        await fetchDashboardStats();
        showSuccess('🏢 Dealer added successfully!');
      } else {
        addError(`Failed to add dealer: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding dealer:', error);
      addError('Failed to add dealer');
    } finally {
      setIsLoading(false);
    }
  };

  // 🏖️ SMART LEAVE APPLICATION
  const handleLeaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      // Calculate total days automatically
      const startDate = new Date(leaveForm.startDate);
      const endDate = new Date(leaveForm.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // ✅ HOOK TO YOUR LEAVE ENDPOINT
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          leaveType: leaveForm.leaveType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason.trim(),
          totalDays: totalDays
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowLeaveForm(false);
        resetLeaveForm();
        await fetchLeaveApplications();
        await fetchDashboardStats();
        showSuccess('📝 Leave application submitted successfully!');
      } else {
        addError(`Failed to submit leave: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      addError('Failed to submit leave application');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ SMART TASK MANAGEMENT
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      // ✅ HOOK TO YOUR TASKS ENDPOINT
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          priority: taskForm.priority,
          dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
          assignedTo: taskForm.assignedTo || user.id,
          status: 'pending',
          taskType: 'general'
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowTaskForm(false);
        resetTaskForm();
        await fetchTasks();
        await fetchDashboardStats();
        showSuccess('✅ Task created successfully!');
      } else {
        addError(`Failed to create task: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      addError('Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔄 REFRESH DASHBOARD
  const refreshDashboard = async () => {
    setRefreshing(true);
    await fetchAllDashboardData();
    showSuccess('📊 Dashboard refreshed!');
  };

  // 🎨 UTILITY FUNCTIONS
  const addError = (error: string) => {
    setErrors(prev => [...prev, error]);
    setTimeout(() => {
      setErrors(prev => prev.slice(1));
    }, 5000);
  };

  const showSuccess = (message: string) => {
    // You can implement a success toast here
    console.log('Success:', message);
  };

  const resetDealerForm = () => {
    setDealerForm({
      name: '', type: 'Dealer', region: '', area: '', phoneNo: '', address: '',
      totalPotential: '', bestPotential: '', brandSelling: [''], feedbacks: '', remarks: ''
    });
  };

  const resetLeaveForm = () => {
    setLeaveForm({
      leaveType: '', startDate: '', endDate: '', reason: '', totalDays: 1
    });
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '', description: '', priority: 'medium', dueDate: '', assignedTo: ''
    });
  };

  const addBrandField = () => {
    setDealerForm(prev => ({
      ...prev,
      brandSelling: [...prev.brandSelling, '']
    }));
  };

  const updateBrandField = (index: number, value: string) => {
    setDealerForm(prev => ({
      ...prev,
      brandSelling: prev.brandSelling.map((brand, i) => i === index ? value : brand)
    }));
  };

  const removeBrandField = (index: number) => {
    setDealerForm(prev => ({
      ...prev,
      brandSelling: prev.brandSelling.filter((_, i) => i !== index)
    }));
  };

  // Helper functions for calculations
  const calculateTotalHours = (attendanceData: any[]) => {
    return attendanceData.reduce((total, record) => {
      if (record.inTimeTimestamp && record.outTimeTimestamp) {
        const inTime = new Date(record.inTimeTimestamp);
        const outTime = new Date(record.outTimeTimestamp);
        return total + (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
      }
      return total;
    }, 0);
  };

  const calculateWeeklyHours = (attendanceData: any[]) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    return attendanceData
      .filter(record => new Date(record.attendanceDate) >= weekStart)
      .reduce((total, record) => {
        if (record.inTimeTimestamp && record.outTimeTimestamp) {
          const inTime = new Date(record.inTimeTimestamp);
          const outTime = new Date(record.outTimeTimestamp);
          return total + (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
        }
        return total;
      }, 0);
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const calculateVisitedDealers = () => {
    // This would need to be calculated based on recent DVR/TVR data
    return Math.floor(dealers.length * 0.7); // Placeholder
  };

  const calculatePendingDealers = () => {
    return dealers.length - calculateVisitedDealers();
  };

  const calculateRemainingLeave = (leaveData: any[]) => {
    const approvedDays = leaveData
      .filter(leave => leave.status === 'Approved')
      .reduce((total, leave) => total + (leave.totalDays || 0), 0);
    return Math.max(0, 21 - approvedDays); // Assuming 21 days annual leave
  };

  const getBatteryLevel = async (): Promise<number> => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      } catch {
        return 100;
      }
    }
    return 100;
  };

  const getChargingStatus = async (): Promise<boolean> => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return battery.charging;
      } catch {
        return false;
      }
    }
    return false;
  };

  const getIPAddress = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'Unknown';
    }
  };

  // 🎨 RENDER CONDITIONS
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium text-gray-700">Loading your CRM dashboard...</p>
            <p className="text-sm text-gray-500">Connecting to 56+ endpoints</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-lg font-medium text-red-700">User not found</p>
            <p className="text-sm text-gray-500">Please log in to access your dashboard</p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      {/* 🎨 ENHANCED HEADER WITH REAL-TIME STATUS */}
      <div className="bg-white shadow-lg border-b-2 border-blue-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              {refreshing && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                {user.firstName} {user.lastName}
                <Sparkles className="w-5 h-5 ml-2 text-yellow-500" />
              </h1>
              <p className="text-sm text-gray-600 flex items-center">
                {user.company.companyName}
                <Badge variant="outline" className="ml-2 text-xs">
                  {user.role}
                </Badge>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Real-time Status Badges */}
            {currentLocation && (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <MapPin className="w-3 h-3 mr-1" />
                GPS Active
              </Badge>
            )}

            {isJourneyActive && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                <Navigation className="w-3 h-3 mr-1" />
                Journey Active
              </Badge>
            )}

            <Badge variant={attendanceStatus === 'in' ? 'default' : 'outline'}
              className={attendanceStatus === 'in' ? 'bg-green-600' : 'border-red-300 text-red-600'}>
              {attendanceStatus === 'in' ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
              {attendanceStatus === 'in' ? 'Checked In' : 'Checked Out'}
            </Badge>

            <Button
              onClick={refreshDashboard}
              disabled={refreshing}
              size="sm"
              variant="outline"
              className="p-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="mt-4 space-y-2">
            {errors.map((error, index) => (
              <Alert key={index} className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </div>

      {/* 📊 MAIN DASHBOARD CONTENT */}
      <div className="flex-1 flex flex-col p-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* 🚀 MAIN ACTION GRID - BIGGER AND MORE ATTRACTIVE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                onClick={handleAttendancePunch}
                disabled={isLoading || attendanceStatus === null}
                className={`h-24 flex flex-col items-center justify-center space-y-2 text-white font-semibold ${attendanceStatus === 'in'
                  ? 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800'
                  : 'bg-gradient-to-br from-green-500 to-green-700 hover:from-green-600 hover:to-green-800'
                  }`}
              >
                {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : attendanceStatus === null ? (
                  <Loader2 className="w-8 h-8 animate-spin" /> // ✅ Show loading when null
                ) : attendanceStatus === 'in' ? (
                  <LogOut className="w-8 h-8" />
                ) : (
                  <LogIn className="w-8 h-8" />
                )}
                <span className="text-sm">
                  {attendanceStatus === null ? 'Loading...' : attendanceStatus === 'in' ? 'Punch Out' : 'Punch In'}
                </span>
              </Button>

              <Button
                onClick={handleStartJourney}
                disabled={isJourneyActive || isLoading}
                className="h-24 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white font-semibold disabled:bg-gray-400"
              >
                {isJourneyActive ? (
                  <>
                    <Navigation className="w-8 h-8" />
                    <span className="text-sm">Journey Active</span>
                  </>
                ) : (
                  <>
                    <Play className="w-8 h-8" />
                    <span className="text-sm">Start Journey</span>
                  </>
                )}
              </Button>

              <Button
                onClick={() => setChatContext('dvr')}
                className="h-24 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-semibold"
              >
                <FileText className="w-8 h-8" />
                <span className="text-sm">Create DVR</span>
              </Button>

              <Button
                onClick={() => setChatContext('tvr')}
                className="h-24 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-semibold"
              >
                <Zap className="w-8 h-8" />
                <span className="text-sm">Create TVR</span>
              </Button>
            </div>

            {/* 📊 COMPREHENSIVE STATS DASHBOARD */}
            {dashboardStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Attendance Stats */}
                <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-green-800 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Attendance Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-3xl font-bold ${dashboardStats.attendance.isCheckedIn ? 'text-green-600' : 'text-red-600'}`}>
                          {dashboardStats.attendance.isCheckedIn ? '✓' : '✗'}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {dashboardStats.attendance.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                          </div>
                          {dashboardStats.attendance.checkInTime && (
                            <div className="text-xs text-gray-600">
                              {new Date(dashboardStats.attendance.checkInTime).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        Weekly: {dashboardStats.attendance.weeklyHours.toFixed(1)}h
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Journey Stats */}
                <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-purple-800 flex items-center">
                      <Navigation className="w-4 h-4 mr-2" />
                      Journey Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-3xl font-bold ${dashboardStats.journey.isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                          {dashboardStats.journey.isActive ? '🚗' : '🏠'}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {dashboardStats.journey.isActive ? 'Active' : 'Inactive'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {dashboardStats.journey.totalDistance}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        Visits: {dashboardStats.journey.dealerVisits}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reports Stats */}
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-blue-800 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Reports This Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-blue-600">
                          {dashboardStats.reports.dvrCount + dashboardStats.reports.tvrCount + dashboardStats.reports.competitionCount}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium">Total Reports</div>
                          <div className="text-xs text-gray-600">
                            DVR: {dashboardStats.reports.dvrCount} | TVR: {dashboardStats.reports.tvrCount}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        Competition: {dashboardStats.reports.competitionCount}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tasks Stats */}
                <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-orange-800 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Tasks & Follow-ups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-orange-600">
                          {dashboardStats.tasks.pending}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium">Pending</div>
                          <div className="text-xs text-gray-600">
                            Completed: {dashboardStats.tasks.completed}
                          </div>
                        </div>
                      </div>
                      {dashboardStats.tasks.overdue > 0 && (
                        <div className="text-xs text-red-600 font-medium">
                          ⚠️ {dashboardStats.tasks.overdue} overdue
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 🎯 QUICK ACTION PANELS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Dealers Panel */}
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-orange-800 flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Dealers ({dealers.length})
                    </div>
                    <Button
                      onClick={() => setShowDealerForm(true)}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dealers.slice(0, 3).map((dealer) => (
                      <div key={dealer.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{dealer.name}</div>
                          <div className="text-xs text-gray-600">{dealer.region} - {dealer.area}</div>
                        </div>
                        <Badge variant={dealer.type === 'Dealer' ? 'default' : 'outline'}>
                          {dealer.type}
                        </Badge>
                      </div>
                    ))}
                    {dealers.length > 3 && (
                      <Button
                        onClick={() => setShowDealersList(true)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        View All {dealers.length} Dealers
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Reports Panel */}
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-blue-800 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Recent Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentReports.slice(0, 3).map((report, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{report.type}</div>
                          <div className="text-xs text-gray-600">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {report.checkOutTime ? 'Complete' : 'In Progress'}
                        </Badge>
                      </div>
                    ))}
                    <Button
                      onClick={() => setActiveTab('reports')}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      View All Reports
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Leave Panel */}
              <Card className="border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-purple-800 flex items-center justify-between">
                    <div className="flex items-center">
                      <CalendarDays className="w-5 h-5 mr-2" />
                      Leave Status
                    </div>
                    <Button
                      onClick={() => setShowLeaveForm(true)}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardStats && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Remaining</span>
                          <span className="font-bold text-purple-600">{dashboardStats.leave.remaining} days</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Pending</span>
                          <span className="font-medium text-orange-600">{dashboardStats.leave.pending}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Approved</span>
                          <span className="font-medium text-green-600">{dashboardStats.leave.approved}</span>
                        </div>
                      </>
                    )}
                    <Button
                      onClick={() => setShowLeaveForm(true)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Apply for Leave
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {/* Reports Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                onClick={() => setChatContext('dvr')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
              >
                <FileText className="w-8 h-8" />
                <span>Daily Visit Report</span>
                <span className="text-xs opacity-80">AI-Powered</span>
              </Button>

              <Button
                onClick={() => setChatContext('tvr')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white"
              >
                <Zap className="w-8 h-8" />
                <span>Technical Visit Report</span>
                <span className="text-xs opacity-80">Smart Generation</span>
              </Button>

              <Button
                onClick={() => setChatContext('competition')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white"
              >
                <TrendingUp className="w-8 h-8" />
                <span>Competition Report</span>
                <span className="text-xs opacity-80">Market Intelligence</span>
              </Button>
            </div>

            {/* Recent Reports List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Recent Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentReports.length > 0 ? (
                    recentReports.map((report, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">{report.type} Report</div>
                          <div className="text-sm text-gray-600">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </div>
                          {report.dealerName && (
                            <div className="text-sm text-blue-600">{report.dealerName}</div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={report.checkOutTime ? 'default' : 'outline'}>
                            {report.checkOutTime ? 'Complete' : 'In Progress'}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No reports yet</p>
                      <p className="text-sm">Start creating reports using the AI assistant</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Performance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardStats && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Weekly Hours</span>
                          <span>{dashboardStats.attendance.weeklyHours.toFixed(1)}h / 40h</span>
                        </div>
                        <Progress value={(dashboardStats.attendance.weeklyHours / 40) * 100} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Task Completion</span>
                          <span>{dashboardStats.tasks.completed} / {dashboardStats.tasks.completed + dashboardStats.tasks.pending}</span>
                        </div>
                        <Progress value={(dashboardStats.tasks.completed / (dashboardStats.tasks.completed + dashboardStats.tasks.pending || 1)) * 100} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Dealer Coverage</span>
                          <span>{dashboardStats.dealers.visited} / {dashboardStats.dealers.total}</span>
                        </div>
                        <Progress value={(dashboardStats.dealers.visited / (dashboardStats.dealers.total || 1)) * 100} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <PieChart className="w-5 h-5 mr-2" />
                    Activity Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                        <span className="text-sm">DVR Reports</span>
                      </div>
                      <span className="font-medium">{dashboardStats?.reports.dvrCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full mr-3"></div>
                        <span className="text-sm">TVR Reports</span>
                      </div>
                      <span className="font-medium">{dashboardStats?.reports.tvrCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="text-sm">Competition</span>
                      </div>
                      <span className="font-medium">{dashboardStats?.reports.competitionCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">Journey KM</span>
                      </div>
                      <span className="font-medium">{dashboardStats?.journey.totalDistance || '0 km'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            {/* Management Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Dealer Management
                    </div>
                    <Button
                      onClick={() => setShowDealerForm(true)}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Dealer
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Dealers</span>
                      <span className="font-bold">{dealers.length}</span>
                    </div>
                    <Button
                      onClick={() => setShowDealersList(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <List className="w-4 h-4 mr-2" />
                      View All Dealers
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Task Management
                    </div>
                    <Button
                      onClick={() => setShowTaskForm(true)}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Pending Tasks</span>
                      <span className="font-bold text-orange-600">{tasks.filter(t => t.status === 'pending').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span className="font-bold text-green-600">{tasks.filter(t => t.status === 'completed').length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* 🗺️ JOURNEY TRACKER COMPONENT */}
        {isJourneyActive && (
          <JourneyTracker
            userId={user.id}
            onJourneyEnd={() => {
              setIsJourneyActive(false);
              setChatContext('dashboard');
              fetchDashboardStats();
            }}
          />
        )}
      </div>

      {/* 🎨 MODALS AND DIALOGS */}

      {/* Dealer Form Dialog */}
      <Dialog open={showDealerForm} onOpenChange={setShowDealerForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Dealer</DialogTitle>
            <DialogDescription>
              Fill in the dealer information. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDealer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Dealer Name *</Label>
                <Input
                  id="name"
                  value={dealerForm.name}
                  onChange={(e) => setDealerForm({ ...dealerForm, name: e.target.value })}
                  required
                  maxLength={255}
                  placeholder="Enter dealer name"
                />
              </div>
              <div>
                <Label htmlFor="type">Dealer Type *</Label>
                <Select value={dealerForm.type} onValueChange={(value) => setDealerForm({ ...dealerForm, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dealer">Dealer</SelectItem>
                    <SelectItem value="Sub Dealer">Sub Dealer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="region">Region *</Label>
                <Input
                  id="region"
                  value={dealerForm.region}
                  onChange={(e) => setDealerForm({ ...dealerForm, region: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="Enter region"
                />
              </div>
              <div>
                <Label htmlFor="area">Area *</Label>
                <Input
                  id="area"
                  value={dealerForm.area}
                  onChange={(e) => setDealerForm({ ...dealerForm, area: e.target.value })}
                  required
                  maxLength={255}
                  placeholder="Enter area"
                />
              </div>
              <div>
                <Label htmlFor="phoneNo">Phone Number *</Label>
                <Input
                  id="phoneNo"
                  value={dealerForm.phoneNo}
                  onChange={(e) => setDealerForm({ ...dealerForm, phoneNo: e.target.value })}
                  required
                  maxLength={20}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="totalPotential">Total Potential (₹) *</Label>
                <Input
                  id="totalPotential"
                  type="number"
                  step="0.01"
                  min="0"
                  value={dealerForm.totalPotential}
                  onChange={(e) => setDealerForm({ ...dealerForm, totalPotential: e.target.value })}
                  required
                  placeholder="Enter total potential"
                />
              </div>
              <div>
                <Label htmlFor="bestPotential">Best Potential (₹) *</Label>
                <Input
                  id="bestPotential"
                  type="number"
                  step="0.01"
                  min="0"
                  value={dealerForm.bestPotential}
                  onChange={(e) => setDealerForm({ ...dealerForm, bestPotential: e.target.value })}
                  required
                  placeholder="Enter best potential"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={dealerForm.address}
                onChange={(e) => setDealerForm({ ...dealerForm, address: e.target.value })}
                required
                maxLength={500}
                placeholder="Enter complete address"
                rows={3}
              />
            </div>

            <div>
              <Label>Brands Selling *</Label>
              {dealerForm.brandSelling.map((brand, index) => (
                <div key={index} className="flex space-x-2 mt-2">
                  <Input
                    value={brand}
                    onChange={(e) => updateBrandField(index, e.target.value)}
                    placeholder="Brand name"
                    required={index === 0}
                  />
                  {dealerForm.brandSelling.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeBrandField(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addBrandField} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Add Brand
              </Button>
            </div>

            <div>
              <Label htmlFor="feedbacks">Feedbacks *</Label>
              <Textarea
                id="feedbacks"
                value={dealerForm.feedbacks}
                onChange={(e) => setDealerForm({ ...dealerForm, feedbacks: e.target.value })}
                required
                maxLength={500}
                placeholder="Enter dealer feedbacks"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={dealerForm.remarks}
                onChange={(e) => setDealerForm({ ...dealerForm, remarks: e.target.value })}
                maxLength={500}
                placeholder="Additional remarks (optional)"
                rows={2}
              />
            </div>

            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding Dealer...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Dealer
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDealerForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dealers List Dialog */}
      <Dialog open={showDealersList} onOpenChange={setShowDealersList}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Dealers ({dealers.length})</DialogTitle>
            <DialogDescription>
              Manage your dealer database
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dealers.length > 0 ? (
              <div className="grid gap-4">
                {dealers.map((dealer) => (
                  <Card key={dealer.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg">{dealer.name}</h3>
                          <Badge variant={dealer.type === 'Dealer' ? 'default' : 'outline'}>
                            {dealer.type}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {dealer.region} - {dealer.area}
                          </div>
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            {dealer.phoneNo}
                          </div>
                          <div className="flex items-center">
                            <DollarSign className="w-4 h-4 mr-1" />
                            Total: ₹{dealer.totalPotential}
                          </div>
                          <div className="flex items-center">
                            <Target className="w-4 h-4 mr-1" />
                            Best: ₹{dealer.bestPotential}
                          </div>
                        </div>
                        <div className="text-sm">
                          <strong>Brands:</strong> {dealer.brandSelling.join(', ')}
                        </div>
                        <div className="text-sm">
                          <strong>Address:</strong> {dealer.address}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button size="sm" variant="outline">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No dealers found</p>
                <p className="text-sm">Start by adding your first dealer</p>
                <Button
                  onClick={() => {
                    setShowDealersList(false);
                    setShowDealerForm(true);
                  }}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Dealer
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Form Dialog */}
      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Submit your leave application for approval
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLeaveApplication} className="space-y-4">
            <div>
              <Label htmlFor="leaveType">Leave Type *</Label>
              <Select value={leaveForm.leaveType} onValueChange={(value) => setLeaveForm({ ...leaveForm, leaveType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sick">Sick Leave</SelectItem>
                  <SelectItem value="Casual">Casual Leave</SelectItem>
                  <SelectItem value="Earned">Earned Leave</SelectItem>
                  <SelectItem value="Emergency">Emergency Leave</SelectItem>
                  <SelectItem value="Personal">Personal Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  required
                  min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Please provide reason for leave"
                required
                rows={3}
              />
            </div>

            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowLeaveForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Form Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task or follow-up
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Task Title *</Label>
              <Input
                id="taskTitle"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
                placeholder="Enter task title"
              />
            </div>

            <div>
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Task description (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 🎨 FIXED CHAT INTERFACE AT BOTTOM */}
      <ChatInterface
        context={chatContext}
        currentLocation={currentLocation}
        userId={user.id}
        onContextChange={setChatContext}
      />
    </div>
  );
}