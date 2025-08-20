import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Radar, Settings, Store, CheckCircle,
  MapPin, Pause, Play, Square, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

/* -------------------------------------------------------------------------- */
/*                              Smart Wake Lock                               */
/* -------------------------------------------------------------------------- */
class SmartWakeLock {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean;
  private listeners: ((isActive: boolean) => void)[] = [];
  private releaseTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.isSupported = 'wakeLock' in navigator;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.scheduleRelease('app_backgrounded', 30000);
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
    this.releaseTimeout = setTimeout(() => this.releaseWakeLock(reason), delay);
  }

  private clearScheduledRelease() {
    if (this.releaseTimeout) {
      clearTimeout(this.releaseTimeout);
      this.releaseTimeout = null;
    }
  }

  async requestWakeLock(reason: string = 'journey_active'): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      this.clearScheduledRelease();
      if (this.wakeLock) await this.releaseWakeLock('replacing_lock');
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      document.body.dataset.journeyActive = 'true';
      this.wakeLock.addEventListener('release', () => {
        document.body.dataset.journeyActive = 'false';
        this.notifyListeners(false);
      });
      this.notifyListeners(true);
      return true;
    } catch {
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
        this.notifyListeners(false);
      } catch {}
    }
  }

  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }

  onStateChange(callback: (isActive: boolean) => void) {
    this.listeners.push(callback);
  }

  private notifyListeners(isActive: boolean) {
    this.listeners.forEach(cb => cb(isActive));
  }
}

/* -------------------------------------------------------------------------- */
/*                                Interfaces                                  */
/* -------------------------------------------------------------------------- */
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
  mode: 'car' | 'walking' | 'bike';
}

interface DealerCheckIn {
  id: string;
  dealerName: string;
  checkInTime: string;
  location: string;
  validated: boolean;
}

interface ApproachAlert {
  isApproaching: boolean;
  dealerName?: string;
  distance?: number;
}

