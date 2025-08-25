import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Play, 
  Square, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  MapPin,
  Clock,
  Trophy
} from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
}

interface Journey {
  externalId?: string;
  status?: string;
  meters: number;
  startedAt?: string;
  updatedAt?: string;
}

export default function SimpleJourneyTracker({ userId }: JourneyTrackerProps) {
  // Core state
  const [isActive, setIsActive] = useState(false);
  const [currentJourneyId, setCurrentJourneyId] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Wake lock
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  
  // Edit state
  const [editingJourney, setEditingJourney] = useState<string | null>(null);
  const [editDistance, setEditDistance] = useState('');

  // Wake lock management
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLock) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        lock.addEventListener('release', () => setWakeLock(null));
      } catch (err) {
        console.warn('Wake lock failed:', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
    }
  };

  // Journey functions
  const startJourney = async () => {
    setIsLoading(true);
    setError('');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch('/api/geo/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              mode: 'car'
            })
          });
          
          const data = await response.json();
          if (data.success) {
            setCurrentJourneyId(data.data.journeyId);
            setIsActive(true);
            setSuccess('Journey started!');
            await requestWakeLock();
          } else {
            setError(data.error || 'Failed to start journey');
          }
        } catch (err) {
          setError('Network error: Failed to start journey');
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        setError('Location access required to start journey');
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const endJourney = async () => {
    if (!currentJourneyId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/geo/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          journeyId: currentJourneyId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setIsActive(false);
        setCurrentJourneyId(null);
        setSuccess('Journey completed!');
        await releaseWakeLock();
        fetchJourneys();
      } else {
        setError(data.error || 'Failed to end journey');
      }
    } catch (err) {
      setError('Network error: Failed to end journey');
    } finally {
      setIsLoading(false);
    }
  };

  // CRUD functions
  const fetchJourneys = async () => {
    try {
      const response = await fetch(`/api/geo/list?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setJourneys(data.data.breakdown || []);
      }
    } catch (err) {
      console.error('Failed to fetch journeys:', err);
    }
  };

  const deleteJourney = async (journeyId: string) => {
    try {
      const response = await fetch('/api/geo/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId })
      });
      
      if (response.ok) {
        setSuccess('Journey deleted');
        fetchJourneys();
      }
    } catch (err) {
      setError('Failed to delete journey');
    }
  };

  const updateJourney = async (journeyId: string, newDistance: number) => {
    try {
      const response = await fetch('/api/geo/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId,
          totalDistanceTravelled: newDistance
        })
      });
      
      if (response.ok) {
        setSuccess('Journey updated');
        setEditingJourney(null);
        fetchJourneys();
      }
    } catch (err) {
      setError('Failed to update journey');
    }
  };

  // Utility functions
  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km < 1 ? `${meters.toFixed(0)}m` : `${km.toFixed(2)}km`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Fetch journeys on mount
  useEffect(() => {
    fetchJourneys();
  }, [userId]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Journey Tracker
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Simple tracking for your daily journeys
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg" data-testid="message-success">
          <p className="text-green-800 dark:text-green-200 text-center font-medium">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg" data-testid="message-error">
          <p className="text-red-800 dark:text-red-200 text-center font-medium">{error}</p>
        </div>
      )}

      {/* Main Action Buttons */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          {!isActive ? (
            <Button
              onClick={startJourney}
              disabled={isLoading}
              size="lg"
              className="w-full h-16 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl"
              data-testid="button-start-journey"
            >
              {isLoading ? (
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Starting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Play className="w-6 h-6" />
                  <span>Start Journey</span>
                </div>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <Badge className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700 px-4 py-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
                  Journey Active
                  {wakeLock && <span className="ml-2">🔒</span>}
                </Badge>
              </div>
              
              <Button
                onClick={endJourney}
                disabled={isLoading}
                size="lg"
                variant="destructive"
                className="w-full h-16 text-xl font-bold rounded-xl"
                data-testid="button-end-journey"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Ending...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Square className="w-6 h-6" />
                    <span>End Journey</span>
                  </div>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Celebration Message for 10+ Journeys */}
      {journeys.length >= 10 && (
        <Card className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-300 dark:border-yellow-700">
          <CardContent className="p-6 text-center">
            <Trophy className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
              🎉 Amazing Achievement!
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300">
              You've completed <strong>{journeys.length} journeys</strong>! Keep up the great work!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Journey List */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Completed Journeys ({journeys.length})
          </h2>
          
          {journeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No journeys yet. Start your first journey!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {journeys.map((journey, index) => (
                <div 
                  key={journey.externalId || index} 
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  data-testid={`journey-item-${index}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        {editingJourney === journey.externalId ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              step="0.001"
                              value={editDistance}
                              onChange={(e) => setEditDistance(e.target.value)}
                              className="w-24 h-8"
                              placeholder="KM"
                              data-testid={`input-edit-distance-${index}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => updateJourney(journey.externalId!, parseFloat(editDistance))}
                              data-testid={`button-save-${index}`}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingJourney(null);
                                setEditDistance('');
                              }}
                              data-testid={`button-cancel-${index}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {formatDistance(journey.meters)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(journey.startedAt)} • {journey.status}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {editingJourney !== journey.externalId && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingJourney(journey.externalId!);
                            setEditDistance((journey.meters / 1000).toString());
                          }}
                          data-testid={`button-edit-${index}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteJourney(journey.externalId!)}
                          data-testid={`button-delete-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}