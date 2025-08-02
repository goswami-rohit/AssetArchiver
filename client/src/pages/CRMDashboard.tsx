import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MapPin,
  Users,
  CheckCircle,
  Play,
  Square,
  Calendar,
  Building2,
  MessageCircle,
  Send,
  Mic,
  Camera,
  Navigation
} from 'lucide-react';
import ChatInterface from '@/components/ChatInterface';
import JourneyTracker from '@/components/JourneyTracker';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  company: {
    companyName: string;
  };
}

export default function CRMDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [chatContext, setChatContext] = useState<string>('dashboard');

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Location error:', error)
      );
    }
  }, []);

  const handleAttendance = () => {
    setChatContext('attendance');
  };

  const handleTasks = () => {
    setChatContext('tasks');
  };

  const handleJourneyPlan = () => {
    setChatContext('journey');
  };

  const handleDealers = () => {
    setChatContext('dealers');
  };

  const handleStartJourney = async () => {
    // Add null check for user
    if (!user) {
      alert('User not loaded. Please refresh the page.');
      return;
    }
    if (!currentLocation) {
      alert('Location not available. Please enable location services.');
      return;
    }

    try {
      // FIXED: Use correct TVR endpoint instead of non-existent journey endpoint
      const response = await fetch('/api/tvr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          visitType: 'Journey Start',
          siteNameConcernedPerson: 'Journey started from PWA',
          phoneNo: '', // Required field
          address: `Lat: ${currentLocation.lat}, Lng: ${currentLocation.lng}`,
          nature: 'Journey Start',
          problemDescription: 'Journey initiated from mobile dashboard',
          actionTaken: 'Journey tracking started',
          nextAction: 'Continue journey tracking',
          followUp: false,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsJourneyActive(true);
        setChatContext('journey_active');
        alert('Journey started successfully!');
      } else {
        alert('Error starting journey: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error starting journey:', error);
      alert('Failed to start journey');
    }
  };

  const handleLocationPunch = async () => {
    if (!user || !currentLocation) {
      alert('User or location not available');
      return;
    }

    try {
      // FIXED: Use correct attendance punch-in endpoint
      const response = await fetch('/api/attendance/punch-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          locationName: 'Location Punch',
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          imageCaptured: false
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Location punched successfully!');
      } else {
        alert('Error punching location: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error punching location:', error);
      alert('Failed to punch location');
    }
    setChatContext('location_punch');
  };

  const handleDVRSubmit = () => {
    setChatContext('dvr');
  };

  const handleTVRSubmit = () => {
    setChatContext('tvr');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-gray-600">{user.company.companyName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {currentLocation && (
              <Badge variant="outline" className="text-green-600">
                <MapPin className="w-3 h-3 mr-1" />
                Location Active
              </Badge>
            )}
            {isJourneyActive && (
              <Badge className="bg-blue-600">
                <Navigation className="w-3 h-3 mr-1" />
                Journey Active
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 pb-24"> {/* Bottom padding for chat */}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Button
            onClick={handleAttendance}
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50"
          >
            <Clock className="w-6 h-6 text-blue-600" />
            <span className="text-sm">Attendance</span>
          </Button>

          <Button
            onClick={handleTasks}
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-green-50"
          >
            <CheckCircle className="w-6 h-6 text-green-600" />
            <span className="text-sm">Tasks</span>
          </Button>

          <Button
            onClick={handleJourneyPlan}
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-purple-50"
          >
            <Calendar className="w-6 h-6 text-purple-600" />
            <span className="text-sm">PJP</span>
          </Button>

          <Button
            onClick={handleDealers}
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-orange-50"
          >
            <Users className="w-6 h-6 text-orange-600" />
            <span className="text-sm">Dealers</span>
          </Button>
        </div>

        {/* Journey Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Button
            onClick={handleStartJourney}
            disabled={isJourneyActive}
            className="h-16 bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
          >
            <Play className="w-5 h-5 mr-2" />
            {isJourneyActive ? 'Journey In Progress' : 'Start Journey'}
          </Button>

          <Button
            onClick={handleLocationPunch}
            variant="outline"
            className="h-16 border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Location Punch
          </Button>
        </div>

        {/* Report Submission Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Button
            onClick={handleDVRSubmit}
            className="h-14 bg-blue-600 hover:bg-blue-700"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Submit DVR (Chat)
          </Button>

          <Button
            onClick={handleTVRSubmit}
            variant="outline"
            className="h-14 border-indigo-600 text-indigo-600 hover:bg-indigo-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Submit TVR (Chat)
          </Button>
        </div>

        {/* Journey Tracker Component */}
        {isJourneyActive && (
          <JourneyTracker
            userId={user.id}
            onJourneyEnd={() => setIsJourneyActive(false)}
          />
        )}

        {/* Recent Activity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-600">✓</span>
                <span className="text-sm text-gray-600">Checked In: 9:15 AM</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-orange-600">3</span>
                <span className="text-sm text-gray-600">Due Today</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">12</span>
                <span className="text-sm text-gray-600">Visits Completed</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fixed Chat Interface at Bottom */}
      <ChatInterface
        context={chatContext}
        currentLocation={currentLocation}
        userId={user.id}
        onContextChange={setChatContext}
      />
    </div>
  );
}