/* -------------------------------------------------------------------------- */
/*                            Journey Tracker UI                              */
/* -------------------------------------------------------------------------- */
export default function JourneyTracker({ userId, onBack, onJourneyEnd }: JourneyTrackerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeJourney, setActiveJourney] = useState<JourneyData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [radarTripId, setRadarTripId] = useState<string | null>(null);
  const [dealerCheckins, setDealerCheckins] = useState<DealerCheckIn[]>([]);
  const [approachAlert, setApproachAlert] = useState<ApproachAlert>({ isApproaching: false });
  const [wakeLockManager] = useState(() => new SmartWakeLock());
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const { toast } = useToast();
  const locationWatchId = useRef<number | null>(null);

  /* ------------------------------ Init WakeLock ---------------------------- */
  useEffect(() => {
    wakeLockManager.onStateChange((isActive) => setWakeLockActive(isActive));
    return () => { wakeLockManager.releaseWakeLock('component_unmount'); };
  }, [wakeLockManager]);

  /* ----------------------------- Init Tracker ------------------------------ */
  useEffect(() => {
    initializeTracker();
    return () => {
      if (locationWatchId.current) navigator.geolocation.clearWatch(locationWatchId.current);
      wakeLockManager.releaseWakeLock('cleanup');
    };
  }, [userId]);

  const initializeTracker = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/radar/publishable-key'); // validate key
      await getCurrentLocation();
    } finally { setIsLoading(false); }
  };

  /* -------------------------- Location & Tracking -------------------------- */
  const getCurrentLocation = () => {
    return new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation unavailable')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0,
            altitude: pos.coords.altitude || 0,
            timestamp: new Date().toISOString()
          });
          resolve();
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const startTracking = useCallback(() => {
    if (locationWatchId.current) navigator.geolocation.clearWatch(locationWatchId.current);
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc: LocationData = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0,
          altitude: pos.coords.altitude || 0,
          timestamp: new Date().toISOString()
        };
        setCurrentLocation(loc);
        await fetch('/api/radar/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, latitude: loc.lat, longitude: loc.lng, tripId: radarTripId })
        });
        await checkRadarContext(loc);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
    locationWatchId.current = id;
  }, [radarTripId]);

  /* ---------------------------- Radar Context ------------------------------ */
  const checkRadarContext = async (loc: LocationData) => {
    try {
      const resp = await fetch(`/api/radar/context?latitude=${loc.lat}&longitude=${loc.lng}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.geofences?.length) {
          const dealerFence = data.geofences.find((g: any) => g.metadata?.dealerName);
          if (dealerFence) {
            setApproachAlert({ isApproaching: true, dealerName: dealerFence.metadata.dealerName, distance: dealerFence.distance });
          } else setApproachAlert({ isApproaching: false });
        }
      }
    } catch {}
  };

  /* ---------------------------- Dealer Check-in ---------------------------- */
  const handleDealerCheckIn = async (dealerName: string) => {
    if (!currentLocation || !activeJourney) return;
    try {
      const resp = await fetch('/api/daily-visit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dealerName,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          journeyId: activeJourney.id
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        setDealerCheckins([...dealerCheckins, {
          id: data.id, dealerName, checkInTime: new Date().toISOString(),
          location: `${currentLocation.lat},${currentLocation.lng}`, validated: true
        }]);
        toast({ title: `Checked into ${dealerName}`, duration: 2000 });
      }
    } catch {}
  };

  /* ---------------------------- Journey Actions ---------------------------- */
  const handleStartJourney = async () => {
    if (!currentLocation) return;
    setIsLoading(true);
    try {
      const journeyId = `journey_${userId}_${Date.now()}`;
      const radarResp = await fetch('/api/radar/journey/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.toString(), mode: 'car', metadata: { journeyId } })
      });
      const tripData = await radarResp.json();
      setRadarTripId(tripData.trip?.externalId || journeyId);
      setActiveJourney({
        id: journeyId, tripId: tripData.trip?.externalId || journeyId,
        startTime: new Date().toISOString(), duration: '0m', totalDistance: '0 km',
        trackingPoints: 0, activeCheckins: 0, status: 'active', mode: 'car'
      });
      startTracking();
      await wakeLockManager.requestWakeLock('start_journey');
    } finally { setIsLoading(false); }
  };

  const handlePauseResumeJourney = async () => {
    if (!activeJourney || !radarTripId) return;
    const isActive = activeJourney.status === 'active';
    await fetch(`/api/radar/journey/${radarTripId}/${isActive ? 'cancel' : 'start'}`, { method: 'PUT' });
    setActiveJourney({ ...activeJourney, status: isActive ? 'paused' : 'active' });
  };

  const handleEndJourney = async () => {
    if (!activeJourney || !radarTripId) return;
    await fetch(`/api/radar/journey/${radarTripId}/complete`, { method: 'PUT' });
    setActiveJourney(null);
    setRadarTripId(null);
    onJourneyEnd();
    await wakeLockManager.releaseWakeLock('end_journey');
  };

  /* ----------------------------- Rendering UI ------------------------------ */
  if (isLoading && !activeJourney) {
    return (
      <motion.div className="h-full flex items-center justify-center">
        <Radar className="w-10 h-10 mx-auto mb-4" />
        <p>Initializing...</p>
        <Progress value={33} />
      </motion.div>
    );
  }

  return (
    <motion.div className="h-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col">
      {/* HEADER */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-lg border-b p-4 flex justify-between">
        <div className="flex items-center space-x-3">
          {onBack && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /></Button>}
          <Avatar><AvatarFallback><Radar /></AvatarFallback></Avatar>
          <h1 className="font-bold">Journey Tracker</h1>
        </div>
        <div className="flex items-center space-x-2">
          {wakeLockActive && <span className="text-blue-600 text-xs">Screen Lock</span>}
          <Button variant="ghost" size="sm"><Settings /></Button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!activeJourney ? (
          <Button onClick={handleStartJourney} className="w-full h-16 bg-gradient-to-r from-blue-600 to-pink-600 text-white">Start Journey</Button>
        ) : (
          <div className="space-y-4">
            <Card><CardContent>
              <p>Active Journey: {activeJourney.id}</p>
              <p>Status: {activeJourney.status}</p>
            </CardContent></Card>
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handlePauseResumeJourney} className="bg-orange-500 text-white">{activeJourney.status === 'active' ? 'Pause' : 'Resume'}</Button>
              <Button onClick={handleEndJourney} className="bg-red-500 text-white">End Journey</Button>
            </div>

            {/* Approach Alert */}
            {approachAlert.isApproaching && (
              <Card><CardContent className="flex items-center space-x-2">
                <AlertTriangle className="text-yellow-500" />
                <span>Approaching {approachAlert.dealerName}</span>
                <Button size="sm" onClick={() => handleDealerCheckIn(approachAlert.dealerName!)}>Check In</Button>
              </CardContent></Card>
            )}

            {/* Dealer Check-ins */}
            {dealerCheckins.length > 0 && (
              <Card><CardContent>
                <h2 className="font-bold mb-2 flex items-center"><Store className="mr-2" /> Dealer Visits</h2>
                {dealerCheckins.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-1">
                    <span>{d.dealerName}</span>
                    <CheckCircle className="text-green-500" />
                  </div>
                ))}
              </CardContent></Card>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
