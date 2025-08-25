import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Square, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  MapPin,
  Clock,
  Trophy,
  Calculator,
  RefreshCw,
  ArrowLeft,
  Route,
  Target,
  Star,
  Zap,
  TrendingUp,
  Award,
  Users,
  Crown,
  Sparkles,
  Heart
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

interface JourneyStats {
  totalKm: number;
  tripsCount: number;
  breakdown: Journey[];
}

export default function EnhancedJourneyTracker({ userId, onBack }: JourneyTrackerProps) {
  // Core state
  const [isActive, setIsActive] = useState(false);
  const [currentJourneyId, setCurrentJourneyId] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeyStats, setJourneyStats] = useState<JourneyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Wake lock
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  
  // Edit state
  const [editingJourney, setEditingJourney] = useState<string | null>(null);
  const [editDistance, setEditDistance] = useState('');
  
  // Achievement state
  const [showAchievement, setShowAchievement] = useState(false);
  const [achievementLevel, setAchievementLevel] = useState(0);

  // Achievement levels and messages
  const getAchievementData = (count: number) => {
    if (count >= 50) return { 
      level: 5, 
      title: "Journey Legend", 
      message: "You're absolutely unstoppable! 50+ journeys completed!", 
      icon: Crown, 
      color: "from-purple-500 to-pink-500",
      emoji: "👑"
    };
    if (count >= 25) return { 
      level: 4, 
      title: "Travel Master", 
      message: "Incredible dedication! You've mastered the art of journeying!", 
      icon: Award, 
      color: "from-yellow-500 to-orange-500",
      emoji: "🏆"
    };
    if (count >= 15) return { 
      level: 3, 
      title: "Journey Champion", 
      message: "You're on fire! Keep conquering those miles!", 
      icon: Star, 
      color: "from-blue-500 to-purple-500",
      emoji: "⭐"
    };
    if (count >= 10) return { 
      level: 2, 
      title: "Explorer Elite", 
      message: "Amazing milestone! You've joined the elite explorers club!", 
      icon: Trophy, 
      color: "from-green-500 to-blue-500",
      emoji: "🎉"
    };
    if (count >= 5) return { 
      level: 1, 
      title: "Rising Traveler", 
      message: "Great progress! You're becoming a true traveler!", 
      icon: Target, 
      color: "from-green-400 to-green-600",
      emoji: "🚀"
    };
    return { 
      level: 0, 
      title: "Journey Beginner", 
      message: "Welcome to your journey adventure!", 
      icon: MapPin, 
      color: "from-gray-400 to-gray-600",
      emoji: "🗺️"
    };
  };

  // Wake lock management
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLock) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        lock.addEventListener('release', () => setWakeLock(null));
        setSuccess('🔒 Screen lock activated for uninterrupted tracking!');
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
            setSuccess('🚀 Journey started! Adventure awaits!');
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
        setError('📍 Location access required to start your epic journey!');
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
        setSuccess('🎯 Journey completed successfully! Well done!');
        await releaseWakeLock();
        
        // Calculate distance after completion
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
  };

  // Enhanced CRUD functions for /api/geo/list
  
  // READ - Get journey list with enhanced stats
  const fetchJourneys = async () => {
    try {
      const response = await fetch(`/api/geo/list?userId=${userId}&limit=100`);
      const data = await response.json();
      if (data.success) {
        const stats = data.data as JourneyStats;
        setJourneys(stats.breakdown || []);
        setJourneyStats(stats);
        
        // Check for achievements
        const currentLevel = getAchievementData(stats.breakdown.length).level;
        if (currentLevel > achievementLevel && stats.breakdown.length >= 5) {
          setAchievementLevel(currentLevel);
          setShowAchievement(true);
          setTimeout(() => setShowAchievement(false), 5000);
        }
      }
    } catch (err) {
      console.error('Failed to fetch journeys:', err);
    }
  };

  // CREATE - Calculate and update journey distance with enhanced feedback
  const calculateJourneyDistance = async (journeyId: string) => {
    setIsLoading(true);
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
        const { totalKm, tripsCount } = data.data;
        setSuccess(`✨ Distance calculated: ${totalKm}km from ${tripsCount} GPS points! Your journey data is now complete.`);
        fetchJourneys(); // Refresh to show updated distance
      } else {
        setError(data.error || 'Failed to calculate distance');
      }
    } catch (err) {
      setError('Failed to calculate journey distance');
    } finally {
      setIsLoading(false);
    }
  };

  // UPDATE - Edit journey with enhanced validation
  const updateJourney = async (journeyId: string, newDistance: number) => {
    if (newDistance <= 0) {
      setError('Distance must be greater than 0');
      return;
    }
    
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
        setSuccess(`📝 Journey distance updated to ${newDistance}km!`);
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

  // DELETE - Remove journey with confirmation
  const deleteJourney = async (journeyId: string) => {
    if (!confirm('Are you sure you want to delete this journey? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/geo/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId })
      });
      
      if (response.ok) {
        setSuccess('🗑️ Journey deleted successfully');
        fetchJourneys();
      } else {
        setError('Failed to delete journey');
      }
    } catch (err) {
      setError('Failed to delete journey');
    }
  };

  // Utility functions
  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km < 1 ? `${meters.toFixed(0)}m` : `${km.toFixed(2)}km`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTotalDistance = () => {
    return journeys.reduce((total, journey) => total + journey.meters, 0);
  };

  const getProgressToNextLevel = () => {
    const count = journeys.length;
    const levels = [5, 10, 15, 25, 50];
    const nextLevel = levels.find(level => level > count);
    if (!nextLevel) return 100;
    const prevLevel = levels[levels.indexOf(nextLevel) - 1] || 0;
    return ((count - prevLevel) / (nextLevel - prevLevel)) * 100;
  };

  // Clear messages after 4 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Fetch journeys on mount
  useEffect(() => {
    fetchJourneys();
  }, [userId]);

  const achievementData = getAchievementData(journeys.length);
  const AchievementIcon = achievementData.icon;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
          )}
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Journey Tracker Pro
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Track, achieve, and celebrate every mile
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge className={`bg-gradient-to-r ${achievementData.color} text-white px-4 py-2 text-lg`}>
            {achievementData.emoji} {achievementData.title}
          </Badge>
        </div>
      </div>

      {/* Achievement Popup */}
      {showAchievement && (
        <Card className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 border-0 shadow-2xl animate-bounce">
          <CardContent className="p-6 text-center text-white">
            <AchievementIcon className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">🎉 New Achievement Unlocked!</h2>
            <h3 className="text-xl font-semibold mb-2">{achievementData.title}</h3>
            <p className="text-lg">{achievementData.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-xl shadow-lg" data-testid="message-success">
          <p className="text-green-800 dark:text-green-200 text-center font-medium text-lg">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl shadow-lg" data-testid="message-error">
          <p className="text-red-800 dark:text-red-200 text-center font-medium text-lg">{error}</p>
        </div>
      )}

      {/* Stats Overview */}
      {journeyStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Route className="w-12 h-12 mx-auto mb-3" />
              <h3 className="text-2xl font-bold">{journeyStats.tripsCount}</h3>
              <p className="text-blue-100">Total Journeys</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3" />
              <h3 className="text-2xl font-bold">{(getTotalDistance() / 1000).toFixed(1)}km</h3>
              <p className="text-green-100">Total Distance</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-3" />
              <h3 className="text-2xl font-bold">{achievementData.level}/5</h3>
              <p className="text-purple-100">Achievement Level</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress to Next Achievement */}
      {journeys.length < 50 && (
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Next Achievement Progress</h3>
              <Badge variant="outline">{Math.round(getProgressToNextLevel())}%</Badge>
            </div>
            <Progress value={getProgressToNextLevel()} className="h-3 mb-2" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {[5, 10, 15, 25, 50].find(level => level > journeys.length) - journeys.length} more journeys to unlock your next achievement!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Action Buttons */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
        <CardContent className="p-8">
          {!isActive ? (
            <Button
              onClick={startJourney}
              disabled={isLoading}
              size="lg"
              className="w-full h-20 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105"
              data-testid="button-start-journey"
            >
              {isLoading ? (
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Preparing Your Adventure...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Play className="w-8 h-8" />
                  <span>Start Epic Journey</span>
                  <Zap className="w-6 h-6" />
                </div>
              )}
            </Button>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <Badge className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700 px-6 py-3 text-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3" />
                  Journey in Progress
                  {wakeLock && <span className="ml-3">🔒</span>}
                </Badge>
              </div>
              
              <Button
                onClick={endJourney}
                disabled={isLoading}
                size="lg"
                variant="destructive"
                className="w-full h-20 text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105"
                data-testid="button-end-journey"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Completing Journey...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Square className="w-8 h-8" />
                    <span>Complete Journey</span>
                    <Target className="w-6 h-6" />
                  </div>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Celebration for 10+ Journeys */}
      {journeys.length >= 10 && (
        <Card className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 border-0 shadow-2xl">
          <CardContent className="p-8 text-center text-white">
            <div className="flex justify-center space-x-4 mb-6">
              <Trophy className="w-16 h-16 animate-bounce" />
              <Crown className="w-16 h-16 animate-pulse" />
              <Award className="w-16 h-16 animate-bounce" />
            </div>
            <h2 className="text-4xl font-bold mb-4">
              🎉 INCREDIBLE ACHIEVEMENT! 🎉
            </h2>
            <h3 className="text-2xl font-semibold mb-4">
              {achievementData.title} Status Unlocked!
            </h3>
            <p className="text-xl mb-6">
              You've completed <strong>{journeys.length} epic journeys</strong> covering{' '}
              <strong>{(getTotalDistance() / 1000).toFixed(1)}km</strong>!
            </p>
            <p className="text-lg">
              {achievementData.message}
            </p>
            <div className="flex justify-center mt-6 space-x-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Heart key={i} className="w-6 h-6 animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Journey List with Full CRUD */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Clock className="w-6 h-6 mr-3" />
              Your Journey Collection ({journeys.length})
            </CardTitle>
            <Button
              onClick={fetchJourneys}
              size="sm"
              variant="outline"
              className="flex items-center space-x-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              data-testid="button-refresh-journeys"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync Data</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {journeys.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <MapPin className="w-20 h-20 mx-auto mb-6 opacity-30" />
              <h3 className="text-xl font-semibold mb-2">No Journeys Yet</h3>
              <p className="text-lg">Start your first epic adventure and watch your collection grow!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {journeys.map((journey, index) => (
                <div 
                  key={journey.externalId || index} 
                  className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-all duration-200"
                  data-testid={`journey-item-${index}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div>
                        {editingJourney === journey.externalId ? (
                          <div className="flex items-center space-x-3">
                            <Input
                              type="number"
                              step="0.001"
                              value={editDistance}
                              onChange={(e) => setEditDistance(e.target.value)}
                              className="w-32 h-10 text-lg"
                              placeholder="Distance (KM)"
                              data-testid={`input-edit-distance-${index}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => updateJourney(journey.externalId!, parseFloat(editDistance))}
                              className="bg-green-500 hover:bg-green-600"
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
                            <p className="font-bold text-xl text-gray-900 dark:text-white mb-1">
                              {formatDistance(journey.meters)}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 flex items-center space-x-3">
                              <span>{formatDate(journey.startedAt)}</span>
                              <Badge variant="outline" className="capitalize">
                                {journey.status}
                              </Badge>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {editingJourney !== journey.externalId && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => calculateJourneyDistance(journey.externalId!)}
                          className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                          data-testid={`button-calculate-${index}`}
                          title="Sync distance from GPS data"
                        >
                          <Calculator className="w-4 h-4 mr-1" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingJourney(journey.externalId!);
                            setEditDistance((journey.meters / 1000).toString());
                          }}
                          className="hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                          data-testid={`button-edit-${index}`}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
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