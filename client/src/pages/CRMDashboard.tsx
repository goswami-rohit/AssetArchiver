import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Home, MessageCircle, MapPin, User, Plus, CheckCircle, Calendar, 
  Building2, Target, Send, Mic, Camera, Search, Filter, MoreHorizontal,
  Clock, Zap, FileText, TrendingUp, LogIn, LogOut, Navigation,
  Settings, Bell, Heart, Share, Bookmark, Eye, Edit, Trash2,
  ChevronRight, ArrowLeft, RotateCcw, Download, Upload
} from 'lucide-react';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  company: { companyName: string };
}

export default function ModernCRM() {
  // Core State
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [attendanceStatus, setAttendanceStatus] = useState<'in' | 'out'>('out');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Data State
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [pjps, setPjps] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [journeyData, setJourneyData] = useState<any>(null);

  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'task' | 'pjp' | 'dealer' | 'target'>('task');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium', dueDate: '', visitType: ''
  });

  const [pjpForm, setPjpForm] = useState({
    plannedDate: '', dealerId: '', location: '', objective: '', status: 'planned'
  });

  const [dealerForm, setDealerForm] = useState({
    name: '', type: 'Dealer', region: '', area: '', phoneNo: '', address: '',
    totalPotential: '', bestPotential: '', brandSelling: '', feedbacks: ''
  });

  const [targetForm, setTargetForm] = useState({
    dealerId: '', targetAmount: '', achievedAmount: '', period: '', notes: ''
  });

  // Initialize
  useEffect(() => {
    initializeApp();
    setupLocation();
  }, []);

  const initializeApp = async () => {
    // Get user from localStorage or API
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      await fetchAllData(parsedUser.id);
    }
  };

  const setupLocation = () => {
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
  };

  const fetchAllData = async (userId: number) => {
    setIsLoading(true);
    try {
      const [tasksRes, pjpsRes, dealersRes, targetsRes] = await Promise.all([
        fetch(`/api/daily-tasks/user/${userId}`),
        fetch(`/api/pjp/user/${userId}`),
        fetch(`/api/dealers/user/${userId}`),
        fetch(`/api/dealer-reports-scores/user/${userId}`)
      ]);

      const [tasksData, pjpsData, dealersData, targetsData] = await Promise.all([
        tasksRes.json(), pjpsRes.json(), dealersRes.json(), targetsRes.json()
      ]);

      setDailyTasks(tasksData.data || []);
      setPjps(pjpsData.data || []);
      setDealers(dealersData.data || []);
      setTargets(targetsData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttendancePunch = async () => {
    if (!user || !currentLocation) return;

    setIsLoading(true);
    try {
      const endpoint = attendanceStatus === 'out' ? '/api/attendance/punch-in' : '/api/attendance/punch-out';
      const method = attendanceStatus === 'out' ? 'POST' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          locationName: 'Mobile App',
          accuracy: 10
        })
      });

      const data = await response.json();
      if (data.success) {
        setAttendanceStatus(attendanceStatus === 'out' ? 'in' : 'out');
      }
    } catch (error) {
      console.error('Attendance error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      let endpoint = '';
      let payload = {};

      switch (createType) {
        case 'task':
          endpoint = '/api/daily-tasks';
          payload = { ...taskForm, userId: user.id };
          break;
        case 'pjp':
          endpoint = '/api/pjp';
          payload = { ...pjpForm, userId: user.id };
          break;
        case 'dealer':
          endpoint = '/api/dealers';
          payload = { 
            ...dealerForm, 
            userId: user.id,
            brandSelling: dealerForm.brandSelling.split(',').map(b => b.trim())
          };
          break;
        case 'target':
          endpoint = '/api/dealer-reports-scores';
          payload = { ...targetForm, userId: user.id };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowCreateModal(false);
        await fetchAllData(user.id);
        // Reset forms
        setTaskForm({ title: '', description: '', priority: 'medium', dueDate: '', visitType: '' });
        setPjpForm({ plannedDate: '', dealerId: '', location: '', objective: '', status: 'planned' });
        setDealerForm({ name: '', type: 'Dealer', region: '', area: '', phoneNo: '', address: '', totalPotential: '', bestPotential: '', brandSelling: '', feedbacks: '' });
        setTargetForm({ dealerId: '', targetAmount: '', achievedAmount: '', period: '', notes: '' });
      }
    } catch (error) {
      console.error('Create error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // HOME PAGE COMPONENT
  const HomePage = () => (
    <div className="h-full bg-gray-50 overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-500 text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-lg">{user?.firstName} {user?.lastName}</h1>
                <p className="text-sm text-gray-500">{user?.company?.companyName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleAttendancePunch}
                className={`${attendanceStatus === 'in' 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-green-500 hover:bg-green-600'} text-white px-4 py-2 rounded-full`}
              >
                {attendanceStatus === 'in' ? <LogOut className="w-4 h-4 mr-1" /> : <LogIn className="w-4 h-4 mr-1" />}
                {attendanceStatus === 'in' ? 'Punch Out' : 'Punch In'}
              </Button>
              <Bell className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Today's Tasks</p>
                  <p className="text-2xl font-bold">{dailyTasks.filter(t => t.status === 'pending').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Active PJPs</p>
                  <p className="text-2xl font-bold">{pjps.filter(p => p.status === 'active').length}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Tasks Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Today's Tasks</h2>
            <Button 
              onClick={() => { setCreateType('task'); setShowCreateModal(true); }}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {dailyTasks.slice(0, 3).map(task => (
              <Card key={task.id} className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{task.title}</h3>
                      <p className="text-sm text-gray-600">{task.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={task.priority === 'high' ? 'destructive' : 'default'}>
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-gray-500">{task.dueDate}</span>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* PJP Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Journey Plans</h2>
            <Button 
              onClick={() => { setCreateType('pjp'); setShowCreateModal(true); }}
              className="bg-purple-500 hover:bg-purple-600 text-white rounded-full p-2"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {pjps.slice(0, 3).map(pjp => (
              <Card key={pjp.id} className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{pjp.objective}</h3>
                      <p className="text-sm text-gray-600">{pjp.location}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">{pjp.status}</Badge>
                        <span className="text-xs text-gray-500">{pjp.plannedDate}</span>
                      </div>
                    </div>
                    <Navigation className="w-5 h-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dealers Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Dealers</h2>
            <Button 
              onClick={() => { setCreateType('dealer'); setShowCreateModal(true); }}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-2"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {dealers.slice(0, 3).map(dealer => (
              <Card key={dealer.id} className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{dealer.name}</h3>
                      <p className="text-sm text-gray-600">{dealer.region} - {dealer.area}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">{dealer.type}</Badge>
                        <span className="text-xs text-gray-500">₹{dealer.totalPotential}</span>
                      </div>
                    </div>
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Targets Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Targets & Scores</h2>
            <Button 
              onClick={() => { setCreateType('target'); setShowCreateModal(true); }}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full p-2"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {targets.slice(0, 3).map(target => (
              <Card key={target.id} className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">Target Achievement</h3>
                      <p className="text-sm text-gray-600">₹{target.achievedAmount} / ₹{target.targetAmount}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${(target.achievedAmount / target.targetAmount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <Target className="w-5 h-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // AI ASSISTANT PAGE
  const AIPage = () => (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <h1 className="text-lg font-semibold">AI Assistant</h1>
      </div>
      
      {/* Chat Container - OpenAI Style */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-4">
          {/* Welcome Message */}
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2">How can I help you today?</h2>
            <p className="text-gray-600">Ask me about your tasks, create reports, or get insights</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <Card className="cursor-pointer hover:bg-gray-50 border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Create DVR Report</span>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-gray-50 border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">Create TVR Report</span>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-gray-50 border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Competition Analysis</span>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-gray-50 border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Building2 className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">Dealer Insights</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Chat Input - OpenAI Style */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center space-x-3 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <Input 
                placeholder="Message AI Assistant..."
                className="pr-12 py-3 rounded-full border-gray-300"
              />
              <Button className="absolute right-1 top-1 bottom-1 px-3 bg-black hover:bg-gray-800 text-white rounded-full">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" className="p-3 rounded-full">
              <Mic className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // JOURNEY & REPORTS PAGE
  const JourneyPage = () => (
    <div className="h-full bg-gray-50 overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-3">
        <h1 className="text-lg font-semibold">Journey & Reports</h1>
      </div>

      <div className="p-4">
        {/* Journey Tracking */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Journey Tracking</h2>
                <p className="text-indigo-100">Track your field visits and routes</p>
              </div>
              <Navigation className="w-8 h-8 text-indigo-200" />
            </div>
            <Button className="mt-4 bg-white text-indigo-600 hover:bg-gray-100">
              Start Journey
            </Button>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">Daily Visit Reports</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">Track your dealer visits and activities</p>
              <Button variant="outline" className="w-full">View DVRs</Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <Zap className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold">Technical Visit Reports</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">Document technical visits and solutions</p>
              <Button variant="outline" className="w-full">View TVRs</Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold">Competition Reports</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">Market intelligence and competitor analysis</p>
              <Button variant="outline" className="w-full">View Competition</Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <Building2 className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">Client Reports</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">Client interactions and feedback</p>
              <Button variant="outline" className="w-full">View Clients</Button>
            </CardContent>
          </Card>
        </div>

        {/* Leave Applications */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Leave Applications</span>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2">
                <Plus className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Manage your leave requests and applications</p>
            <Button variant="outline" className="w-full">View Applications</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // PROFILE PAGE
  const ProfilePage = () => (
    <div className="h-full bg-gray-50 overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-3">
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>

      <div className="p-4">
        {/* User Info */}
        <Card className="mb-6 border border-gray-200">
          <CardContent className="p-6 text-center">
            <Avatar className="h-20 w-20 mx-auto mb-4">
              <AvatarFallback className="bg-blue-500 text-white text-xl">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-semibold">{user?.firstName} {user?.lastName}</h2>
            <p className="text-gray-600">{user?.role}</p>
            <p className="text-sm text-gray-500">{user?.company?.companyName}</p>
          </CardContent>
        </Card>

        {/* Settings Menu */}
        <div className="space-y-3">
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Settings</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Notifications</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Attendance History</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  // Render different pages
  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'ai': return <AIPage />;
      case 'journey': return <JourneyPage />;
      case 'profile': return <ProfilePage />;
      default: return <HomePage />;
    }
  };

  // CREATE MODAL
  const CreateModal = () => (
    <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Create New {createType === 'task' ? 'Task' : createType === 'pjp' ? 'PJP' : createType === 'dealer' ? 'Dealer' : 'Target'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {createType === 'task' && (
            <>
              <div>
                <Label>Title</Label>
                <Input 
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                  placeholder="Task description"
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm({...taskForm, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input 
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})}
                />
              </div>
            </>
          )}

          {createType === 'pjp' && (
            <>
              <div>
                <Label>Planned Date</Label>
                <Input 
                  type="date"
                  value={pjpForm.plannedDate}
                  onChange={(e) => setPjpForm({...pjpForm, plannedDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input 
                  value={pjpForm.location}
                  onChange={(e) => setPjpForm({...pjpForm, location: e.target.value})}
                  placeholder="Visit location"
                />
              </div>
              <div>
                <Label>Objective</Label>
                <Textarea 
                  value={pjpForm.objective}
                  onChange={(e) => setPjpForm({...pjpForm, objective: e.target.value})}
                  placeholder="Journey objective"
                />
              </div>
            </>
          )}

          {createType === 'dealer' && (
            <>
              <div>
                <Label>Name</Label>
                <Input 
                  value={dealerForm.name}
                  onChange={(e) => setDealerForm({...dealerForm, name: e.target.value})}
                  placeholder="Dealer name"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={dealerForm.type} onValueChange={(value) => setDealerForm({...dealerForm, type: value})}>
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
                <Label>Region</Label>
                <Input 
                  value={dealerForm.region}
                  onChange={(e) => setDealerForm({...dealerForm, region: e.target.value})}
                  placeholder="Region"
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input 
                  value={dealerForm.phoneNo}
                  onChange={(e) => setDealerForm({...dealerForm, phoneNo: e.target.value})}
                  placeholder="Phone number"
                />
              </div>
            </>
          )}

          {createType === 'target' && (
            <>
              <div>
                <Label>Target Amount</Label>
                <Input 
                  type="number"
                  value={targetForm.targetAmount}
                  onChange={(e) => setTargetForm({...targetForm, targetAmount: e.target.value})}
                  placeholder="Target amount"
                />
              </div>
              <div>
                <Label>Achieved Amount</Label>
                <Input 
                  type="number"
                  value={targetForm.achievedAmount}
                  onChange={(e) => setTargetForm({...targetForm, achievedAmount: e.target.value})}
                  placeholder="Achieved amount"
                />
              </div>
              <div>
                <Label>Period</Label>
                <Input 
                  value={targetForm.period}
                  onChange={(e) => setTargetForm({...targetForm, period: e.target.value})}
                  placeholder="e.g., Monthly, Quarterly"
                />
              </div>
            </>
          )}

          <div className="flex space-x-2 pt-4">
            <Button onClick={handleCreate} disabled={isLoading} className="flex-1">
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="h-screen flex flex-col bg-white max-w-md mx-auto relative">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderPage()}
      </div>

      {/* Bottom Navigation - Instagram Style */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 sticky bottom-0">
        <div className="flex items-center justify-around">
          <Button
            variant={currentPage === 'home' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('home')}
            className="flex flex-col items-center space-y-1 p-2 rounded-lg"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </Button>
          
          <Button
            variant={currentPage === 'ai' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('ai')}
            className="flex flex-col items-center space-y-1 p-2 rounded-lg"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">AI</span>
          </Button>
          
          <Button
            variant={currentPage === 'journey' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('journey')}
            className="flex flex-col items-center space-y-1 p-2 rounded-lg"
          >
            <MapPin className="w-5 h-5" />
            <span className="text-xs">Journey</span>
          </Button>
          
          <Button
            variant={currentPage === 'profile' ? 'default' : 'ghost'}
            onClick={() => setCurrentPage('profile')}
            className="flex flex-col items-center space-y-1 p-2 rounded-lg"
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </div>

      <CreateModal />
    </div>
  );
}