import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Navigation,
  Plus,
  List,
  UserPlus,
  CalendarDays,
  LogIn,
  LogOut,
  Briefcase
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

interface Dealer {
  id: string;
  name: string;
  type: string;
  region: string;
  area: string;
  phoneNo: string;
  address: string;
  totalPotential: string;
  bestPotential: string;
  brandSelling: string[];
  feedbacks: string;
}

export default function CRMDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [chatContext, setChatContext] = useState<string>('dashboard');
  const [attendanceStatus, setAttendanceStatus] = useState<'out' | 'in' | null>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [showDealerForm, setShowDealerForm] = useState(false);
  const [showDealersList, setShowDealersList] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [dealerForm, setDealerForm] = useState({
    name: '',
    type: 'Dealer',
    region: '',
    area: '',
    phoneNo: '',
    address: '',
    totalPotential: '',
    bestPotential: '',
    brandSelling: [''],
    feedbacks: '',
    remarks: ''
  });
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    totalDays: 1
  });

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
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

  useEffect(() => {
    if (user) {
      fetchAttendanceStatus();
      fetchTasks();
      fetchDealers();
    }
  }, [user]);

  const fetchAttendanceStatus = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/attendance/today/${user.id}`);
      const data = await response.json();

      if (data.success && data.data) {
        setAttendanceData(data.data);
        // If there's inTimeTimestamp but no outTimeTimestamp, user is checked in
        setAttendanceStatus(data.data.outTimeTimestamp ? 'out' : 'in');
      } else {
        setAttendanceStatus('out');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceStatus('out');
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    try {
      // ✅ FIXED: Using correct TVR endpoint with userId filter
      const response = await fetch(`/api/tvr/recent?userId=${user.id}&limit=10`);
      const data = await response.json();

      if (data.success) {
        // Filter for items that need follow-up (you can adjust this logic)
        const followUpTasks = data.data.filter((tvr: any) => tvr.visitType && !tvr.checkOutTime);
        setTasks(followUpTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const fetchDealers = async () => {
    if (!user) return;

    try {
      // ✅ FIXED: Using correct dealers endpoint
      const response = await fetch(`/api/dealers/recent?userId=${user.id}&limit=50`);
      const data = await response.json();

      if (data.success) {
        setDealers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching dealers:', error);
      setDealers([]);
    }
  };

  const handleAttendancePunch = async () => {
    if (!user || !currentLocation) {
      alert('User or location not available');
      return;
    }

    try {
      if (attendanceStatus === 'out') {
        // ✅ FIXED: Correct punch-in endpoint and request body
        const response = await fetch('/api/attendance/punch-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            locationName: 'Mobile Check-in',
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            accuracy: 10,
            imageCaptured: false
          })
        });

        const data = await response.json();
        if (data.success) {
          setAttendanceStatus('in');
          setAttendanceData(data.data);
          alert('Successfully punched in!');
        } else {
          alert('Error punching in: ' + (data.error || 'Unknown error'));
        }
      } else {
        // ✅ FIXED: Correct punch-out endpoint (already correct)
        const response = await fetch('/api/attendance/punch-out', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            accuracy: 10,
            imageCaptured: false
          })
        });

        const data = await response.json();
        if (data.success) {
          setAttendanceStatus('out');
          setAttendanceData(data.data);
          alert('Successfully punched out!');
        } else {
          alert('Error punching out: ' + (data.error || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Error with attendance:', error);
      alert('Failed to update attendance');
    }
  };

  const handleStartJourney = async () => {
    if (!user || !currentLocation) {
      alert('User or location not available');
      return;
    }

    try {
      // ✅ NEED TO ADD: Journey endpoint - using placeholder for now
      const response = await fetch('/api/journey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          startLatitude: currentLocation.lat.toString(),
          startLongitude: currentLocation.lng.toString(),
          journeyDate: new Date().toISOString().split('T')[0],
          startTime: new Date(),
          journeyType: 'field_visit',
          plannedRoute: 'Daily field visits'
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

  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const response = await fetch('/api/dealers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          type: dealerForm.type,
          name: dealerForm.name,
          region: dealerForm.region,
          area: dealerForm.area,
          phoneNo: dealerForm.phoneNo,
          address: dealerForm.address,
          totalPotential: dealerForm.totalPotential,
          bestPotential: dealerForm.bestPotential,
          brandSelling: dealerForm.brandSelling.filter(brand => brand.trim() !== ''),
          feedbacks: dealerForm.feedbacks,
          remarks: dealerForm.remarks || null
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowDealerForm(false);
        setDealerForm({
          name: '',
          type: 'Dealer',
          region: '',
          area: '',
          phoneNo: '',
          address: '',
          totalPotential: '',
          bestPotential: '',
          brandSelling: [''],
          feedbacks: '',
          remarks: ''
        });
        fetchDealers();
        alert('Dealer added successfully!');
      } else {
        alert('Error adding dealer: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding dealer:', error);
      alert('Failed to add dealer');
    }
  };

  const handleLeaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // ✅ NEED TO ADD: Leave endpoint - using placeholder for now
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          leaveType: leaveForm.leaveType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          totalDays: leaveForm.totalDays,
          reason: leaveForm.reason,
          appliedDate: new Date().toISOString().split('T')[0],
          status: 'Pending'
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowLeaveForm(false);
        setLeaveForm({
          leaveType: '',
          startDate: '',
          endDate: '',
          reason: '',
          totalDays: 1
        });
        alert('Leave application submitted successfully!');
      } else {
        alert('Error submitting leave: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('Failed to submit leave application');
    }
  };

  const addBrandField = () => {
    setDealerForm(prev => ({
      ...prev,
      brandSelling: [...prev.brandSelling, '']
    }));
  };

  const updateBrandField = (index: number, value: string) => {
    setDealerForm(prev => ({
      ...prev,
      brandSelling: prev.brandSelling.map((brand, i) => i === index ? value : brand)
    }));
  };

  const removeBrandField = (index: number) => {
    setDealerForm(prev => ({
      ...prev,
      brandSelling: prev.brandSelling.filter((_, i) => i !== index)
    }));
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
            <Badge variant={attendanceStatus === 'in' ? 'default' : 'outline'}>
              {attendanceStatus === 'in' ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
              {attendanceStatus === 'in' ? 'Checked In' : 'Checked Out'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 pb-24">

        {/* Enhanced Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Button
            onClick={handleAttendancePunch}
            variant={attendanceStatus === 'in' ? 'default' : 'outline'}
            className={`h-20 flex flex-col items-center justify-center space-y-2 ${attendanceStatus === 'in'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'hover:bg-green-50 border-green-600 text-green-600'
              }`}
          >
            {attendanceStatus === 'in' ? <LogOut className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
            <span className="text-sm">{attendanceStatus === 'in' ? 'Punch Out' : 'Punch In'}</span>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-green-50"
              >
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="text-sm">Tasks ({tasks.length})</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Follow-up Tasks</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {tasks.length > 0 ? (
                  tasks.map((task, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <h4 className="font-medium">{task.visitType}</h4>
                        <p className="text-sm text-gray-600">Site: {task.siteNameConcernedPerson}</p>
                        <p className="text-sm text-gray-600">Date: {new Date(task.reportDate).toLocaleDateString()}</p>
                        <Badge variant="outline" className="mt-2">
                          {task.checkOutTime ? 'Completed' : 'In Progress'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No follow-up tasks</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() => setChatContext('journey')}
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-purple-50"
          >
            <Calendar className="w-6 h-6 text-purple-600" />
            <span className="text-sm">PJP</span>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-orange-50"
              >
                <Users className="w-6 h-6 text-orange-600" />
                <span className="text-sm">Dealers ({dealers.length})</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Dealer Management</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <Button onClick={() => setShowDealerForm(!showDealerForm)} className="flex items-center">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Dealer
                  </Button>
                  <Button variant="outline" onClick={() => setShowDealersList(!showDealersList)}>
                    <List className="w-4 h-4 mr-2" />
                    View Dealers
                  </Button>
                </div>

                {showDealerForm && (
                  <form onSubmit={handleAddDealer} className="space-y-4 border p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Dealer Name *</Label>
                        <Input
                          id="name"
                          value={dealerForm.name}
                          onChange={(e) => setDealerForm({ ...dealerForm, name: e.target.value })}
                          required
                          maxLength={255}
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Dealer Type *</Label>
                        <Select value={dealerForm.type} onValueChange={(value) => setDealerForm({ ...dealerForm, type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dealer">Dealer</SelectItem>
                            <SelectItem value="Sub Dealer">Sub Dealer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="region">Region *</Label>
                        <Input
                          id="region"
                          value={dealerForm.region}
                          onChange={(e) => setDealerForm({ ...dealerForm, region: e.target.value })}
                          required
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <Label htmlFor="area">Area *</Label>
                        <Input
                          id="area"
                          value={dealerForm.area}
                          onChange={(e) => setDealerForm({ ...dealerForm, area: e.target.value })}
                          required
                          maxLength={255}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phoneNo">Phone Number *</Label>
                        <Input
                          id="phoneNo"
                          value={dealerForm.phoneNo}
                          onChange={(e) => setDealerForm({ ...dealerForm, phoneNo: e.target.value })}
                          required
                          maxLength={20}
                        />
                      </div>
                      <div>
                        <Label htmlFor="totalPotential">Total Potential *</Label>
                        <Input
                          id="totalPotential"
                          type="number"
                          step="0.01"
                          value={dealerForm.totalPotential}
                          onChange={(e) => setDealerForm({ ...dealerForm, totalPotential: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="bestPotential">Best Potential *</Label>
                        <Input
                          id="bestPotential"
                          type="number"
                          step="0.01"
                          value={dealerForm.bestPotential}
                          onChange={(e) => setDealerForm({ ...dealerForm, bestPotential: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Address *</Label>
                      <Textarea
                        id="address"
                        value={dealerForm.address}
                        onChange={(e) => setDealerForm({ ...dealerForm, address: e.target.value })}
                        required
                        maxLength={500}
                      />
                    </div>

                    <div>
                      <Label>Brands Selling *</Label>
                      {dealerForm.brandSelling.map((brand, index) => (
                        <div key={index} className="flex space-x-2 mt-2">
                          <Input
                            value={brand}
                            onChange={(e) => updateBrandField(index, e.target.value)}
                            placeholder="Brand name"
                          />
                          {dealerForm.brandSelling.length > 1 && (
                            <Button type="button" variant="outline" onClick={() => removeBrandField(index)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addBrandField} className="mt-2">
                        Add Brand
                      </Button>
                    </div>

                    <div>
                      <Label htmlFor="feedbacks">Feedbacks *</Label>
                      <Textarea
                        id="feedbacks"
                        value={dealerForm.feedbacks}
                        onChange={(e) => setDealerForm({ ...dealerForm, feedbacks: e.target.value })}
                        required
                        maxLength={500}
                      />
                    </div>

                    <div>
                      <Label htmlFor="remarks">Remarks</Label>
                      <Textarea
                        id="remarks"
                        value={dealerForm.remarks}
                        onChange={(e) => setDealerForm({ ...dealerForm, remarks: e.target.value })}
                        maxLength={500}
                      />
                    </div>

                    <Button type="submit" className="w-full">Add Dealer</Button>
                  </form>
                )}

                {showDealersList && (
                  <div className="space-y-4">
                    <h3 className="font-medium">Existing Dealers ({dealers.length})</h3>
                    {dealers.length > 0 ? (
                      <div className="grid gap-4 max-h-96 overflow-y-auto">
                        {dealers.map((dealer) => (
                          <Card key={dealer.id}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <h4 className="font-medium">{dealer.name}</h4>
                                  <p className="text-sm text-gray-600">{dealer.region} - {dealer.area}</p>
                                  <p className="text-sm text-gray-600">📞 {dealer.phoneNo}</p>
                                  <p className="text-sm text-gray-600">💰 Total: ₹{dealer.totalPotential} | Best: ₹{dealer.bestPotential}</p>
                                  <p className="text-sm text-gray-600">🏷️ {dealer.brandSelling.join(', ')}</p>
                                </div>
                                <Badge variant={dealer.type === 'Dealer' ? 'default' : 'outline'}>
                                  {dealer.type}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500">No dealers found</p>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50"
              >
                <CalendarDays className="w-6 h-6 text-blue-600" />
                <span className="text-sm">Leave</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLeaveApplication} className="space-y-4">
                <div>
                  <Label htmlFor="leaveType">Leave Type *</Label>
                  <Select value={leaveForm.leaveType} onValueChange={(value) => setLeaveForm({ ...leaveForm, leaveType: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sick">Sick Leave</SelectItem>
                      <SelectItem value="Casual">Casual Leave</SelectItem>
                      <SelectItem value="Earned">Earned Leave</SelectItem>
                      <SelectItem value="Emergency">Emergency Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="totalDays">Total Days</Label>
                  <Input
                    id="totalDays"
                    type="number"
                    value={leaveForm.totalDays}
                    onChange={(e) => setLeaveForm({ ...leaveForm, totalDays: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Please provide reason for leave"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Submit Leave Application</Button>
              </form>
            </DialogContent>
          </Dialog>
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
            onClick={() => setChatContext('location_punch')}
            variant="outline"
            className="h-16 border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Location Punch
          </Button>
        </div>

        {/* Report Submission Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            onClick={() => setChatContext('dvr')}
            className="h-14 bg-blue-600 hover:bg-blue-700"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Submit DVR
          </Button>

          <Button
            onClick={() => setChatContext('tvr')}
            variant="outline"
            className="h-14 border-indigo-600 text-indigo-600 hover:bg-indigo-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Submit TVR
          </Button>

          <Button
            onClick={() => setChatContext('competition')}
            variant="outline"
            className="h-14 border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Competition Report
          </Button>
        </div>

        {/* Journey Tracker Component */}
        {isJourneyActive && (
          <JourneyTracker
            userId={user.id}
            onJourneyEnd={() => setIsJourneyActive(false)}
          />
        )}

        {/* Activity Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${attendanceStatus === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {attendanceStatus === 'in' ? '✓' : '✗'}
                </span>
                <span className="text-sm text-gray-600">
                  {attendanceStatus === 'in' ?
                    (attendanceData ? `In: ${new Date(attendanceData.inTimeTimestamp).toLocaleTimeString()}` : 'Checked In') :
                    'Not Checked In'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Follow-up Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-orange-600">{tasks.length}</span>
                <span className="text-sm text-gray-600">Pending</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">My Dealers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">{dealers.length}</span>
                <span className="text-sm text-gray-600">Total</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Journey Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${isJourneyActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {isJourneyActive ? '🚗' : '🏠'}
                </span>
                <span className="text-sm text-gray-600">
                  {isJourneyActive ? 'Active' : 'Inactive'}
                </span>
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