// JourneyTracker.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, MapPin, Clock } from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
  onJourneyEnd: () => void;
}

export default function JourneyTracker({ userId, onJourneyEnd }: JourneyTrackerProps) {
  const [isEnding, setIsEnding] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    // Get current location for journey end
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        }
      );
    }
  }, []);

  const handleEndJourney = async () => {
    setIsEnding(true);
    
    try {
      const response = await fetch('/api/journey/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng,
          journeyNotes: 'Journey completed via PWA'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onJourneyEnd();
        alert(`Journey ended! Duration: ${data.data.summary.duration}, Distance: ${data.data.summary.totalDistance}`);
      } else {
        alert('Error ending journey: ' + data.error);
      }
    } catch (error) {
      console.error('Error ending journey:', error);
      alert('Failed to end journey');
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <Card className="mb-6 border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-green-800 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Journey Active
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700">Tracking your location...</span>
            {currentLocation && (
              <span className="text-xs text-green-600">
                <MapPin className="w-3 h-3 inline mr-1" />
                {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </span>
            )}
          </div>
          
          <Button
            onClick={handleEndJourney}
            disabled={isEnding}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <Square className="w-4 h-4 mr-2" />
            {isEnding ? 'Ending Journey...' : 'End Journey'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}