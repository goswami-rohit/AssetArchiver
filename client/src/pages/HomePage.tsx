import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from "wouter";
import { toast } from 'sonner';
import { Loader2, LogIn, LogOut, Plus, CalendarSearch, ChevronRight } from 'lucide-react';

// --- Reusable Web Components ---
import AppHeader from '@/components/AppHeader';
import LiquidGlassCard from '@/components/LiquidGlassCard';
import PJPFloatingCard from '@/components/PJPFloatingCard';

// --- Form Components ---
import AttendanceInForm from '@/pages/forms/AttendanceInForm';
import AttendanceOutForm from '@/pages/forms/AttendanceOutForm';

// --- UI Libraries ---
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL, fetchUserById, PJP_STATUS } from '../components/ReusableUI';

// --- Type Definitions ---
type PJP = {
  id: string;
  areaToBeVisited: string;
  status: string;
  planDate: string;
  [key: string]: any;
};

type Dealer = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

// --- Component ---
export default function HomePage() {
  const [, navigate] = useLocation();
  const { user, setUser, attendanceStatus, setAttendanceStatus } = useAppStore();

  const [isAttendanceModalVisible, setIsAttendanceModalVisible] = useState(false);
  const [attendanceFormType, setAttendanceFormType] = useState<'in' | 'out' | '' | null>(null);
  const [todayPJPs, setTodayPJPs] = useState<PJP[]>([]);
  const [isLoadingPJPs, setIsLoadingPJPs] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true); // New loading state

  // --- User data fetching ---
  useEffect(() => {
    if (user) return;
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      const userId = parseInt(storedUserId);
      if (!isNaN(userId)) {
        fetchUserById(userId)
          .then(userData => setUser(userData))
          .catch(e => {
            console.error("Failed to fetch user data:", e);
            localStorage.clear();
            navigate('/login');
          });
      }
    } else {
      navigate('/login');
    }
  }, [user, setUser, navigate]);

  // --- NEW: Fetch real-time attendance status from the database ---
  useEffect(() => {
    if (!user?.id) return;

    const checkAttendanceStatus = async () => {
      setIsLoadingAttendance(true);
      try {
        const response = await fetch(`${BASE_URL}/api/attendance/user/${user.id}/today`);

        if (response.ok) {
          const result = await response.json();
          const attendanceRecord = result.data;

          if (attendanceRecord && !attendanceRecord.outTimeTimestamp) {
            setAttendanceStatus('in');
          } else if (attendanceRecord && attendanceRecord.outTimeTimestamp) {
            setAttendanceStatus('out');
          }
        } else if (response.status === 404) {
          setAttendanceStatus(null);
        } else {
          throw new Error("Failed to fetch attendance status.");
        }
      } catch (error: any) {
        toast.error("Network Error", { description: "Could not verify attendance status." });
        setAttendanceStatus(null);
      } finally {
        setIsLoadingAttendance(false);
      }
    };

    checkAttendanceStatus();
  }, [user?.id, setAttendanceStatus]);

  // --- Fetch PJPs ---
  useEffect(() => {
    if (!user?.id) return;
    const fetchPJPs = async () => {
      setIsLoadingPJPs(true);
      try {
        const pjpUrl = `${BASE_URL}/api/pjp/user/${user.id}`;
        const pjpResponse = await fetch(pjpUrl);
        const pjpResult = await pjpResponse.json();
        if (pjpResponse.ok && pjpResult.success) {
          const pjps: PJP[] = pjpResult.data;
          const dealerIds = Array.from(new Set(pjps.map((p: PJP) => p.areaToBeVisited)));
          if (dealerIds.length > 0) {
            const dealerPromises = dealerIds.map(id =>
              fetch(`${BASE_URL}/api/dealers/${id}`).then(res => res.json())
            );
            const dealerResults = await Promise.all(dealerPromises);
            const dealersMap = new Map<string, Dealer>();
            dealerResults.forEach(res => {
              if (res.success) dealersMap.set(res.data.id, res.data);
            });

            // Only keep pending or active PJPs
            const filteredPjps = pjps.filter(
              (p) => p.status?.toLowerCase() === 'pending' || p.status?.toLowerCase() === 'active'
            );
            const enrichedPjps = filteredPjps.map((p: PJP) => ({
              ...p,
              dealerName: dealersMap.get(p.areaToBeVisited)?.name || 'Dealer Name',
              dealerAddress: dealersMap.get(p.areaToBeVisited)?.address || 'Location Name',
            }));
            setTodayPJPs(enrichedPjps);
          } else {
            setTodayPJPs([]);
          }
        } else {
          throw new Error(pjpResult.error || "Failed to fetch PJPs.");
        }
      } catch (e: any) {
        toast.error('Error fetching missions', { description: e.message });
      } finally {
        setIsLoadingPJPs(false);
      }
    };
    fetchPJPs();
  }, [user?.id]);

  // --- Handlers ---
  const handleAttendanceAction = useCallback((type: 'in' | 'out') => {
    setAttendanceFormType(type);
    setIsAttendanceModalVisible(true);
  }, []);

  const handleAttendanceSubmitted = useCallback(() => {
    // After submitting, immediately update the state for a responsive feel.
    // The next time the component loads, the useEffect will fetch the true state anyway.
    setAttendanceStatus(attendanceFormType === 'in' ? 'in' : 'out');
    setIsAttendanceModalVisible(false);
    setAttendanceFormType(null);
  }, [attendanceFormType, setAttendanceStatus]);

  const handleAttendanceCancelled = useCallback(() => {
    setIsAttendanceModalVisible(false);
    setAttendanceFormType(null);
  }, []);

  const getGreeting = (): string => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good Morning';
    }
    if (hour < 17) {
      return 'Good Afternoon';
    }
    return 'Good Evening';
  };

  const displayedPJPs = todayPJPs.slice(0, 10);
  const hasMorePJPs = todayPJPs.length > 10;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <AppHeader title="Home" />

      <div className="container mx-auto px-8 pt-8 pb-28 space-y-4">
        <LiquidGlassCard>
          <div className="text-center">
            <p className="font-semibold text-blue-300">{getGreeting()}</p>
            <h2 className="text-2xl font-bold mt-1">{`${user?.firstName || 'User'} ${user?.lastName || 'User'}`}</h2>
            <p className="text-sm text-gray-300">{user?.role || 'User Role'}</p>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard>
          <div className="flex justify-between gap-4">
            {/* UPDATED BUTTON LOGIC - handeled by data fetched from db directly */}
            <Button
              onClick={() => handleAttendanceAction('in')}
              disabled={isLoadingAttendance || attendanceStatus === 'in'}
              className="flex-1 bg-green-500/80 hover:bg-green-600 disabled:opacity-50 h-12"
            >
              {isLoadingAttendance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} Check In
            </Button>
            <Button
              onClick={() => handleAttendanceAction('out')}
              disabled={isLoadingAttendance || attendanceStatus !== 'in'}
              className="flex-1 bg-red-500/80 hover:bg-red-600 disabled:opacity-50 h-12"
            >
              {isLoadingAttendance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />} Check Out
            </Button>
          </div>
        </LiquidGlassCard>

        {/* --- No changes to the PJP section below --- */}
        <div>
          <LiquidGlassCard>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Today's Missions</h3>
              <Button size="icon" className="bg-blue-500/50 hover:bg-blue-500" onClick={() => navigate('/pjp-form')}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </LiquidGlassCard>

          {isLoadingPJPs ? (
            <LiquidGlassCard>
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
                <p className="mt-4 text-sm text-gray-300">Loading missions...</p>
              </div>
            </LiquidGlassCard>
          ) : todayPJPs.length > 0 ? (
            <>
              <div className="space-y-4">
                {displayedPJPs.map((pjp) => (
                  <LiquidGlassCard key={pjp.id} onPress={() => navigate('/journey', { state: { selectedPJP: pjp } })}>
                    <PJPFloatingCard pjp={pjp} />
                  </LiquidGlassCard>
                ))}
              </div>
              {hasMorePJPs && (
                <LiquidGlassCard onPress={() => navigate('/pjp-list')}>
                  <div className="flex items-center justify-between font-semibold text-blue-300 p-2">
                    <p>Show More ({todayPJPs.length - displayedPJPs.length})</p>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </LiquidGlassCard>
              )}
            </>
          ) : (
            <LiquidGlassCard>
              <div className="text-center py-10">
                <CalendarSearch className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 mb-4 text-sm text-gray-300">No missions planned.</p>
                <Button className="bg-blue-500/80 hover:bg-blue-600" onClick={() => navigate('/pjp-form')}>Plan a New Mission</Button>
              </div>
            </LiquidGlassCard>
          )}
        </div>
      </div>

      <Dialog open={isAttendanceModalVisible} onOpenChange={setIsAttendanceModalVisible}>
        <DialogContent className="bg-gray-900/80 backdrop-blur-xl border-white/20 text-white p-0">
          {attendanceFormType === 'in' && user?.id && <AttendanceInForm userId={user.id} onSubmitted={handleAttendanceSubmitted} onCancel={handleAttendanceCancelled} />}
          {attendanceFormType === 'out' && user?.id && <AttendanceOutForm userId={user.id} onSubmitted={handleAttendanceSubmitted} onCancel={handleAttendanceCancelled} />}
        </DialogContent>
      </Dialog>
      <Toaster theme="dark" />
    </div>
  );
}