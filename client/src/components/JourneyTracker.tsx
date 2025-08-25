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
  ArrowLeft,
  Calculator,
  MapPin,
  Trophy,
  Star,
  Target,
  Award,
  Zap
} from 'lucide-react';

interface JourneyTrackerProps {
  userId: number;
  onBack?: () => void;
}

interface Journey {
  externalId?: string;
  status?: string;
  meters: number;
  startedAt?: string;
  updatedAt?: string;
}

export default function JourneyTracker({ userId, onBack }: JourneyTrackerProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentJourneyId, setCurrentJourneyId] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [editingJourney, setEditingJourney] = useState<string | null>(null);
  const [editDistance, setEditDistance] = useState('');
  const [showAchievement, setShowAchievement] = useState(false);

  // Achievement system
  const getAchievement = (count: number) => {
    if (count >= 50) return { title: "Journey Master", icon: Trophy, color: "bg-purple-500", message: "50+ journeys! You're unstoppable!" };
    if (count >= 25) return { title: "Travel Expert", icon: Award, color: "bg-yellow-500", message: "25+ journeys! Amazing dedication!" };
    if (count >= 15) return { title: "Explorer Pro", icon: Star, color: "bg-blue-500", message: "15+ journeys! You're a pro!" };
    if (count >= 10) return { title: "Journey Hero", icon: Target, color: "bg-green-500", message: "10+ journeys! You're a hero!" };
    if (count >= 5) return { title: "Rising Star", icon: Zap, color: "bg-orange-500", message: "5+ journeys! Keep it up!" };
    return { title: "Beginner", icon: MapPin, color: "bg-gray-500", message: "Start your journey!" };
  };

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

  // Journey control - single switching function
  const toggleJourney = async () => {
    if (isActive) {
      // End journey
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
          setSuccess('Journey completed! 🎉');
          await releaseWakeLock();
          
          // Auto-calculate distance after completion
          setTimeout(() => {
            calculateJourneyDistance(data.data.journeyId);
          }, 1000);
          
          fetchJourneys();
        } else {
          setError(data.error || 'Failed to end journey');
        }
      } catch (err) {
        setError('Network error: Failed to end journey');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Start journey
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
              setSuccess('Journey started! 🚀');
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
    }
  };

  // CRUD functions
  const fetchJourneys = async () => {
    try {
      const response = await fetch(`/api/geo/list?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        const newJourneys = data.data.breakdown || [];
        const oldCount = journeys.length;
        const newCount = newJourneys.length;
        
        setJourneys(newJourneys);
        
        // Show achievement if milestone reached
        if (newCount > oldCount && [5, 10, 15, 25, 50].includes(newCount)) {
          setShowAchievement(true);
          setTimeout(() => setShowAchievement(false), 4000);
        }
      }
    } catch (err) {
      console.error('Failed to fetch journeys:', err);
    }
  };

  const calculateJourneyDistance = async (journeyId: string) => {
    try {
      const response = await fetch('/api/geo/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          journeyId,
          limit: 500
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess(`Distance calculated: ${data.data.totalKm}km`);
        fetchJourneys();
      } else {
        setError(data.error || 'Failed to calculate distance');
      }
    } catch (err) {
      setError('Failed to calculate journey distance');
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
        setEditDistance('');
        fetchJourneys();
      } else {
        setError('Failed to update journey');
      }
    } catch (err) {
      setError('Failed to update journey');
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
      } else {
        setError('Failed to delete journey');
      }
    } catch (err) {
      setError('Failed to delete journey');
    }
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km < 1 ? `${meters.toFixed(0)}m` : `${km.toFixed(2)}km`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  useEffect(() => {
    fetchJourneys();
  }, [userId]);

  const achievement = getAchievement(journeys.length);
  const AchievementIcon = achievement.icon;

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Native Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Journey Tracker</h1>
        <Badge className={`${achievement.color} text-white px-2 py-1 text-xs`}>
          {achievement.title}
        </Badge>
      </div>

      {/* Achievement Celebration */}
      {showAchievement && (
        <div className="absolute top-20 left-4 right-4 z-50">
          <Card className={`${achievement.color} text-white border-0 shadow-2xl animate-pulse`}>
            <CardContent className="p-4 text-center">
              <AchievementIcon className="w-12 h-12 mx-auto mb-2" />
              <h3 className="font-bold text-lg">{achievement.title} Unlocked!</h3>
              <p className="text-sm">{achievement.message}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Messages */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3" data-testid="message-success">
              <p className="text-green-800 dark:text-green-200 text-sm font-medium">{success}</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3" data-testid="message-error">
              <p className="text-red-800 dark:text-red-200 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Main Journey Control */}
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {/* Status Indicator */}
                <div className="relative">
                  <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-green-100 dark:bg-green-900/30 ring-4 ring-green-500/20' 
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {isActive ? (
                      <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                    ) : (
                      <MapPin className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  {wakeLock && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-xs">🔒</span>
                    </div>
                  )}
                </div>

                {/* Status Text */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    {isActive ? 'Journey in Progress' : 'Ready to Start'}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {isActive ? 'Tracking your adventure...' : 'Begin your next adventure'}
                  </p>
                </div>

                {/* Single Switching Button */}
                <Button
                  onClick={toggleJourney}
                  disabled={isLoading}
                  className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  data-testid={isActive ? "button-end-journey" : "button-start-journey"}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isActive ? 'Ending Journey...' : 'Starting Journey...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      {isActive ? (
                        <>
                          <Square className="w-6 h-6" />
                          <span>End Journey</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-6 h-6" />
                          <span>Start Journey</span>
                        </>
                      )}
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Achievement Progress */}
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{journeys.length} Journeys Completed</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {journeys.length >= 50 ? 'You\'re a legend!' :
                     journeys.length >= 25 ? `${50 - journeys.length} more to become a legend` :
                     journeys.length >= 15 ? `${25 - journeys.length} more to become an expert` :
                     journeys.length >= 10 ? `${15 - journeys.length} more to become a pro` :
                     journeys.length >= 5 ? `${10 - journeys.length} more to become a hero` :
                     `${5 - journeys.length} more to become a rising star`}
                  </p>
                </div>
                <AchievementIcon className={`w-8 h-8 text-white p-1.5 ${achievement.color} rounded-full`} />
              </div>
            </CardContent>
          </Card>

          {/* 10+ Journey Celebration */}
          {journeys.length >= 10 && (
            <Card className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-2" />
                <h3 className="font-bold text-lg">🎉 Incredible Achievement!</h3>
                <p className="text-sm opacity-90">
                  {journeys.length} journeys completed! You're absolutely crushing it!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Journey List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Journeys ({journeys.length})
            </h2>

            {journeys.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
                <CardContent className="p-6 text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-gray-500 dark:text-gray-400">No journeys yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Start your first journey above</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {journeys.map((journey, index) => (
                  <Card 
                    key={journey.externalId || index} 
                    className="bg-white dark:bg-gray-800 border-0 shadow-sm"
                    data-testid={`journey-item-${index}`}
                  >
                    <CardContent className="p-4">
                      {editingJourney === journey.externalId ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            step="0.001"
                            value={editDistance}
                            onChange={(e) => setEditDistance(e.target.value)}
                            className="flex-1"
                            placeholder="Distance (KM)"
                            data-testid={`input-edit-distance-${index}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => updateJourney(journey.externalId!, parseFloat(editDistance))}
                            className="bg-green-600 hover:bg-green-700 px-3"
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
                            className="px-3"
                            data-testid={`button-cancel-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formatDistance(journey.meters)}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(journey.startedAt)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => calculateJourneyDistance(journey.externalId!)}
                              className="p-2"
                              data-testid={`button-calculate-${index}`}
                            >
                              <Calculator className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingJourney(journey.externalId!);
                                setEditDistance((journey.meters / 1000).toString());
                              }}
                              className="p-2"
                              data-testid={`button-edit-${index}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteJourney(journey.externalId!)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={`button-delete-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}