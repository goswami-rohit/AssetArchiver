import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from "wouter";
import { toast } from 'sonner';
import {
  FileText, Store, Map, CheckCircle, User, Trophy, Clock,
  ClipboardList, Package, LogOut, Target, Briefcase, Loader2
} from 'lucide-react';

// --- Reusable Web Components ---
import AppHeader from '@/components/AppHeader';
import LiquidGlassCard from '@/components/LiquidGlassCard';

// --- UI Libraries ---
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// --- Custom Hooks & Constants ---
import { useAppStore, fetchUserById, BASE_URL } from '../components/ReusableUI';

// --- Type Definitions ---
type IconName = keyof typeof iconMap;
const iconMap = {
  FileText, Store, Map, CheckCircle, User, Trophy, Clock, Target,
  ClipboardList, Package, Briefcase
};

// --- Sub-components for Profile Page ---
const StatTile: React.FC<{ iconName: IconName; value: string | number; label: string; color: string; isLoading: boolean; }> = ({ iconName, value, label, color, isLoading }) => {
  const Icon = iconMap[iconName] || FileText;
  return (
    <div className="w-[48%] mb-3">
      <LiquidGlassCard>
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full flex items-center justify-center mr-3" style={{ backgroundColor: color }}>
            {isLoading ? <Loader2 size={16} className="text-white animate-spin" /> : <Icon size={20} className="text-white" />}
          </div>
          <div className="flex-1">
            <p className="text-xl font-bold text-white">{isLoading ? '--' : value}</p>
            <p className="text-xs mt-1 text-gray-300">{label}</p>
          </div>
        </div>
      </LiquidGlassCard>
    </div>
  );
};

const ProgressBar: React.FC<{ progress: number; color: string; }> = ({ progress, color }) => (
  <div className="h-2 rounded-lg overflow-hidden bg-white/20">
    <div className="h-full rounded-lg" style={{ width: `${progress}%`, backgroundColor: color }} />
  </div>
);

const ActionButton: React.FC<{ icon: IconName; title: string; onPress: () => void; color: string; }> = ({ icon, title, onPress, color }) => {
  const Icon = iconMap[icon] || ClipboardList;
  return (
    <div className="flex-1">
      <LiquidGlassCard onPress={onPress}>
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
            <Icon size={22} className="text-white" />
          </div>
          <p className="text-xs font-bold text-white">{title}</p>
        </div>
      </LiquidGlassCard>
    </div>
  );
};

