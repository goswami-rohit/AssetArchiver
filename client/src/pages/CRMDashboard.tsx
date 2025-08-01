import { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Navigation,
  Clock,
  CalendarDays,
  TrendingUp,
  UserPlus,
  CheckCircle,
  Calendar,
  Play,
  MessageCircle,
  LogIn,
  LogOut,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mock components and data for demonstration purposes
const user = {
  id: 1, // Matches the userId in the schema
  firstName: 'John',
  lastName: 'Doe',
  company: { companyName: 'Acme Inc.' },
};
const currentLocation = { lat: 26.1445, lng: 91.7360 };
const ChatInterface = ({ context, currentLocation, userId, onContextChange, isMinimized, onToggleMinimize }) => (
  <div className={`fixed bottom-0 left-0 right-0 bg-white shadow-2xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-16' : 'h-96'} overflow-hidden rounded-t-3xl`}>
    <div className="flex items-center justify-between p-4 cursor-pointer" onClick={onToggleMinimize}>
      <h3 className="font-bold text-gray-900">Chat with AI Assistant</h3>
      <MessageCircle className="w-5 h-5 text-blue-600" />
    </div>
    {!isMinimized && (
      <div className="p-4 border-t h-[calc(100%-4rem)] overflow-y-auto">
        <p className="text-gray-500">This is a mock chat interface. The context for the action is: </p>
        <p className="text-sm text-gray-400 mt-2">{JSON.stringify(context, null, 2)}</p>
      </div>
    )}
  </div>
);
const JourneyTracker = ({ userId, onJourneyEnd }) => (
  <div className="bg-white p-4 rounded-xl shadow-md border-2 border-green-100">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        <p className="text-sm font-semibold text-green-700">Journey Active</p>
      </div>
      <p className="text-xs text-gray-500">Tracking since 9:30 AM</p>
    </div>
    <div className="mt-2 text-sm text-gray-600">
      <p>Total distance: 15.2 km</p>
      <p>Last punched location: Dealer XYZ</p>
    </div>
    <Button
      onClick={onJourneyEnd}
      variant="outline"
      className="mt-4 w-full border-red-300 text-red-600 hover:bg-red-50"
    >
      <LogOut className="w-4 h-4 mr-2" />
      End Journey
    </Button>
  </div>
);
const getStatusBadgeColor = (status) => {
  switch (status) {
    case 'Approved': return 'bg-green-100 text-green-700 border-green-200';
    case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
    case 'Pending': default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }
};
const getAttendanceButtonText = (status) => {
  if (status?.punchedIn && !status?.punchedOut) {
    return 'Punch Out';
  }
  if (status?.punchedOut) {
    return 'Punched Out';
  }
  return 'Punch In';
};
const getAttendanceButtonColor = (status) => {
  if (status?.punchedIn && !status?.punchedOut) {
    return 'hover:bg-red-50 border-red-200';
  }
  if (status?.punchedOut) {
    return 'border-gray-200';
  }
  return 'hover:bg-blue-50 border-blue-200';
};

export default function EnhancedDashboard() {
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(true);
  const [chatContext, setChatContext] = useState({});
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showReportsDialog, setShowReportsDialog] = useState(false);
  const [showDealerDialog, setShowDealerDialog] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isLoadingLeave, setIsLoadingLeave] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isLoadingDealers, setIsLoadingDealers] = useState(false);

  // Data states from API calls
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [dealers, setDealers] = useState([]);

  // Form states
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [dealerForm, setDealerForm] = useState({
    dealerType: 'Dealer',
    dealerName: '',
    region: '',
    area: '',
    contactPerson: '',
    contactPersonPhoneNo: '',
    totalPotential: '',
    bestPotential: '',
    location: '',
    latitude: '',
    longitude: '',
    feedbacks: '',
    brandSelling: [],
  });

  // Fetch initial data
  useEffect(() => {
    // Fetch attendance status
    const fetchAttendance = async () => {
      try {
        const response = await fetch(`/api/attendance?userId=${user.id}&date=${new Date().toISOString().split('T')[0]}`);
        const data = await response.json();
        if (response.ok && data.data.length > 0) {
          const status = data.data[0];
          setAttendanceStatus({
            punchedIn: !!status.inTimeTimestamp,
            punchedOut: !!status.outTimeTimestamp,
            data: status,
          });
        }
      } catch (error) {
        console.error('Error fetching attendance:', error);
      }
    };

    // Fetch leave applications
    const fetchLeaves = async () => {
      try {
        const response = await fetch(`/api/leave?userId=${user.id}&limit=5`);
        const data = await response.json();
        if (response.ok) {
          setLeaveApplications(data.data);
        }
      } catch (error) {
        console.error('Error fetching leaves:', error);
      }
    };

    // Fetch recent reports
    const fetchReports = async () => {
      setIsLoadingReports(true);
      try {
        const responseDVR = await fetch(`/api/dvr?userId=${user.id}&limit=5`);
        const responseTVR = await fetch(`/api/tvr?userId=${user.id}&limit=5`);
        const dvrData = await responseDVR.json();
        const tvrData = await responseTVR.json();
        if (responseDVR.ok && responseTVR.ok) {
          const combinedReports = [
            ...dvrData.data.map(r => ({ ...r, type: 'DVR', reportDate: r.createdAt })),
            ...tvrData.data.map(r => ({ ...r, type: 'TVR', reportDate: r.createdAt })),
          ];
          setRecentReports(combinedReports.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate)));
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setIsLoadingReports(false);
      }
    };

    // Fetch dealers
    const fetchDealers = async () => {
      try {
        const response = await fetch(`/api/dealers?userId=${user.id}`);
        const data = await response.json();
        if (response.ok) {
          setDealers(data.data);
        }
      } catch (error) {
        console.error('Error fetching dealers:', error);
      }
    };

    fetchAttendance();
    fetchLeaves();
    fetchReports();
    fetchDealers();
  }, [user.id]);

  // Handler functions for API interaction
  const handlePunchIn = async () => {
    setIsLoadingAttendance(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationName: 'Current Location' }),
      });
      if (response.ok) {
        const newAttendance = await response.json();
        setAttendanceStatus({
          punchedIn: true,
          punchedOut: false,
          data: newAttendance.data,
        });
      }
    } catch (error) {
      console.error('Error punching in:', error);
    } finally {
      setIsLoadingAttendance(false);
    }
  };
  const handlePunchOut = async () => {
    setIsLoadingAttendance(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, outTimeTimestamp: new Date().toISOString() }),
      });
      if (response.ok) {
        const updatedAttendance = await response.json();
        setAttendanceStatus(prev => ({ ...prev, punchedOut: true, data: updatedAttendance.data }));
      }
    } catch (error) {
      console.error('Error punching out:', error);
    } finally {
      setIsLoadingAttendance(false);
    }
  };
  const handleLeaveSubmit = async () => {
    setIsLoadingLeave(true);
    try {
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leaveForm, userId: user.id, status: 'Pending' }),
      });
      if (response.ok) {
        const newLeave = await response.json();
        setLeaveApplications(prev => [...prev, newLeave.data]);
        setShowLeaveDialog(false);
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
    } finally {
      setIsLoadingLeave(false);
    }
  };
  const handleDealerSubmit = async () => {
    setIsLoadingDealers(true);
    try {
      const apiBody = {
        userId: user.id,
        type: dealerForm.dealerType,
        name: dealerForm.dealerName,
        region: dealerForm.region,
        area: dealerForm.area,
        phoneNo: dealerForm.contactPersonPhoneNo,
        address: dealerForm.location,
        totalPotential: dealerForm.totalPotential,
        bestPotential: dealerForm.bestPotential,
        feedbacks: dealerForm.feedbacks,
        brandSelling: dealerForm.brandSelling,
      };

      const response = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create dealer');
      }

      const result = await response.json();
      setDealers(prev => [...prev, result.data]);
      setShowDealerDialog(false);
    } catch (error) {
      console.error('Error creating dealer:', error);
    } finally {
      setIsLoadingDealers(false);
    }
  };
  const handleStartJourney = async () => {
    setIsJourneyActive(true);
    setChatContext({ action: 'start_journey' });
    try {
      const response = await fetch('/api/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, startLocation: currentLocation }),
      });
      if (response.ok) {
        console.log('Journey started successfully.');
      }
    } catch (error) {
      console.error('Error starting journey:', error);
    }
  };
  const handleLocationPunch = async () => {
    setChatContext({ action: 'location_punch', location: currentLocation });
    try {
      const response = await fetch('/api/journey/dealer-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, lat: currentLocation.lat, lng: currentLocation.lng }),
      });
      if (response.ok) {
        console.log('Location punched successfully.');
      }
    } catch (error) {
      console.error('Error punching location:', error);
    }
  };
  const handleDVRSubmit = async () => {
    setChatContext({ action: 'submit_dvr' });
    setIsChatMinimized(false);
    // Logic to open chat and guide user to submit DVR
    // The actual DVR data submission would happen via the chat interface, not directly from this button.
    // e.g., POST to /api/dvr with data from chat input
  };
  const handleTVRSubmit = async () => {
    setChatContext({ action: 'submit_tvr' });
    setIsChatMinimized(false);
    // Logic to open chat and guide user to submit TVR
    // e.g., POST to /api/tvr with data from chat input
  };
  const handleReports = () => setShowReportsDialog(true);
  const handleDealers = () => setShowDealerDialog(true);
  const handleTasks = () => console.log('Tasks clicked'); // No endpoint provided, so just log
  const handleJourneyPlan = () => console.log('PJP clicked'); // No endpoint provided, so just log

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-blue-100 p-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-gray-600 font-medium">{user.company.companyName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {currentLocation && (
              <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200 px-3 py-1">
                <MapPin className="w-3 h-3 mr-1" /> Location Active
              </Badge>
            )}
            {isJourneyActive && (
              <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1">
                <Navigation className="w-3 h-3 mr-1" /> Journey Active
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      <div className={`flex-1 flex flex-col p-6 max-w-7xl mx-auto ${isChatMinimized ? 'pb-6' : 'pb-96'}`}>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className={`h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg ${getAttendanceButtonColor(attendanceStatus)}`}
              >
                <Clock className="w-7 h-7 text-blue-600" />
                <span className="text-sm font-medium">{getAttendanceButtonText(attendanceStatus)}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">Attendance Management</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {attendanceStatus?.data && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                    <p className="text-sm text-gray-700 font-medium mb-2">Today's Status:</p>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">
                        Punched In: {attendanceStatus.data.inTimeTimestamp ?
                          new Date(attendanceStatus.data.inTimeTimestamp).toLocaleTimeString() : 'Not yet'}
                      </p>
                      {attendanceStatus.data.outTimeTimestamp && (
                        <p className="font-semibold text-gray-900">
                          Punched Out: {new Date(attendanceStatus.data.outTimeTimestamp).toLocaleTimeString()}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">📍 {attendanceStatus.data.locationName}</p>
                    </div>
                  </div>
                )}
                <div className="flex space-x-3">
                  {!attendanceStatus?.punchedIn && (
                    <Button
                      onClick={handlePunchIn}
                      disabled={isLoadingAttendance}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      {isLoadingAttendance ? 'Punching In...' : 'Punch In'}
                    </Button>
                  )}
                  {attendanceStatus?.punchedIn && !attendanceStatus?.punchedOut && (
                    <Button
                      onClick={handlePunchOut}
                      disabled={isLoadingAttendance}
                      variant="outline"
                      className="flex-1 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      {isLoadingAttendance ? 'Punching Out...' : 'Punch Out'}
                    </Button>
                  )}
                </div>
                {currentLocation && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                    📍 Current Location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:bg-red-50 border-red-200"
              >
                <CalendarDays className="w-7 h-7 text-red-600" />
                <span className="text-sm font-medium">Leave</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">Leave Application</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="leaveType" className="text-sm font-semibold text-gray-700">Leave Type</Label>
                  <Select value={leaveForm.leaveType} onValueChange={(value) => setLeaveForm({ ...leaveForm, leaveType: value })}>
                    <SelectTrigger className="mt-1 rounded-lg border-2">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sick Leave">🤒 Sick Leave</SelectItem>
                      <SelectItem value="Casual Leave">🏖️ Casual Leave</SelectItem>
                      <SelectItem value="Earned Leave">✨ Earned Leave</SelectItem>
                      <SelectItem value="Emergency Leave">🚨 Emergency Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-sm font-semibold text-gray-700">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      className="mt-1 rounded-lg border-2"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm font-semibold text-gray-700">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      className="mt-1 rounded-lg border-2"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason" className="text-sm font-semibold text-gray-700">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please provide reason for leave..."
                    className="mt-1 rounded-lg border-2 min-h-[80px]"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleLeaveSubmit}
                  disabled={isLoadingLeave}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg h-12"
                >
                  {isLoadingLeave ? 'Submitting...' : 'Submit Leave Application'}
                </Button>
                {leaveApplications.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-bold text-gray-900 mb-3">Recent Applications</h4>
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                      {leaveApplications.slice(0, 3).map((leave) => (
                        <div key={leave.id} className="bg-gradient-to-r from-gray-50 to-blue-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-gray-900">{leave.leaveType}</span>
                            <Badge className={`text-xs font-medium ${getStatusBadgeColor(leave.status)}`}>
                              {leave.status}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm mt-1">
                            📅 {leave.startDate} to {leave.endDate}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showReportsDialog} onOpenChange={setShowReportsDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:bg-indigo-50 border-indigo-200"
              >
                <TrendingUp className="w-7 h-7 text-indigo-600" />
                <span className="text-sm font-medium">Reports</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">Recent Reports Dashboard</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {isLoadingReports ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading reports...</p>
                  </div>
                ) : recentReports.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recentReports.map((report) => (
                      <div key={report.id} className="bg-gradient-to-r from-white to-blue-50 p-4 rounded-xl border border-blue-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-lg">{report.dealerName || 'Unknown Dealer'}</h4>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <p className="text-sm text-gray-600">
                                📦 <span className="font-semibold">Order:</span> {report.todayOrderMt || '0'} MT
                              </p>
                              <p className="text-sm text-gray-600">
                                💰 <span className="font-semibold">Collection:</span> ₹{report.todayCollectionRupees || '0'}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">📅 {report.reportDate || report.createdAt}</p>
                          </div>
                          <Badge variant="outline" className="ml-4 font-medium">{report.type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No reports found</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showDealerDialog} onOpenChange={setShowDealerDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:bg-orange-50 border-orange-200"
              >
                <UserPlus className="w-7 h-7 text-orange-600" />
                <span className="text-sm font-medium">Add Dealer</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">Add New Dealer/Sub-Dealer</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="dealerType" className="text-sm font-semibold text-gray-700">Dealer Type</Label>
                  <Select value={dealerForm.dealerType} onValueChange={(value) => setDealerForm({ ...dealerForm, dealerType: value })}>
                    <SelectTrigger className="mt-1 rounded-lg border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dealer">🏢 Dealer</SelectItem>
                      <SelectItem value="Sub Dealer">🏪 Sub Dealer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dealerName" className="text-sm font-semibold text-gray-700">Dealer Name *</Label>
                  <Input
                    id="dealerName"
                    placeholder="Enter dealer name"
                    className="mt-1 rounded-lg border-2"
                    value={dealerForm.dealerName}
                    onChange={(e) => setDealerForm({ ...dealerForm, dealerName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="region" className="text-sm font-semibold text-gray-700">Region *</Label>
                    <Input
                      id="region"
                      placeholder="Enter region"
                      className="mt-1 rounded-lg border-2"
                      value={dealerForm.region}
                      onChange={(e) => setDealerForm({ ...dealerForm, region: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="area" className="text-sm font-semibold text-gray-700">Area *</Label>
                    <Input
                      id="area"
                      placeholder="Enter area"
                      className="mt-1 rounded-lg border-2"
                      value={dealerForm.area}
                      onChange={(e) => setDealerForm({ ...dealerForm, area: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="contactPersonPhoneNo" className="text-sm font-semibold text-gray-700">Phone Number *</Label>
                  <Input
                    id="contactPersonPhoneNo"
                    placeholder="Contact phone number"
                    className="mt-1 rounded-lg border-2"
                    value={dealerForm.contactPersonPhoneNo}
                    onChange={(e) => setDealerForm({ ...dealerForm, contactPersonPhoneNo: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalPotential" className="text-sm font-semibold text-gray-700">Total Potential *</Label>
                    <Input
                      id="totalPotential"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="mt-1 rounded-lg border-2"
                      value={dealerForm.totalPotential}
                      onChange={(e) => setDealerForm({ ...dealerForm, totalPotential: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bestPotential" className="text-sm font-semibold text-gray-700">Best Potential *</Label>
                    <Input
                      id="bestPotential"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="mt-1 rounded-lg border-2"
                      value={dealerForm.bestPotential}
                      onChange={(e) => setDealerForm({ ...dealerForm, bestPotential: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="location" className="text-sm font-semibold text-gray-700">Address *</Label>
                  <Input
                    id="location"
                    placeholder="Dealer address"
                    className="mt-1 rounded-lg border-2"
                    value={dealerForm.location}
                    onChange={(e) => setDealerForm({ ...dealerForm, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="feedbacks" className="text-sm font-semibold text-gray-700">Feedbacks *</Label>
                  <Textarea
                    id="feedbacks"
                    placeholder="Enter feedbacks here..."
                    className="mt-1 rounded-lg border-2"
                    value={dealerForm.feedbacks}
                    onChange={(e) => setDealerForm({ ...dealerForm, feedbacks: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="brandSelling" className="text-sm font-semibold text-gray-700">Brands Selling *</Label>
                  <Textarea
                    id="brandSelling"
                    placeholder="Enter brands separated by commas (e.g., Brand A, Brand B)"
                    className="mt-1 rounded-lg border-2"
                    value={dealerForm.brandSelling.join(', ')}
                    onChange={(e) => setDealerForm({ ...dealerForm, brandSelling: e.target.value.split(',').map(s => s.trim()) })}
                  />
                </div>
                {currentLocation && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg"
                    onClick={() => {
                      setDealerForm(prev => ({
                        ...prev,
                        latitude: currentLocation.lat.toString(),
                        longitude: currentLocation.lng.toString(),
                        location: `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
                      }));
                    }}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Use Current Location
                  </Button>
                )}
                <Button 
                  onClick={handleDealerSubmit} 
                  disabled={isLoadingDealers}
                  className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-lg h-12"
                >
                  {isLoadingDealers ? 'Adding...' : `Add ${dealerForm.dealerType}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button
            onClick={handleTasks}
            variant="outline"
            className="h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:bg-green-50 border-green-200"
          >
            <CheckCircle className="w-7 h-7 text-green-600" />
            <span className="text-sm font-medium">Tasks</span>
          </Button>
          
          <Button
            onClick={handleJourneyPlan}
            variant="outline"
            className="h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:bg-purple-50 border-purple-200"
          >
            <Calendar className="w-7 h-7 text-purple-600" />
            <span className="text-sm font-medium">PJP</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Button
            onClick={handleStartJourney}
            className="h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl text-lg font-semibold shadow-lg"
          >
            <Play className="w-6 h-6 mr-3" />
            Start Journey
          </Button>
          
          <Button
            onClick={handleLocationPunch}
            variant="outline"
            className="h-16 border-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl text-lg font-semibold"
          >
            <MapPin className="w-6 h-6 mr-3" />
            Location Punch
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Button
            onClick={handleDVRSubmit}
            className="h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl text-lg font-semibold shadow-lg"
          >
            <MessageCircle className="w-6 h-6 mr-3" />
            Submit DVR (Chat)
          </Button>
          
          <Button
            onClick={handleTVRSubmit}
            variant="outline"
            className="h-16 border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl text-lg font-semibold"
          >
            <MessageCircle className="w-6 h-6 mr-3" />
            Submit TVR (Chat)
          </Button>
        </div>

        {isJourneyActive && (
          <div className="mb-8">
            <JourneyTracker 
              userId={user.id}
              onJourneyEnd={() => setIsJourneyActive(false)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-white to-blue-50 border-2 border-blue-100 hover:shadow-lg transition-shadow rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-gray-900">Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {attendanceStatus?.punchedIn ? (
                  <>
                    <span className="text-3xl font-bold text-green-600">✓</span>
                    <div className="text-right">
                      <span className="text-sm text-gray-600 block">Checked In</span>
                      <span className="text-xs text-gray-500">
                        {attendanceStatus.data?.inTimeTimestamp ? 
                          new Date(attendanceStatus.data.inTimeTimestamp).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-orange-600">⏳</span>
                    <span className="text-sm text-gray-600">Not Checked In</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-yellow-50 border-2 border-yellow-100 hover:shadow-lg transition-shadow rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-gray-900">Pending Leaves</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-yellow-600">
                  {leaveApplications.filter(l => l.status === 'Pending').length}
                </span>
                <span className="text-sm text-gray-600">Awaiting Approval</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-indigo-50 border-2 border-indigo-100 hover:shadow-lg transition-shadow rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-gray-900">This Week Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-indigo-600">
                  {recentReports.filter(r => {
                    const reportDate = new Date(r.reportDate || r.createdAt || '');
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return reportDate >= weekAgo;
                  }).length}
                </span>
                <span className="text-sm text-gray-600">DVR/TVR Submitted</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-green-50 border-2 border-green-100 hover:shadow-lg transition-shadow rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-gray-900">Total Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-600">
                  ₹{recentReports.reduce((sum, r) => sum + parseFloat(r.todayCollectionRupees || '0'), 0).toLocaleString()}
                </span>
                <span className="text-sm text-gray-600">This Month</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ChatInterface 
        context={chatContext}
        currentLocation={currentLocation}
        userId={user.id}
        onContextChange={setChatContext}
        isMinimized={isChatMinimized}
        onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
      />
    </div>
  );
}