import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, Square, MapPin, Clock } from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
  onJourneyEnd: () => void;
}

export default function JourneyTracker({ userId, onJourneyEnd }: JourneyTrackerProps) {
  const [journeyData, setJourneyData] = useState({
    startTime: new Date(),
    distance: 0,
    currentSpeed: 0,
    visitCount: 0
  });
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    // Start journey tracking
    startJourneyTracking();
    
    // Setup location tracking interval
    const trackingInterval = setInterval(() => {
      trackCurrentLocation();
    }, 30000); // Track every 30 seconds

    return () => clearInterval(trackingInterval);
  }, []);

  const startJourneyTracking = async () => {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const response = await fetch('/api/journey/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          });

          const data = await response.json();
          if (data.sessionId) {
            setSessionId(data.sessionId);
          }
        });
      }
    } catch (error) {
      console.error('Error starting journey:', error);
    }
  };

  const trackCurrentLocation = async () => {
    if (navigator.geolocation && sessionId) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          await fetch('/api/journey/track', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              sessionId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              speed: position.coords.speed || 0
            })
          });

          // Update local state
          setJourneyData(prev => ({
            ...prev,
            currentSpeed: position.coords.speed || 0
          }));
        } catch (error) {
          console.error('Error tracking location:', error);
        }
      });
    }
  };

  const endJourney = async () => {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const response = await fetch('/api/journey/end', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              sessionId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          });

          const data = await response.json();
          if (data.success) {
            onJourneyEnd();
          }
        });
      }
    } catch (error) {
      console.error('Error ending journey:', error);
    }
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            <span>Journey in Progress</span>
          </CardTitle>
          <Badge className="bg-blue-600">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatDuration(journeyData.startTime)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              <Clock className="w-3 h-3 mr-1" />
              Duration
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{journeyData.distance.toFixed(1)} km</div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              <MapPin className="w-3 h-3 mr-1" />
              Distance
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{journeyData.currentSpeed.toFixed(0)} km/h</div>
            <div className="text-sm text-gray-600">Current Speed</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{journeyData.visitCount}</div>
            <div className="text-sm text-gray-600">Visits</div>
          </div>
        </div>
        
        <Button 
          onClick={endJourney}
          variant="destructive"
          className="w-full"
        >
          <Square className="w-4 h-4 mr-2" />
          End Journey
        </Button>
      </CardContent>
    </Card>
  );
}