// --- Main Profile Page Component ---
export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, setData, reports, dealers, pjps, dailyTasks, dashboardStats, userTargets, setUser } = useAppStore();
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // --- User data fetching ---
  useEffect(() => {
    if (!user?.id) {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        fetchUserById(Number(storedUserId))
          .then(fetched => fetched && setUser(fetched))
          .catch(err => {
            console.error('Failed to fetch user from storage', err);
            navigate('/login');
          });
      }
    }
  }, [user, setUser, navigate]);

  // --- ✅ NEW: Fetch all dashboard stats ---
  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      setIsLoadingStats(true);
      const today = new Date().toISOString().split('T')[0];

      // Helper function to fetch data and handle errors
      const safeFetch = (url: string) => fetch(url)
        .then(res => res.ok ? res.json() : Promise.resolve({ success: false, data: [] }))
        .then(result => result.success ? result.data : [])
        .catch(() => []);

      try {
        const [
          dealersData,
          completedPjps,
          completedTasks,
          dvrData,
          tvrData,
          competitionData
        ] = await Promise.all([
          safeFetch(`${BASE_URL}/api/dealers?userId=${user.id}`),
          safeFetch(`${BASE_URL}/api/pjp/user/${user.id}?status=complete`),
          safeFetch(`${BASE_URL}/api/daily-tasks/user/${user.id}?status=complete`),
          safeFetch(`${BASE_URL}/api/daily-visit-reports/user/${user.id}?startDate=${today}&endDate=${today}`),
          safeFetch(`${BASE_URL}/api/technical-visit-reports/user/${user.id}?startDate=${today}&endDate=${today}`),
          safeFetch(`${BASE_URL}/api/competition-reports/user/${user.id}?startDate=${today}&endDate=${today}`)
        ]);

        // Update the global store with the fetched data
        setData('dealers', dealersData);
        setData('pjps', completedPjps);
        setData('dailyTasks', completedTasks);
        setData('reports', [...dvrData, ...tvrData, ...competitionData]);

      } catch (error) {
        toast.error("Failed to load dashboard stats.");
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [user?.id, setData]);

  const handleLogout = useCallback(() => {
    toast("Are you sure you want to log out?", {
      action: {
        label: "Log Out",
        onClick: async () => {
          localStorage.clear();
          setUser(null);
          navigate('/login');
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => { },
      }
    });
  }, [navigate, setUser]);

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  const statsData = [
    { iconName: 'FileText' as IconName, value: (reports || []).length, label: 'Reports', color: '#3b82f6' },
    { iconName: 'Store' as IconName, value: (dealers || []).length, label: 'Dealers', color: '#10b981' },
    { iconName: 'Map' as IconName, value: (pjps || []).length, label: 'PJPs', color: '#f59e0b' },
    { iconName: 'CheckCircle' as IconName, value: (dailyTasks || []).filter((t: any) => t.status === 'Completed').length, label: 'Tasks Done', color: '#a855f7' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <AppHeader title="Profile" />

      <main className="flex-1">
        <div className="container mx-auto px-8 pt-8 pb-28 space-y-4">

          <LiquidGlassCard>
            <div className="flex flex-col items-center">
              <Avatar className="w-24 h-24 mb-4 bg-blue-500">
                <AvatarFallback className="text-3xl font-bold bg-blue-500 text-white">{initials}</AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold">{`${user?.firstName || 'User'} ${user?.lastName || 'User'}`}</h2>
              <p className="text-sm text-gray-300 mb-3">{user?.email ?? 'loading...'}</p>
              <div className="flex items-center px-4 py-2 rounded-full gap-2 bg-blue-500/30">
                <Briefcase size={16} className="text-blue-300" />
                <p className="text-xs font-semibold text-blue-300 tracking-wide">{user?.role ?? 'User Role'}</p>
              </div>
            </div>
          </LiquidGlassCard>

          <div className="flex flex-row flex-wrap justify-between">
            {statsData.map((stat) => <StatTile key={stat.label} {...stat} isLoading={isLoadingStats} />)}
          </div>

          <LiquidGlassCard>
            <div className="flex items-center mb-5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center mr-3 bg-yellow-500"><Trophy size={20} className="text-white" /></div>
              <h3 className="text-base font-bold tracking-wider">PERFORMANCE</h3>
            </div>
            {dashboardStats?.attendance && (
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2"><Clock size={16} className="text-gray-400" /><p className="text-sm">Attendance</p></div>
                <div className={`px-3 py-1 rounded-full ${dashboardStats.attendance.isPresent ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                  <p className={`text-xs font-bold tracking-wider ${dashboardStats.attendance.isPresent ? 'text-green-300' : 'text-red-300'}`}>
                    {dashboardStats.attendance.isPresent ? 'ACTIVE' : 'OFFLINE'}
                  </p>
                </div>
              </div>
            )}
            {(userTargets || []).map((target: any, index: number) => {
              const progress = Math.min(100, Math.round(((target.current ?? 0) / (target.target || 1)) * 100));
              const progressColor = progress >= 80 ? '#10b981' : progress >= 60 ? '#f59e0b' : '#ef4444';
              return (
                <div key={index} className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2"><Target size={16} className="text-gray-400" /><p className="text-sm">{target.label}</p></div>
                    <p className="text-xs text-gray-400">{target.current} / {target.target}</p>
                  </div>
                  <ProgressBar progress={progress} color={progressColor} />
                </div>
              );
            })}
          </LiquidGlassCard>

          <div className="flex justify-between gap-3">
            <ActionButton icon="ClipboardList" title="Apply for Leave" onPress={() => navigate('/leave-form')} color="#3b82f6" />
            <ActionButton icon="Package" title="Brand Mapping" onPress={() => toast.info("Brand Mapping Coming Soon!")} color="#10b981" />
          </div>

          <LiquidGlassCard>
            <Button onClick={handleLogout} variant="destructive" className="w-full h-12 bg-red-500/80 hover:bg-red-600">
              <LogOut className="mr-2 h-4 w-4" /> LOG OUT
            </Button>
          </LiquidGlassCard>
        </div>
      </main>

      <Toaster theme="dark" />
    </div>
  );
}