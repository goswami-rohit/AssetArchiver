import React, { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, CalendarX, ArrowLeft } from 'lucide-react';

// --- Reusable Web Components ---
import AppHeader from '@/components/AppHeader';
import LiquidGlassCard from '@/components/LiquidGlassCard';
import PJPFloatingCard from '@/components/PJPFloatingCard';

// --- UI Libraries ---
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL } from '@/components/ReusableUI';

// --- Type Definitions ---
type PJP = {
  id: string;
  areaToBeVisited: string;
  [key: string]: any;
};

type Dealer = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export default function PJPListPage() {
  const [location, navigate] = useLocation();
  const { user } = useAppStore();

  const urlParams = new URLSearchParams(window.location.search);
  const date = urlParams.get('date');

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
        const pjpUrl = `${BASE_URL}/api/pjp/user/${user.id}?startDate=${formattedDate}&endDate=${formattedDate}`;
        const pjpResponse = await fetch(pjpUrl);
        const pjpResult = await pjpResponse.json();

        if (pjpResponse.ok && pjpResult.success) {
          const pjps = pjpResult.data;

          const dealerIds = Array.from(new Set(pjps.map((p: PJP) => p.areaToBeVisited)));

          if (dealerIds.length > 0) {
            const dealerPromises = dealerIds.map(id =>
              fetch(`${BASE_URL}/api/dealers/${id}`).then(res => res.json())
            );
            const dealerResults = await Promise.all(dealerPromises);

            const dealersMap = new Map<string, Dealer>();
            dealerResults.forEach(res => {
              if (res.success) {
                dealersMap.set(res.data.id, res.data);
              }
            });

            const enrichedPjps = pjps.map((p: PJP) => {
              const dealerInfo = dealersMap.get(p.areaToBeVisited);
              return {
                ...p,
                dealerName: dealerInfo?.name || 'Unknown Dealer',
                dealerAddress: dealerInfo?.address || 'Location TBD',
                dealerLatitude: dealerInfo?.latitude,
                dealerLongitude: dealerInfo?.longitude,
              };
            });
            setPjps(enrichedPjps);
          } else {
            setPjps([]);
          }
        } else {
          throw new Error(pjpResult.error || "Failed to fetch PJPs.");
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
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-gray-300">Loading missions...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarX className="h-12 w-12 text-red-400" />
          <p className="mt-4 text-red-400">Error: {error}</p>
        </div>
      );
    }
    if (pjps.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarX className="h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-300">No missions found for this day.</p>
          <Button onClick={() => navigate('/pjp-form')} className="mt-4">Plan a New Mission</Button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
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
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <AppHeader title={`Missions for ${displayDate}`} />
      <main className="flex-1 p-8 pb-28">
        {renderContent()}
      </main>
      <Toaster />
    </div>
  );
}