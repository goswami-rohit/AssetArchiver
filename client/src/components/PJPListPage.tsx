import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, CalendarX, Menu, Bell } from 'lucide-react';

// --- UI Components ---
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import PJPFloatingCard from '@/components/PJPFloatingCard'; 
import LiquidGlassCard from '@/components/LiquidGlassCard'; 

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL } from '@/components/ReusableUI';

// --- Type Definitions ---
// Re-defining PJP type locally for clarity
type PJP = {
  id: string;
  [key: string]: any; // for other potential properties
};

// --- A simple header placeholder ---
const AppHeader = ({ title }: { title: string }) => (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-gray-900/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-bold text-white truncate">{title}</h1>
         <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => console.log('Notifications clicked')} 
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-5 w-5" />
            <span className="sr-only">View notifications</span>
          </Button>
      </div>
    </header>
);

// --- Component ---
export default function PJPListPage() {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { date } = (location.state as { date?: string }) || {};

  const [pjps, setPjps] = useState<PJP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setError("User not authenticated.");
      setIsLoading(false);
      return;
    }

    const fetchPJPs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const targetDate = date ? new Date(date) : new Date();
        const formattedDate = format(targetDate, 'yyyy-MM-dd');

        const url = `${BASE_URL}/api/pjp/user/${user.id}?startDate=${formattedDate}&endDate=${formattedDate}`;
        const response = await fetch(url);
        const result = await response.json();

        if (response.ok && result.success) {
          setPjps(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch PJPs.");
        }
      } catch (e: any) {
        setError(e.message);
        toast.error('Error fetching missions', { description: e.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPJPs();
  }, [user?.id, date]);

  const handleCardPress = (pjp: PJP) => {
    navigate('/journey', { state: { selectedPJP: pjp } });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-gray-300">Loading missions...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <CalendarX className="h-12 w-12 text-red-400" />
            <p className="mt-4 text-red-400">Error: {error}</p>
        </div>
      );
    }
    if (pjps.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <CalendarX className="h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-300">No missions found for this day.</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {pjps.map((pjp) => (
            <LiquidGlassCard key={pjp.id} onPress={() => handleCardPress(pjp)}>
                <PJPFloatingCard
                    pjp={pjp}
                    onCardPress={() => handleCardPress(pjp)}
                />
            </LiquidGlassCard>
        ))}
      </div>
    );
  };

  const displayDate = date ? format(new Date(date), 'PPP') : format(new Date(), 'PPP');

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white bg-cover bg-center" style={{backgroundImage: "url('https://placehold.co/1080x1920/000000/FFFFFF?text=Mobile+Background')"}}>
      <AppHeader title={`Missions for ${displayDate}`} />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-4">
            {renderContent()}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

