import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, MapPin, Clock, Navigation, Pause, Play } from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
  onJourneyEnd: () => void;
}

export default function JourneyTracker({ userId, onJourneyEnd }: JourneyTrackerProps) {
  const [isEnding, setIsEnding] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [journeyStats, setJourneyStats] = useState({
    duration: '00:00',
    distance: '0 km',
    waypoints: 0
  });
  const [activeJourneyId, setActiveJourneyId] = useState<number | null>(null);

  useEffect(() => {
    // Get current location and start tracking
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

    // Check for active journey
    checkActiveJourney();
    
    // Start location tracking interval
    const trackingInterval = setInterval(() => {
      if (isTracking) {
        trackLocation();
      }
    }, 30000); // Track every 30 seconds

    return () => clearInterval(trackingInterval);
  }, [userId, isTracking]);

  const checkActiveJourney = async () => {
    try {
      const response = await fetch(`/api/journey/active/${userId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setActiveJourneyId(data.data.id);
        setIsTracking(true);
        setJourneyStats({
          duration: data.data.duration || '00:00',
          distance: data.data.totalDistance || '0 km',
          waypoints: data.data.waypoints || 0
        });
      }
    } catch (error) {
      console.error('Error checking active journey:', error);
    }
  };

  const trackLocation = async () => {
    if (!currentLocation || !activeJourneyId) return;

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setCurrentLocation(newLocation);

          // Send location update to backend
          const response = await fetch('/api/journey/track', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              journeyId: activeJourneyId,
              latitude: newLocation.lat,
              longitude: newLocation.lng,
              accuracy: position.coords.accuracy,
              batteryLevel: 100, // You can get this from battery API if needed
              networkStatus: 'online'
            })
          });

          const data = await response.json();
          if (data.success) {
            // Update journey stats if provided
            if (data.data.stats) {
              setJourneyStats({
                duration: data.data.stats.duration || journeyStats.duration,
                distance: data.data.stats.totalDistance || journeyStats.distance,
                waypoints: data.data.stats.waypoints || journeyStats.waypoints
              });
            }
          }
        }
      );
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const handlePauseResume = () => {
    setIsTracking(!isTracking);
  };

  const handleEndJourney = async () => {
    setIsEnding(true);
    
    try {
      const response = await fetch('/api/journey/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId: activeJourneyId,
          endLatitude: currentLocation?.lat,
          endLongitude: currentLocation?.lng,
          journeyNotes: 'Journey completed via PWA',
          endTime: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onJourneyEnd();
        setIsTracking(false);
        setActiveJourneyId(null);
        alert(`Journey ended successfully!\nDuration: ${data.data.summary?.duration || journeyStats.duration}\nDistance: ${data.data.summary?.totalDistance || journeyStats.distance}`);
      } else {
        alert('Error ending journey: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error ending journey:', error);
      alert('Failed to end journey');
    } finally {
      setIsEnding(false);
    }
  };

  const handleDealerCheckIn = async () => {
    if (!currentLocation) {
      alert('Location not available');
      return;
    }

    try {
      const response = await fetch('/api/journey/dealer-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journeyId: activeJourneyId,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          dealerName: 'Quick Check-in',
          checkInTime: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Dealer check-in successful!');
      } else {
        alert('Error with dealer check-in: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error with dealer check-in:', error);
      alert('Failed to check in at dealer');
    }
  };

  return (
    <Card className="mb-6 border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-green-800 flex items-center justify-between">
          <div className="flex items-center">
            <Navigation className="w-4 h-4 mr-2" />
            Journey Active
          </div>
          <div className="flex items-center space-x-1">
            {isTracking && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
            <span className="text-xs">
              {isTracking ? 'Tracking' : 'Paused'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Journey Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-700">{journeyStats.duration}</div>
              <div className="text-xs text-green-600">Duration</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-700">{journeyStats.distance}</div>
              <div className="text-xs text-green-600">Distance</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-700">{journeyStats.waypoints}</div>
              <div className="text-xs text-green-600">Waypoints</div>
            </div>
          </div>

          {/* Current Location */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700">
              {isTracking ? 'Tracking your location...' : 'Location tracking paused'}
            </span>
            {currentLocation && (
              <span className="text-xs text-green-600">
                <MapPin className="w-3 h-3 inline mr-1" />
                {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handlePauseResume}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-100"
            >
              {isTracking ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              )}
            </Button>

            <Button
              onClick={handleDealerCheckIn}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-100"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Check-in
            </Button>
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