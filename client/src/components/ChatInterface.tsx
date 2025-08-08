//client/src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Mic, Camera, MapPin, Bot, User, Clock, CheckCircle, Calendar, Users, Building2, FileText,
  TrendingUp, Zap, Upload, Download, ChevronUp, ChevronDown, Minimize2, Maximize2, Star,
  Heart, Sparkles, Target, Route, Store, BarChart3, Settings, AlertCircle, Loader2,
  MessageSquare, PlusCircle, Search, Filter, RefreshCw, Eye, Edit, Trash2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'action';
  content: string;
  timestamp: Date;
  context?: string;
  data?: any;
  actionButtons?: ActionButton[];
}

interface ActionButton {
  label: string;
  action: string;
  variant: 'default' | 'outline' | 'secondary';
  icon?: React.ReactNode;
}

interface ChatInterfaceProps {
  context: string;
  currentLocation: { lat: number, lng: number } | null;
  userId: number;
  onContextChange: (context: string) => void;
}

export default function ChatInterface({
  context,
  currentLocation,
  userId,
  onContextChange
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const [recentData, setRecentData] = useState<any>(null);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [aiPersonality, setAiPersonality] = useState('professional'); // professional, friendly, expert
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isMinimized) {
      initializeContext();
    }
  }, [context, isMinimized, userId]);

  // 🚀 INITIALIZE CONTEXT WITH REAL DATA FROM YOUR ENDPOINTS
  const initializeContext = async () => {
    const welcomeMessage = await getContextWelcomeMessage(context);
    const actions = getQuickActions(context);
    setQuickActions(actions);

    setMessages([{
      id: Date.now().toString(),
      type: 'ai',
      content: welcomeMessage,
      timestamp: new Date(),
      context,
      actionButtons: getContextActionButtons(context)
    }]);

    // Fetch recent data for context
    await fetchContextData(context);
  };

  // 🎯 FETCH REAL DATA FROM YOUR ENDPOINTS
  const fetchContextData = async (ctx: string) => {
    try {
      let endpoint = '';
      let data = null;

      switch (ctx) {
        case 'attendance':
          // ✅ HOOK TO YOUR ENDPOINT
          const attendanceRes = await fetch(`/api/attendance/today/${userId}`);
          data = await attendanceRes.json();
          setRecentData(data);
          break;

        case 'journey':
          // ✅ HOOK TO YOUR ENDPOINT
          const journeyRes = await fetch(`/api/journey/active/${userId}`);
          data = await journeyRes.json();
          setRecentData(data);
          break;

        case 'dvr':
          // ✅ HOOK TO YOUR ENDPOINT
          const dvrRes = await fetch(`/api/dvr/recent?userId=${userId}&limit=5`);
          data = await dvrRes.json();
          setRecentData(data);
          break;

        case 'tvr':
          // ✅ HOOK TO YOUR ENDPOINT
          const tvrRes = await fetch(`/api/tvr/recent?userId=${userId}&limit=5`);
          data = await tvrRes.json();
          setRecentData(data);
          break;

        case 'dealers':
          // ✅ HOOK TO YOUR ENDPOINT
          const dealersRes = await fetch(`/api/dealers/recent?limit=10`);
          data = await dealersRes.json();
          setRecentData(data);
          break;

        case 'leave':
          // ✅ HOOK TO YOUR ENDPOINT
          const leaveRes = await fetch(`/api/leave/user/${userId}?limit=5`);
          data = await leaveRes.json();
          setRecentData(data);
          break;

        case 'competition':
          // ✅ HOOK TO YOUR ENDPOINT
          const compRes = await fetch(`/api/competition/recent?userId=${userId}&limit=5`);
          data = await compRes.json();
          setRecentData(data);
          break;

        case 'tasks':
          // ✅ HOOK TO YOUR ENDPOINT
          const tasksRes = await fetch(`/api/tasks/recent?userId=${userId}&limit=10`);
          data = await tasksRes.json();
          setRecentData(data);
          break;
      }
    } catch (error) {
      console.error('Error fetching context data:', error);
    }
  };

  // 🤖 ENHANCED WELCOME MESSAGES WITH REAL DATA
  const getContextWelcomeMessage = async (ctx: string): Promise<string> => {
    const timeOfDay = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';

    switch (ctx) {
      case 'attendance':
        return `🌟 Good ${timeOfDay}! **Attendance Assistant Ready!**\n\n🕐 **Today's Status:**\n${recentData?.hasAttendance ? '✅ You\'re checked in!' : '⏰ Ready to punch in?'}\n\n🎯 **Quick Actions:**\n• Check attendance status\n• View weekly summary\n• Export attendance report\n\n💫 **AI Magic:** Just say "punch in" or "check my attendance" and I'll handle it!`;

      case 'journey':
        return `🗺️ **Journey Command Center Active!**\n\n🚗 **Current Status:**\n${recentData?.hasActiveJourney ? '📍 Journey in progress!' : '🏁 Ready to start new journey'}\n\n⚡ **AI-Powered Features:**\n• Smart route optimization\n• Auto dealer check-ins\n• Real-time tracking\n• Journey analytics\n\n🎯 Try: "Start journey to ABC Dealer" or "Show my route history"`;

      case 'dvr':
        return `📊 **DVR Creation Wizard!**\n\n🏪 **Recent Activity:**\n${recentData?.total || 0} reports this week\n\n🤖 **AI Magic Mode:**\nJust tell me about your dealer visit naturally:\n\n💬 *"Visited XYZ Store, got 5k order, customer happy with new products"*\n\n✨ I'll create a professional DVR instantly!\n\n🎯 **Pro Tip:** Include dealer name, order amount, and feedback for best results!`;

      case 'tvr':
        return `🔧 **Technical Visit Report AI!**\n\n⚡ **Smart Creation:**\nDescribe your technical work in plain English:\n\n💬 *"Fixed AC unit at ABC Hotel, replaced compressor, customer satisfied"*\n\n🎨 **I'll automatically:**\n• Format professionally\n• Add technical details\n• Include follow-up actions\n• Generate summary\n\n🚀 **Recent:** ${recentData?.total || 0} TVRs completed this month`;

      case 'dealers':
        return `🏢 **Dealer Intelligence Hub!**\n\n📊 **Database Status:**\n${recentData?.total || 0} dealers in system\n\n🧠 **AI-Powered Search:**\n• "Find dealers near me"\n• "Show top performing dealers"\n• "Dealers with pending orders"\n\n✨ **Smart Actions:**\n• Auto-add from business cards\n• Performance analytics\n• Contact management\n\nWhat dealer information do you need?`;

      case 'competition':
        return `🏆 **Competition Intelligence AI!**\n\n📈 **Market Overview:**\n${recentData?.total || 0} competitor reports logged\n\n🎯 **AI Analysis:**\n• Trend detection\n• Scheme comparisons\n• Market positioning\n• Threat assessment\n\n💬 **Natural Input:**\n*"Competitor XYZ is offering 20% discount scheme at ABC area"*\n\nI'll analyze and create detailed reports!`;

      case 'leave':
        return `🏖️ **Leave Management Portal!**\n\n📅 **Your Status:**\n• Pending: ${recentData?.data?.filter((l: any) => l.status === 'Pending').length || 0}\n• Approved: ${recentData?.data?.filter((l: any) => l.status === 'Approved').length || 0}\n\n⚡ **Quick Apply:**\n*"Need 2 days leave from tomorrow for family function"*\n\n🤖 I'll handle the application automatically!`;

      case 'tasks':
        return `✅ **Task Command Center!**\n\n📋 **Today's Overview:**\n• Pending: ${recentData?.data?.filter((t: any) => t.status === 'pending').length || 0}\n• Completed: ${recentData?.data?.filter((t: any) => t.status === 'completed').length || 0}\n\n🎯 **Smart Commands:**\n• "Show my tasks"\n• "Mark task 123 complete"\n• "Create task for dealer follow-up"\n\nReady to boost your productivity!`;

      default:
        return `🚀 **Ultimate CRM AI Assistant!**\n\n💪 **Connected to 56+ Endpoints**\n🧠 **AI-Powered Everything**\n📱 **Mobile-First Design**\n\n🌟 **Available Modules:**\n• 📊 Reports (DVR/TVR/Competition)\n• 🕐 Attendance & Leave\n• 🗺️ Journey Tracking\n• 🏢 Dealer Management\n• ✅ Task Management\n\n💫 **Just speak naturally!** I understand context and will connect to the right systems automatically.\n\n🎯 Try: "Create DVR for my ABC dealer visit" or "Show journey analytics"`;
    }
  };

  // 🎯 CONTEXT-SPECIFIC QUICK ACTIONS
  const getQuickActions = (ctx: string): string[] => {
    switch (ctx) {
      case 'attendance':
        return ['📍 Punch In', '📊 Today Status', '📈 Weekly Report', '📋 Export Data'];
      case 'journey':
        return ['🚗 Start Journey', '📍 Current Status', '📊 Analytics', '🗺️ Route History'];
      case 'dvr':
        return ['✨ AI Create DVR', '📋 Recent Reports', '📊 Analytics', '🔄 Sync Data'];
      case 'tvr':
        return ['⚡ AI Generate TVR', '🔧 Quick Entry', '📊 Monthly Stats', '📤 Export'];
      case 'dealers':
        return ['🔍 Find Dealer', '📈 Performance', '➕ Add New', '📊 Analytics'];
      case 'competition':
        return ['📊 Market Analysis', '📈 Trends', '⚔️ Compare', '🎯 Insights'];
      case 'leave':
        return ['📝 Apply Leave', '📊 Check Balance', '📅 History', '⏰ Pending'];
      case 'tasks':
        return ['📋 View Tasks', '✅ Update Status', '➕ New Task', '📊 Progress'];
      default:
        return ['🚀 Quick Start', '📊 Dashboard', '🔍 Search', '⚙️ Settings'];
    }
  };

  // 🎨 CONTEXT ACTION BUTTONS
  const getContextActionButtons = (ctx: string): ActionButton[] => {
    switch (ctx) {
      case 'dvr':
        return [
          { label: 'AI Create DVR', action: 'ai_create_dvr', variant: 'default', icon: <Sparkles className="w-4 h-4" /> },
          { label: 'Quick Entry', action: 'quick_dvr', variant: 'outline', icon: <PlusCircle className="w-4 h-4" /> },
          { label: 'View Recent', action: 'view_recent_dvr', variant: 'secondary', icon: <Eye className="w-4 h-4" /> }
        ];
      case 'tvr':
        return [
          { label: 'AI Generate', action: 'ai_generate_tvr', variant: 'default', icon: <Zap className="w-4 h-4" /> },
          { label: 'Manual Entry', action: 'manual_tvr', variant: 'outline', icon: <Edit className="w-4 h-4" /> },
          { label: 'Export Reports', action: 'export_tvr', variant: 'secondary', icon: <Download className="w-4 h-4" /> }
        ];
      case 'journey':
        return [
          { label: 'Start Journey', action: 'start_journey', variant: 'default', icon: <Route className="w-4 h-4" /> },
          { label: 'Track Location', action: 'track_location', variant: 'outline', icon: <MapPin className="w-4 h-4" /> },
          { label: 'Analytics', action: 'journey_analytics', variant: 'secondary', icon: <BarChart3 className="w-4 h-4" /> }
        ];
      default:
        return [
          { label: 'Help', action: 'help', variant: 'outline', icon: <MessageSquare className="w-4 h-4" /> }
        ];
    }
  };

  // 🧠 SMART AI REQUEST PROCESSOR - HOOKS TO YOUR ENDPOINTS
  const processUserRequest = async (input: string, ctx: string): Promise<string> => {
    const lowerInput = input.toLowerCase();

    try {
      // 🎯 ATTENDANCE REQUESTS
      if (ctx === 'attendance' || lowerInput.includes('punch') || lowerInput.includes('attendance')) {
        if (lowerInput.includes('punch in') || lowerInput.includes('check in')) {
          return await handlePunchIn();
        }
        if (lowerInput.includes('punch out') || lowerInput.includes('check out')) {
          return await handlePunchOut();
        }
        if (lowerInput.includes('status') || lowerInput.includes('today')) {
          return await handleAttendanceStatus();
        }
        if (lowerInput.includes('history') || lowerInput.includes('report')) {
          return await handleAttendanceHistory();
        }
      }

      // 🗺️ JOURNEY REQUESTS
      if (ctx === 'journey' || lowerInput.includes('journey') || lowerInput.includes('route') || lowerInput.includes('travel')) {
        if (lowerInput.includes('start') || lowerInput.includes('begin')) {
          return await handleStartJourney(input);
        }
        if (lowerInput.includes('status') || lowerInput.includes('active')) {
          return await handleJourneyStatus();
        }
        if (lowerInput.includes('history') || lowerInput.includes('analytics')) {
          return await handleJourneyAnalytics();
        }
        if (lowerInput.includes('end') || lowerInput.includes('finish')) {
          return await handleEndJourney();
        }
      }

      // 📊 DVR REQUESTS
      if (ctx === 'dvr' || lowerInput.includes('dvr') || lowerInput.includes('visit') || lowerInput.includes('dealer')) {
        if (lowerInput.includes('create') || lowerInput.includes('visited') || lowerInput.includes('order')) {
          return await handleCreateDVR(input);
        }
        if (lowerInput.includes('recent') || lowerInput.includes('show') || lowerInput.includes('list')) {
          return await handleRecentDVR();
        }
        if (lowerInput.includes('analytics') || lowerInput.includes('stats')) {
          return await handleDVRAnalytics();
        }
      }

      // 🔧 TVR REQUESTS
      if (ctx === 'tvr' || lowerInput.includes('tvr') || lowerInput.includes('technical') || lowerInput.includes('service')) {
        if (lowerInput.includes('create') || lowerInput.includes('fixed') || lowerInput.includes('repair')) {
          return await handleCreateTVR(input);
        }
        if (lowerInput.includes('recent') || lowerInput.includes('show')) {
          return await handleRecentTVR();
        }
      }

      // 🏢 DEALER REQUESTS
      if (ctx === 'dealers' || lowerInput.includes('dealer') || lowerInput.includes('customer')) {
        if (lowerInput.includes('find') || lowerInput.includes('search') || lowerInput.includes('locate')) {
          return await handleFindDealer(input);
        }
        if (lowerInput.includes('add') || lowerInput.includes('new') || lowerInput.includes('create')) {
          return await handleAddDealer(input);
        }
        if (lowerInput.includes('performance') || lowerInput.includes('analytics')) {
          return await handleDealerAnalytics();
        }
      }

      // 🏖️ LEAVE REQUESTS
      if (ctx === 'leave' || lowerInput.includes('leave') || lowerInput.includes('holiday') || lowerInput.includes('vacation')) {
        if (lowerInput.includes('apply') || lowerInput.includes('request') || lowerInput.includes('need')) {
          return await handleApplyLeave(input);
        }
        if (lowerInput.includes('status') || lowerInput.includes('balance') || lowerInput.includes('remaining')) {
          return await handleLeaveStatus();
        }
        if (lowerInput.includes('history') || lowerInput.includes('past')) {
          return await handleLeaveHistory();
        }
      }

      // 🏆 COMPETITION REQUESTS
      if (ctx === 'competition' || lowerInput.includes('competitor') || lowerInput.includes('competition')) {
        if (lowerInput.includes('analysis') || lowerInput.includes('report') || lowerInput.includes('offering')) {
          return await handleCompetitionAnalysis(input);
        }
        if (lowerInput.includes('trends') || lowerInput.includes('market')) {
          return await handleMarketTrends();
        }
      }

      // ✅ TASK REQUESTS
      if (ctx === 'tasks' || lowerInput.includes('task') || lowerInput.includes('todo')) {
        if (lowerInput.includes('show') || lowerInput.includes('list') || lowerInput.includes('pending')) {
          return await handleShowTasks();
        }
        if (lowerInput.includes('create') || lowerInput.includes('add') || lowerInput.includes('new')) {
          return await handleCreateTask(input);
        }
        if (lowerInput.includes('complete') || lowerInput.includes('done') || lowerInput.includes('finish')) {
          return await handleCompleteTask(input);
        }
      }

      // 🔍 GENERAL HELP AND SEARCH
      if (lowerInput.includes('help') || lowerInput.includes('what can') || lowerInput.includes('how to')) {
        return getGeneralHelp(ctx);
      }

      // 📊 ANALYTICS AND REPORTS
      if (lowerInput.includes('analytics') || lowerInput.includes('dashboard') || lowerInput.includes('summary')) {
        return await handleGeneralAnalytics();
      }

      // Default AI response
      return `🤖 **AI Understanding...**\n\nI heard: "${input}"\n\n🎯 **Context:** ${ctx}\n\n✨ **Available Actions:**\n${getQuickActions(ctx).join(' • ')}\n\n💡 **Tip:** Try being more specific about what you'd like to do!`;

    } catch (error) {
      console.error('Error processing request:', error);
      return `❌ **System Error**\n\nSorry, I encountered an issue processing your request. Please try again or use the quick action buttons.`;
    }
  };

  // 🕐 ATTENDANCE HANDLERS
  const handlePunchIn = async (): Promise<string> => {
    if (!currentLocation) {
      return `❌ **Location Required**\n\nI need your GPS location to punch in. Please enable location services and try again.`;
    }

    try {
      const response = await fetch('/api/attendance/punch-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          locationName: 'Auto-detected location',
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          accuracy: 10,
          imageCaptured: false
        })
      });

      const data = await response.json();

      if (data.success) {
        return `✅ **Punch In Successful!**\n\n🕐 **Time:** ${new Date().toLocaleTimeString()}\n📍 **Location:** ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}\n\n🎉 Have a productive day ahead!`;
      } else {
        return `⚠️ **Punch In Issue**\n\n${data.error || 'Unable to punch in at this time.'}\n\n💡 You might already be punched in today.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to connect to attendance system. Please check your connection and try again.`;
    }
  };

  const handlePunchOut = async (): Promise<string> => {
    if (!currentLocation) {
      return `❌ **Location Required**\n\nI need your GPS location to punch out. Please enable location services and try again.`;
    }

    try {
      const response = await fetch('/api/attendance/punch-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          accuracy: 10,
          imageCaptured: false
        })
      });

      const data = await response.json();

      if (data.success) {
        return `✅ **Punch Out Complete!**\n\n🕐 **Time:** ${new Date().toLocaleTimeString()}\n📍 **Location:** ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}\n\n🎉 Great work today! See you tomorrow!`;
      } else {
        return `⚠️ **Punch Out Issue**\n\n${data.error || 'Unable to punch out at this time.'}\n\n💡 Make sure you've punched in first.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to connect to attendance system. Please check your connection and try again.`;
    }
  };

  const handleAttendanceStatus = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/attendance/today/${userId}`);
      const data = await response.json();

      if (data.success) {
        if (data.hasAttendance) {
          const attendance = data.data;
          const punchInTime = new Date(attendance.inTimeTimestamp).toLocaleTimeString();
          const punchOutTime = attendance.outTimeTimestamp ? new Date(attendance.outTimeTimestamp).toLocaleTimeString() : null;

          return `📊 **Today's Attendance**\n\n✅ **Status:** ${punchOutTime ? 'Completed' : 'Active'}\n🕐 **Punch In:** ${punchInTime}\n${punchOutTime ? `🕐 **Punch Out:** ${punchOutTime}` : '⏰ **Still Active**'}\n📍 **Location:** ${attendance.locationName}\n\n${punchOutTime ? '🎉 Day completed!' : '💪 Keep up the good work!'}`;
        } else {
          return `📊 **Today's Attendance**\n\n⏰ **Status:** Not punched in yet\n\n💡 **Ready to start?** Just say "punch in" and I'll handle it!`;
        }
      } else {
        return `❌ **Unable to fetch attendance status.**\n\nPlease try again later.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to fetch attendance data. Please check your connection.`;
    }
  };

  const handleAttendanceHistory = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/attendance/recent?userId=${userId}&limit=7`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        let history = `📈 **Attendance History (Last 7 Days)**\n\n`;

        data.data.forEach((record: any, index: number) => {
          const date = new Date(record.attendanceDate).toLocaleDateString();
          const punchIn = new Date(record.inTimeTimestamp).toLocaleTimeString();
          const punchOut = record.outTimeTimestamp ? new Date(record.outTimeTimestamp).toLocaleTimeString() : 'N/A';

          history += `${index + 1}. **${date}**\n   In: ${punchIn} | Out: ${punchOut}\n\n`;
        });

        return history + `📊 **Total Days:** ${data.data.length}\n✅ **Perfect attendance!**`;
      } else {
        return `📊 **No attendance history found.**\n\nStart punching in to build your attendance record!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch attendance history.**\n\nPlease try again later.`;
    }
  };

  // 🗺️ JOURNEY HANDLERS
  const handleStartJourney = async (input: string): Promise<string> => {
    if (!currentLocation) {
      return `❌ **Location Required**\n\nI need your GPS location to start journey tracking. Please enable location services.`;
    }

    try {
      // Extract dealer names from input if mentioned
      const dealerMatch = input.match(/to\s+([^,\n]+)/i);
      const siteName = dealerMatch ? dealerMatch[1].trim() : 'AI-Planned Journey';

      const response = await fetch('/api/journey/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          journeyType: 'simple',
          plannedDealers: [],
          siteName,
          accuracy: 10,
          batteryLevel: 100,
          isCharging: false,
          networkStatus: 'online',
          description: `Journey started via AI: ${input}`,
          priority: 'medium'
        })
      });

      const data = await response.json();

      if (data.success) {
        return `🚗 **Journey Started Successfully!**\n\n📍 **Starting Point:** ${siteName}\n🕐 **Start Time:** ${new Date().toLocaleTimeString()}\n🎯 **Journey ID:** ${data.data.id}\n\n📡 **GPS Tracking:** Active\n🔋 **Battery:** Optimized\n\n💫 I'll track your location and help with dealer check-ins along the way!`;
      } else {
        return `⚠️ **Journey Start Issue**\n\n${data.error || 'Unable to start journey tracking.'}\n\n💡 You might already have an active journey.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to start journey tracking. Please check your connection.`;
    }
  };

  const handleJourneyStatus = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/journey/active/${userId}`);
      const data = await response.json();

      if (data.success && data.hasActiveJourney) {
        const journey = data.data.journey;
        const status = data.data.status;

        return `🗺️ **Active Journey Status**\n\n📍 **Location:** ${journey.siteName}\n⏱️ **Duration:** ${status.duration}\n📏 **Distance:** ${status.totalDistance}\n📊 **Tracking Points:** ${status.trackingPoints}\n🏪 **Active Check-ins:** ${status.activeCheckins}\n\n🚗 **Status:** Journey in progress\n💫 **AI Monitoring:** Your route and activities`;
      } else {
        return `🗺️ **No Active Journey**\n\n💡 **Ready to start?** Just say "start journey" or "begin route to [destination]" and I'll get you moving!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch journey status.**\n\nPlease try again later.`;
    }
  };

  const handleJourneyAnalytics = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/journey/analytics/${userId}?days=30`);
      const data = await response.json();

      if (data.success) {
        const analytics = data.analytics;

        return `📊 **Journey Analytics (Last 30 Days)**\n\n🚗 **Total Journeys:** ${analytics.totalJourneys}\n✅ **Completed:** ${analytics.completedJourneys}\n📏 **Total Distance:** ${analytics.totalDistance}\n⏱️ **Total Duration:** ${analytics.totalDuration}\n📈 **Average Distance:** ${analytics.averageDistance}\n🏪 **Dealer Visits:** ${analytics.dealerVisits.total}\n\n🎯 **Performance:** ${analytics.completedJourneys > 10 ? 'Excellent!' : 'Keep it up!'}`;
      } else {
        return `📊 **No journey data available.**\n\nStart tracking journeys to see your analytics!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch journey analytics.**\n\nPlease try again later.`;
    }
  };

  const handleEndJourney = async (): Promise<string> => {
    try {
      const activeResponse = await fetch(`/api/journey/active/${userId}`);
      const activeData = await activeResponse.json();

      if (!activeData.hasActiveJourney) {
        return `⚠️ **No Active Journey**\n\nYou don't have any active journey to end.`;
      }

      const response = await fetch('/api/journey/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          journeyId: activeData.data.journey.id,
          endLatitude: currentLocation?.lat,
          endLongitude: currentLocation?.lng,
          journeyNotes: 'Journey ended via AI assistant',
          endReason: 'completed'
        })
      });

      const data = await response.json();

      if (data.success) {
        const summary = data.data.summary;
        return `🏁 **Journey Completed!**\n\n📊 **Final Summary:**\n⏱️ **Duration:** ${summary.duration}\n📏 **Distance:** ${summary.totalDistance}\n🏪 **Dealers Visited:** ${summary.dealersVisited}\n📍 **Waypoints:** ${summary.waypoints}\n\n🎉 **Excellent work!** Your journey data has been saved and analyzed.`;
      } else {
        return `⚠️ **Journey End Issue**\n\n${data.error || 'Unable to end journey.'}\n\nPlease try again.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to end journey. Please check your connection.`;
    }
  };

  // 📊 DVR HANDLERS
  const handleCreateDVR = async (input: string): Promise<string> => {
    setTypingIndicator(true);
    try {
      const lowerInput = input.toLowerCase().trim();
      // 🆕 NEW: Enhanced punch-in with dealer detection
      if (lowerInput === 'punch in' || lowerInput === 'punch-in' || lowerInput === 'start visit') {
        const location = await getCurrentLocationPrecise();
        if (!location) {
          return `📍 **Location Required**\n\nCannot punch in without location access. Please enable location services.`;
        }
        const response = await fetch('/api/dvr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            action: 'punch-in',
            latitude: location.lat,
            longitude: location.lng,
            locationName: location.address || 'Field Location'
          })
        });
        const data = await response.json();
        if (data.success && data.action === 'punch-in') {
          setPunchState('punched-in');
          setPunchInData(data.data);

          let response = `✅ **PUNCH-IN SUCCESSFUL!**\n\n📍 **Location:** ${data.data.locationName}\n🕐 **Time:** ${new Date(data.data.checkInTime).toLocaleTimeString()}\n\n`;
          if (data.data.nearbyDealers && data.data.nearbyDealers.length > 0) {
            response += `🏪 **NEARBY DEALERS FOUND:**\n\n`;
            data.data.nearbyDealers.forEach((dealer: any, index: number) => {
              response += `${index + 1}. **${dealer.name}** (${dealer.distance})\n   ${dealer.type} | ${dealer.totalPotential}MT potential\n   Brands: ${dealer.brands?.join(', ') || 'N/A'}\n\n`;
            });
            response += `💡 **Next Steps:**\n📝 Select: "select dealer 1" or "select dealer 2"\n🆕 New: "new dealer [name]"\n📋 Direct: "Visited [dealer] for [purpose]"`;
          } else {
            response += `🆕 **NO EXISTING DEALERS AT THIS LOCATION**\n\n💡 **Next:** Describe your visit to auto-create dealer:\n"Visited [dealer name] for [purpose]"`;
          }
          return response;
        }
        return `❌ **Punch-in failed:** ${data.error || 'Unknown error'}`;
      }
      // 🆕 NEW: Handle dealer selection from nearby dealers
      if (punchState === 'punched-in' && lowerInput.startsWith('select dealer ')) {
        const dealerIndex = parseInt(lowerInput.replace('select dealer ', '')) - 1;
        if (punchInData?.nearbyDealers && punchInData.nearbyDealers[dealerIndex]) {
          const selectedDealer = punchInData.nearbyDealers[dealerIndex];
          setSelectedDealer(selectedDealer);
          return `✅ **DEALER SELECTED**\n\n🏪 **${selectedDealer.name}**\n📊 **Potential:** ${selectedDealer.totalPotential}MT\n🏢 **Brands:** ${selectedDealer.brands?.join(', ')}\n📞 **Contact:** ${selectedDealer.contactPerson || 'N/A'}\n\n💡 **Ready!** Now describe your visit:\n"Collection visit, got payment" or "Routine check, discussed new products"`;
        } else {
          return `❌ **Invalid dealer selection.** Please choose from 1 to ${punchInData?.nearbyDealers?.length || 0}.`;
        }
      }
      // 🆕 NEW: Handle new dealer creation
      if (punchState === 'punched-in' && lowerInput.startsWith('new dealer ')) {
        const newDealerName = input.replace(/new dealer /i, '').trim();
        if (newDealerName.length < 2) {
          return `❌ **Please provide a valid dealer name:**\n"new dealer ABC Construction"`;
        }
        setNewDealerName(newDealerName);
        return `🆕 **CREATING NEW DEALER**\n\n🏪 **Name:** ${newDealerName}\n\n💡 **Next:** Describe your visit and dealer details:\n"First visit to ${newDealerName}, 50MT potential, sells UltraTech"`;
      }
      // 🔄 ENHANCED: DVR completion with dealer context
      if (punchState === 'punched-in') {
        if (input.trim().length < 10) {
          return `📝 **Please provide more details about your visit:**\n\n💡 Examples:\n• "Collection visit, got ₹50K payment"\n• "Routine check, discussed new cement grades"\n• "Order booking, confirmed 30MT delivery"`;
        }
        const response = await fetch('/api/dvr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            action: 'complete-dvr',
            dvrPrompt: input,
            latitude: punchInData.latitude,
            longitude: punchInData.longitude,
            locationName: punchInData.locationName,
            checkInTime: punchInData.checkInTime,
            selectedDealerId: selectedDealer?.id || null,
            isNewDealer: !!newDealerName,
            newDealerInfo: newDealerName ? {
              name: newDealerName,
              type: 'Dealer'
            } : null
          })
        });
        const data = await response.json();
        if (data.success) {
          // Reset punch state
          setPunchState('ready');
          setPunchInData(null);
          setSelectedDealer(null);
          setNewDealerName(null);
          const dealerSource = data.dealerSource === 'existing_database' ? '(Database)' : '(AI Generated)';

          return `🎉 **DVR COMPLETED!**\n\n🏪 **Dealer:** ${data.data.dealerName} ${dealerSource}\n📅 **Date:** ${data.data.reportDate}\n💰 **Order:** ${data.data.todayOrderMt}MT\n💳 **Collection:** ₹${Number(data.data.todayCollectionRupees).toLocaleString()}\n🏢 **Brands:** ${data.data.brandSelling?.join(', ')}\n📍 **Location:** ${data.data.location}\n\n${data.newDealerCreated ? '🆕 **New dealer created in database**\n\n' : ''}💡 **Ready for next visit!** Type "punch in" to start.`;
        } else {
          return `❌ **DVR Creation Failed:** ${data.error}\n\n💡 Try describing your visit differently.`;
        }
      }
      // ✅ BACKWARD COMPATIBILITY: Traditional DVR creation (existing logic)
      const dealerName = extractDealerName(input);
      const visitPurpose = extractVisitPurpose(input);
      const visitOutcome = extractVisitOutcome(input);
      if (!dealerName) {
        return `⚠️ **Missing Information**\n\nPlease provide the **dealer name** you visited.\n\n💡 Examples:\n• "Visited ABC Dealers for routine check"\n• Or use new workflow: "punch in"`;
      }
      // ✅ SAFE: Query dealers database for validation
      let matchedDealer = null;
      try {
        const dealersResponse = await fetch(`/api/dealers/recent?userId=${userId}&limit=1000`);
        if (dealersResponse.ok) {
          const dealersData = await dealersResponse.json();
          if (dealersData.success && dealersData.data) {
            const searchName = dealerName.toLowerCase().trim();
            matchedDealer = dealersData.data.find((dealer: any) => {
              const dealerNameLower = dealer.name.toLowerCase();
              return dealerNameLower.includes(searchName) || searchName.includes(dealerNameLower);
            });
          }
        }
      } catch (dealerError) {
        console.log('Dealer lookup failed, continuing with user input:', dealerError);
      }
      // ✅ Traditional DVR creation
      const response = await fetch('/api/dvr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          dealerName: matchedDealer ? matchedDealer.name : dealerName,
          visitPurpose: visitPurpose || 'routine visit',
          visitOutcome: visitOutcome || undefined,
          latitude: currentLocation?.lat || 0,
          longitude: currentLocation?.lng || 0,
          locationName: currentLocation?.address || 'Field  Location',
          checkInTime: new Date().toISOString(),
          checkOutTime: null,
          inTimeImageUrl: null,
          outTimeImageUrl: null
        })
      });
      const data = await response.json();
      if (data.success) {
        const dealerStatus = matchedDealer
          ? `✅ **Found in Database** (${matchedDealer.type})`
          : `ℹ️ **New Dealer** (Added to report)`;
        return `✅ **DVR Created Successfully!**\n\n🏪 **Dealer:** ${data.data.dealerName}\n${dealerStatus}\n📅 **Date:** ${data.data.reportDate}\n🏷️ **Type:** ${data.data.dealerType} - ${data.data.visitType}\n💰 **Order:** ${data.data.todayOrderMt} MT\n💳 **Collection:** ₹${data.data.todayCollectionRupees}\n🏢 **Brands:** ${data.data.brandSelling?.join(', ') || 'N/A'}\n📍 **Location:** ${data.data.location}\n\n💡 **Try new workflow:** "punch in" for location-based visits!`;
      } else {
        return `⚠️ **DVR Creation Failed**\n\n${data.error || 'Unable to create DVR.'}\n\n💡 Try: "punch in" for enhanced workflow.`;
      }
    } catch (error: any) {
      console.error('DVR Creation Error:', error);
      return `❌ **Connection Error**\n\nUnable to create DVR. Please check your connection and try again.\n\n**Error:** ${error?.message || 'Unknown error'}`;
    } finally {
      setTypingIndicator(false);
    }
  };
  // 🆕 NEW: State variables needed (add these to your component state)
  const [punchState, setPunchState] = useState<'ready' | 'punched-in'>('ready');
  const [punchInData, setPunchInData] = useState<any>(null);
  const [selectedDealer, setSelectedDealer] = useState<any>(null);
  const [newDealerName, setNewDealerName] = useState<string | null>(null);
  // 🆕 NEW: Enhanced location function for precise GPS
  const getCurrentLocationPrecise = (): Promise<{ lat: number, lng: number, address?: string } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Current Location'
          });
        },
        (error) => {
          console.log('Location error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  // ✅ SIMPLE: Basic extraction functions (lightweight and safe)
  const extractDealerName = (input: string): string => {
    const patterns = [
      /visited\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+for|\s+to|,|\.|$)/i,
      /went\s+to\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+for|\s+to|,|\.|$)/i,
      /at\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+dealer|\s+for|,|\.|$)/i,
      /([^,\s]+(?:\s+[^,\s]+)*?)\s+dealer/i,
      /([^,\s]+(?:\s+[^,\s]+)*?)\s+construction/i,
      /([^,\s]+(?:\s+[^,\s]+)*?)\s+enterprises/i
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        return match[1].trim();
      }
    }

    // ✅ FALLBACK: If no pattern matches, try to extract first meaningful word(s)
    const words = input.split(/\s+/).filter(word =>
      word.length > 2 &&
      !['visited', 'went', 'for', 'the', 'and', 'with', 'routine', 'collection', 'order'].includes(word.toLowerCase())
    );

    return words.slice(0, 2).join(' ') || '';
  };

  const extractVisitPurpose = (input: string): string => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('collection') || lowerInput.includes('collect')) return 'collection';
    if (lowerInput.includes('order') || lowerInput.includes('booking')) return 'order taking';
    if (lowerInput.includes('complaint') || lowerInput.includes('issue') || lowerInput.includes('problem')) return 'complaint resolution';
    if (lowerInput.includes('new') || lowerInput.includes('onboard')) return 'new dealer onboarding';

    return 'routine visit';
  };

  const extractVisitOutcome = (input: string): string => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('good') || lowerInput.includes('successful') || lowerInput.includes('positive')) return 'good';
    if (lowerInput.includes('poor') || lowerInput.includes('bad') || lowerInput.includes('negative')) return 'poor';
    if (lowerInput.includes('average') || lowerInput.includes('okay') || lowerInput.includes('normal')) return 'average';

    return '';
  };

  // ✅ ALREADY PERFECT - Uses your /api/dvr/recent endpoint optimally
  const handleRecentDVR = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/dvr/recent?userId=${userId}&limit=5`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        let recent = `📊 **Recent DVR Reports**\n\n`;

        data.data.forEach((dvr: any, index: number) => {
          const date = new Date(dvr.reportDate).toLocaleDateString();
          recent += `${index + 1}. **${dvr.dealerName}** (${date})\n   Order: ${dvr.todayOrderMt} MT | Collection: ₹${dvr.todayCollectionRupees}\n\n`;
        });

        return recent + `📈 **Total Reports:** ${data.total}\n\n💡 Need to create a new DVR? Just describe your dealer visit!`;
      } else {
        return `📊 **No DVR reports found.**\n\n💡 Start creating DVRs by describing your dealer visits!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch DVR reports.**\n\nPlease try again later.`;
    }
  };

  // ✅ ALREADY PERFECT - Uses your /api/dvr/recent endpoint with analytics
  const handleDVRAnalytics = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/dvr/recent?userId=${userId}&limit=30`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const totalOrders = data.data.reduce((sum: number, dvr: any) => sum + parseFloat(dvr.todayOrderMt || '0'), 0);
        const totalCollection = data.data.reduce((sum: number, dvr: any) => sum + parseFloat(dvr.todayCollectionRupees || '0'), 0);
        const avgOrder = totalOrders / data.data.length;

        return `📈 **DVR Analytics (Last 30 Days)**\n\n📊 **Total Reports:** ${data.data.length}\n💰 **Total Orders:** ${totalOrders.toLocaleString()} MT\n💳 **Total Collection:** ₹${totalCollection.toLocaleString()}\n📊 **Average Order:** ${avgOrder.toFixed(2)} MT\n🎯 **Performance:** ${data.data.length > 20 ? 'Excellent!' : 'Good progress!'}\n\n💡 Keep up the great work with dealer visits!`;
      } else {
        return `📊 **No DVR data available.**\n\nStart creating DVRs to see your analytics!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch DVR analytics.**\n\nPlease try again later.`;
    }
  };
  // 🔧 TVR HANDLERS
  const handleCreateTVR = async (input: string): Promise<string> => {
    setTypingIndicator(true);

    try {
      const response = await fetch('/api/tvr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useAI: true,
          userInput: input,
          userId,
          location: currentLocation,
          siteName: extractSiteName(input),
          visitType: 'Maintenance'
        })
      });

      const data = await response.json();

      if (data.success) {
        return `✅ **TVR Created Successfully!**\n\n🏢 **Site:** ${data.data.siteNameConcernedPerson}\n🔧 **Work Type:** ${data.data.visitType}\n⚡ **Issue:** ${data.data.technicalIssue}\n✅ **Service:** ${data.data.serviceProvided}\n📝 **Feedback:** ${data.data.customerFeedback}\n\n📝 **Report ID:** ${data.data.id}\n${data.aiGenerated ? '🤖 **AI Generated:** Technical details formatted professionally!' : ''}\n\n🎉 Your TVR is ready and logged!`;
      } else {
        return `⚠️ **TVR Creation Issue**\n\n${data.error || 'Unable to create TVR.'}\n\n💡 Try describing the technical work you performed.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to create TVR. Please check your connection.`;
    } finally {
      setTypingIndicator(false);
    }
  };

  const handleRecentTVR = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/tvr/recent?userId=${userId}&limit=5`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        let recent = `🔧 **Recent TVR Reports**\n\n`;

        data.data.forEach((tvr: any, index: number) => {
          const date = new Date(tvr.reportDate).toLocaleDateString();
          recent += `${index + 1}. **${tvr.siteNameConcernedPerson}** (${date})\n   Type: ${tvr.visitType} | Issue: ${tvr.technicalIssue.substring(0, 50)}...\n\n`;
        });

        return recent + `📈 **Total Reports:** ${data.total}\n\n💡 Need to create a new TVR? Describe your technical work!`;
      } else {
        return `🔧 **No TVR reports found.**\n\n💡 Start creating TVRs by describing your technical work!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch TVR reports.**\n\nPlease try again later.`;
    }
  };

  // 🏢 DEALER HANDLERS
  const handleFindDealer = async (input: string): Promise<string> => {
    try {
      // Extract search terms from input
      const searchTerm = input.replace(/find|search|locate|dealer/gi, '').trim();

      const response = await fetch(`/api/dealers/search?q=${encodeURIComponent(searchTerm)}&limit=10`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        let results = `🔍 **Dealer Search Results**\n\n`;

        data.data.forEach((dealer: any, index: number) => {
          results += `${index + 1}. **${dealer.name}**\n   📱 ${dealer.phone || 'N/A'} | 📧 ${dealer.email || 'N/A'}\n   📍 ${dealer.address || 'No address'}\n\n`;
        });

        return results + `📊 Found ${data.data.length} dealers\n\n💡 Need more details about a specific dealer? Just ask!`;
      } else {
        return `🔍 **No dealers found** matching "${searchTerm}"\n\n💡 Try a different search term or add a new dealer if needed.`;
      }
    } catch (error) {
      return `❌ **Unable to search dealers.**\n\nPlease try again later.`;
    }
  };

  const handleAddDealer = async (input: string): Promise<string> => {
    // Extract dealer info from natural language
    const nameMatch = input.match(/name\s+([^,\n]+)/i) || input.match(/dealer\s+([^,\n]+)/i);
    const phoneMatch = input.match(/phone\s+([0-9\-\+\s]+)/i) || input.match(/mobile\s+([0-9\-\+\s]+)/i);
    const emailMatch = input.match(/email\s+([^\s,\n]+)/i);

    if (!nameMatch) {
      return `⚠️ **Missing Dealer Name**\n\n💡 Please provide the dealer name. Example:\n"Add dealer ABC Store, phone 9876543210, email abc@store.com"`;
    }

    try {
      const response = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameMatch[1].trim(),
          phone: phoneMatch ? phoneMatch[1].trim() : null,
          email: emailMatch ? emailMatch[1].trim() : null,
          address: 'To be updated',
          dealerType: 'Dealer',
          contactPerson: nameMatch[1].trim(),
          addedBy: userId
        })
      });

      const data = await response.json();

      if (data.success) {
        return `✅ **Dealer Added Successfully!**\n\n🏢 **Name:** ${data.data.name}\n📱 **Phone:** ${data.data.phone || 'Not provided'}\n📧 **Email:** ${data.data.email || 'Not provided'}\n📝 **ID:** ${data.data.id}\n\n🎉 Dealer is now in your system and ready for visits!`;
      } else {
        return `⚠️ **Dealer Addition Failed**\n\n${data.error || 'Unable to add dealer.'}\n\n💡 Please check the dealer information and try again.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to add dealer. Please check your connection.`;
    }
  };

  const handleDealerAnalytics = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/dealers/recent?limit=100`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const totalDealers = data.total;
        const activeDealers = data.data.filter((d: any) => d.isActive !== false).length;

        return `📊 **Dealer Analytics**\n\n🏢 **Total Dealers:** ${totalDealers}\n✅ **Active Dealers:** ${activeDealers}\n📈 **Growth Rate:** ${totalDealers > 50 ? 'Excellent' : 'Growing'}\n\n💡 **Performance:** Your dealer network is ${totalDealers > 100 ? 'impressive!' : 'expanding!'}`;
      } else {
        return `📊 **No dealer data available.**\n\nStart adding dealers to see analytics!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch dealer analytics.**\n\nPlease try again later.`;
    }
  };

  // 🏖️ LEAVE HANDLERS
  const handleApplyLeave = async (input: string): Promise<string> => {
    // Extract leave information from natural language
    const daysMatch = input.match(/(\d+)\s*days?/i);
    const fromMatch = input.match(/from\s+([^\s,]+)/i) || input.match(/starting\s+([^\s,]+)/i);
    const reasonMatch = input.match(/for\s+([^,\n]+)/i) || input.match(/because\s+([^,\n]+)/i);

    const days = daysMatch ? parseInt(daysMatch[1]) : 1;
    const startDate = fromMatch ? fromMatch[1] : 'tomorrow';
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Personal work';

    // Calculate dates
    const start = new Date();
    if (startDate === 'tomorrow') {
      start.setDate(start.getDate() + 1);
    } else if (startDate === 'today') {
      // start is already today
    } else {
      // Try to parse the date
      const parsed = new Date(startDate);
      if (!isNaN(parsed.getTime())) {
        start.setTime(parsed.getTime());
      }
    }

    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);

    try {
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          leaveType: 'Casual Leave',
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          reason: reason
        })
      });

      const data = await response.json();

      if (data.success) {
        return `✅ **Leave Application Submitted!**\n\n📅 **Duration:** ${days} day(s)\n📆 **From:** ${start.toLocaleDateString()}\n📆 **To:** ${end.toLocaleDateString()}\n📝 **Reason:** ${reason}\n🔄 **Status:** Pending Approval\n📝 **Application ID:** ${data.data.id}\n\n⏰ You'll be notified once your leave is reviewed.`;
      } else {
        return `⚠️ **Leave Application Failed**\n\n${data.error || 'Unable to submit leave application.'}\n\n💡 Please check for overlapping leave dates.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to submit leave application. Please check your connection.`;
    }
  };

  const handleLeaveStatus = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/leave/user/${userId}?limit=10`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const pending = data.data.filter((l: any) => l.status === 'Pending').length;
        const approved = data.data.filter((l: any) => l.status === 'Approved').length;
        const rejected = data.data.filter((l: any) => l.status === 'Rejected').length;

        let status = `📊 **Leave Status Summary**\n\n`;
        status += `⏰ **Pending:** ${pending}\n`;
        status += `✅ **Approved:** ${approved}\n`;
        status += `❌ **Rejected:** ${rejected}\n\n`;

        if (pending > 0) {
          status += `🔄 **Latest Pending Applications:**\n`;
          data.data.filter((l: any) => l.status === 'Pending').slice(0, 3).forEach((leave: any, index: number) => {
            const start = new Date(leave.startDate).toLocaleDateString();
            const end = new Date(leave.endDate).toLocaleDateString();
            status += `${index + 1}. ${start} to ${end} - ${leave.reason}\n`;
          });
        }

        return status + `\n💡 Need to apply for more leave? Just describe when and why!`;
      } else {
        return `📊 **No leave applications found.**\n\n💡 Apply for leave by saying something like "Need 2 days leave from tomorrow for family function"`;
      }
    } catch (error) {
      return `❌ **Unable to fetch leave status.**\n\nPlease try again later.`;
    }
  };

  const handleLeaveHistory = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/leave/user/${userId}?limit=20`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        let history = `📅 **Leave History**\n\n`;

        data.data.slice(0, 10).forEach((leave: any, index: number) => {
          const start = new Date(leave.startDate).toLocaleDateString();
          const end = new Date(leave.endDate).toLocaleDateString();
          const statusIcon = leave.status === 'Approved' ? '✅' : leave.status === 'Rejected' ? '❌' : '⏰';

          history += `${index + 1}. ${statusIcon} **${start} to ${end}**\n   Reason: ${leave.reason}\n   Status: ${leave.status}\n\n`;
        });

        return history + `📊 **Total Applications:** ${data.total}`;
      } else {
        return `📅 **No leave history found.**\n\nStart applying for leave to build your history!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch leave history.**\n\nPlease try again later.`;
    }
  };

  // 🏆 COMPETITION HANDLERS
  const handleCompetitionAnalysis = async (input: string): Promise<string> => {
    setTypingIndicator(true);

    try {
      const response = await fetch('/api/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useAI: true,
          userInput: input,
          userId,
          brandName: extractBrandName(input),
        })
      });

      const data = await response.json();

      if (data.success) {
        return `🏆 **Competition Report Created!**\n\n🏢 **Brand:** ${data.data.brandName}\n💰 **Billing:** ${data.data.billing}\n📊 **NOD:** ${data.data.nod}\n🏪 **Retail:** ${data.data.retail}\n🎯 **Schemes:** ${data.data.schemesYesNo}\n💵 **Avg Scheme Cost:** ₹${data.data.avgSchemeCost}\n📝 **Remarks:** ${data.data.remarks}\n\n📝 **Report ID:** ${data.data.id}\n${data.aiGenerated ? '🤖 **AI Analyzed:** Market intelligence processed!' : ''}\n\n📈 Your competitive intelligence is updated!`;
      } else {
        return `⚠️ **Competition Report Issue**\n\n${data.error || 'Unable to create competition report.'}\n\n💡 Try providing competitor brand and market observations.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to create competition report. Please check your connection.`;
    } finally {
      setTypingIndicator(false);
    }
  };

  const handleMarketTrends = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/competition/analysis/${userId}?days=30`);
      const data = await response.json();

      if (data.success) {
        const analysis = data.analysis;

        return `📈 **Market Trends Analysis**\n\n📊 **Total Reports:** ${analysis.totalReports}\n🏢 **Unique Brands:** ${analysis.uniqueBrands}\n🎯 **With Schemes:** ${analysis.schemesAnalysis.withSchemes}\n💵 **Avg Scheme Cost:** ₹${analysis.avgSchemeCost.overall.toFixed(0)}\n\n🔥 **Recent Trends:**\n${analysis.recentTrends.map((trend: any, index: number) =>
          `${index + 1}. ${trend.brand} - ${trend.hasSchemes ? '🎯 Scheme Active' : '📊 No Schemes'} (${new Date(trend.date).toLocaleDateString()})`
        ).join('\n')}\n\n💡 Keep monitoring competition for market advantage!`;
      } else {
        return `📊 **No competition data available.**\n\nStart reporting competitor activities to see trends!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch market trends.**\n\nPlease try again later.`;
    }
  };

  // ✅ TASK HANDLERS
  const handleShowTasks = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/tasks/recent?userId=${userId}&limit=10`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const pending = data.data.filter((t: any) => t.status === 'pending');
        const completed = data.data.filter((t: any) => t.status === 'completed');

        let tasks = `✅ **Your Tasks Overview**\n\n📋 **Pending Tasks (${pending.length}):**\n`;

        if (pending.length > 0) {
          pending.slice(0, 5).forEach((task: any, index: number) => {
            tasks += `${index + 1}. **${task.title}**\n   Due: ${new Date(task.dueDate).toLocaleDateString()}\n   Priority: ${task.priority}\n\n`;
          });
        } else {
          tasks += `🎉 All caught up! No pending tasks.\n\n`;
        }

        tasks += `✅ **Completed: ${completed.length}**\n\n💡 Need to update a task? Just say "mark task [title] complete"`;

        return tasks;
      } else {
        return `📋 **No tasks found.**\n\n💡 Create tasks by saying "create task for dealer follow-up tomorrow"`;
      }
    } catch (error) {
      return `❌ **Unable to fetch tasks.**\n\nPlease try again later.`;
    }
  };

  const handleCreateTask = async (input: string): Promise<string> => {
    // Extract task information from natural language
    const titleMatch = input.match(/task\s+for\s+([^,\n]+)/i) || input.match(/create\s+([^,\n]+)/i);
    const dueDateMatch = input.match(/(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    const priorityMatch = input.match(/(urgent|high|medium|low)\s+priority/i);

    const title = titleMatch ? titleMatch[1].trim() : 'New Task';
    const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';

    // Calculate due date
    const dueDate = new Date();
    if (dueDateMatch) {
      const dateStr = dueDateMatch[1].toLowerCase();
      if (dateStr === 'tomorrow') {
        dueDate.setDate(dueDate.getDate() + 1);
      } else if (dateStr === 'next week') {
        dueDate.setDate(dueDate.getDate() + 7);
      }
      // Add more date parsing as needed
    } else {
      dueDate.setDate(dueDate.getDate() + 1); // Default to tomorrow
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: title,
          description: `Task created via AI: ${input}`,
          dueDate: dueDate.toISOString().split('T')[0],
          priority: priority,
          status: 'pending',
          taskType: 'general'
        })
      });

      const data = await response.json();

      if (data.success) {
        return `✅ **Task Created Successfully!**\n\n📋 **Title:** ${data.data.title}\n📅 **Due Date:** ${new Date(data.data.dueDate).toLocaleDateString()}\n🎯 **Priority:** ${data.data.priority}\n📝 **Task ID:** ${data.data.id}\n\n⏰ You'll be reminded as the due date approaches!`;
      } else {
        return `⚠️ **Task Creation Failed**\n\n${data.error || 'Unable to create task.'}\n\n💡 Please try again with task details.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to create task. Please check your connection.`;
    }
  };

  const handleCompleteTask = async (input: string): Promise<string> => {
    // Extract task identifier from input
    const taskMatch = input.match(/task\s+(\d+)/i) || input.match(/mark\s+([^,\n]+)\s+complete/i);

    if (!taskMatch) {
      return `⚠️ **Task Not Specified**\n\n💡 Please specify which task to complete. Example:\n"Mark task 123 complete" or "Complete dealer follow-up task"`;
    }

    const taskIdentifier = taskMatch[1].trim();

    try {
      // First, get the task list to find matching task
      const listResponse = await fetch(`/api/tasks/recent?userId=${userId}&limit=50`);
      const listData = await listResponse.json();

      if (listData.success && listData.data.length > 0) {
        // Find task by ID or title
        const task = listData.data.find((t: any) =>
          t.id === taskIdentifier ||
          t.title.toLowerCase().includes(taskIdentifier.toLowerCase())
        );

        if (!task) {
          return `⚠️ **Task Not Found**\n\n💡 Couldn't find task matching "${taskIdentifier}". Try being more specific.`;
        }

        // Update task status
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            completedAt: new Date().toISOString()
          })
        });

        const data = await response.json();

        if (data.success) {
          return `✅ **Task Completed!**\n\n📋 **Task:** ${task.title}\n🕐 **Completed:** ${new Date().toLocaleTimeString()}\n📅 **Due Date:** ${new Date(task.dueDate).toLocaleDateString()}\n\n🎉 Great job! Task marked as complete.`;
        } else {
          return `⚠️ **Task Update Failed**\n\n${data.error || 'Unable to update task status.'}\n\n💡 Please try again.`;
        }
      } else {
        return `📋 **No tasks found**\n\nCreate some tasks first to mark them complete!`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to update task. Please check your connection.`;
    }
  };

  // 🔍 GENERAL HELPERS
  const getGeneralHelp = (ctx: string): string => {
    return `🤖 **AI Assistant Help**\n\n🎯 **Current Context:** ${ctx.replace('_', ' ')}\n\n💡 **How to use me:**\n• Speak naturally about what you need\n• Use the quick action buttons\n• I understand context and connect to the right systems\n\n⚡ **Examples for ${ctx}:**\n${getExamplesForContext(ctx)}\n\n🚀 **Pro Tip:** I'm connected to 56+ endpoints and can handle complex requests!`;
  };

  const getExamplesForContext = (ctx: string): string => {
    switch (ctx) {
      case 'dvr':
        return '• "Visited ABC Store, got 10k order"\n• "Create DVR for dealer meeting"\n• "Show my recent visits"';
      case 'tvr':
        return '• "Fixed AC at hotel, customer happy"\n• "Technical visit to repair system"\n• "Generate TVR for maintenance work"';
      case 'journey':
        return '• "Start journey to XYZ dealer"\n• "Show my route analytics"\n• "End current journey"';
      case 'attendance':
        return '• "Punch in"\n• "Check my attendance status"\n• "Show weekly report"';
      default:
        return '• Ask natural questions\n• Use context-specific commands\n• Combine multiple requests';
    }
  };

  const handleGeneralAnalytics = async (): Promise<string> => {
    try {
      // Fetch data from multiple endpoints for comprehensive analytics
      const [attendanceRes, journeyRes, dvrRes, tvrRes] = await Promise.all([
        fetch(`/api/attendance/recent?userId=${userId}&limit=30`),
        fetch(`/api/journey/analytics/${userId}?days=30`),
        fetch(`/api/dvr/recent?userId=${userId}&limit=30`),
        fetch(`/api/tvr/recent?userId=${userId}&limit=30`)
      ]);

      const [attendance, journey, dvr, tvr] = await Promise.all([
        attendanceRes.json(),
        journeyRes.json(),
        dvrRes.json(),
        tvrRes.json()
      ]);

      let analytics = `📊 **Comprehensive Analytics (Last 30 Days)**\n\n`;

      if (attendance.success) {
        analytics += `🕐 **Attendance:** ${attendance.data.length} days\n`;
      }

      if (journey.success) {
        analytics += `🗺️ **Journeys:** ${journey.analytics.totalJourneys} (${journey.analytics.totalDistance})\n`;
      }

      if (dvr.success) {
        const totalOrders = dvr.data.reduce((sum: number, d: any) => sum + parseFloat(d.todayOrderMt || '0'), 0);
        analytics += `📊 **DVR Reports:** ${dvr.data.length} (₹${totalOrders.toLocaleString()} orders)\n`;
      }

      if (tvr.success) {
        analytics += `🔧 **TVR Reports:** ${tvr.data.length}\n`;
      }

      analytics += `\n🎯 **Performance Rating:** ${getPerformanceRating(attendance.data?.length || 0, (dvr.data?.length || 0) + (tvr.data?.length || 0))}\n\n💡 Keep up the excellent work!`;

      return analytics;
    } catch (error) {
      return `❌ **Unable to fetch comprehensive analytics.**\n\nPlease try again later.`;
    }
  };

  const getPerformanceRating = (attendanceDays: number, totalReports: number): string => {
    const score = (attendanceDays * 2) + (totalReports * 3);
    if (score > 150) return '🌟 Outstanding!';
    if (score > 100) return '🚀 Excellent!';
    if (score > 50) return '👍 Good!';
    return '💪 Keep improving!';
  };

  const extractSiteName = (input: string): string => {
    const siteMatch = input.match(/(?:at|site|location)\s+([A-Za-z\s]+?)(?:\s|,|$)/i);
    return siteMatch ? siteMatch[1].trim() : 'Customer Site';
  };

  const extractBrandName = (input: string): string => {
    const brandMatch = input.match(/(?:brand|competitor)\s+([A-Za-z\s]+?)(?:\s|,|$)/i);
    return brandMatch ? brandMatch[1].trim() : 'Competitor Brand';
  };

  // 🎮 UI EVENT HANDLERS
  const handleQuickAction = async (action: string) => {
    if (isMinimized) {
      setIsMinimized(false);
      setIsExpanded(true);
    }
    setInputValue(action);
    await handleSendMessage(action);
  };

  const handleActionButton = async (action: string) => {
    await handleQuickAction(action);
  };

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
    if (isMinimized) {
      setIsExpanded(false);
    }
  };

  const toggleExpanded = () => {
    if (isMinimized) {
      setIsMinimized(false);
    }
    setIsExpanded(!isExpanded);
  };


  const handleSendMessage = async (customInput?: string) => {
    const currentInput = customInput || inputValue;
    if (!currentInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentInput,
      timestamp: new Date(),
      context
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customInput) setInputValue('');
    setIsLoading(true);

    try {
      setTypingIndicator(true);

      // Add a small delay to show typing indicator
      await new Promise(resolve => setTimeout(resolve, 500));

      const aiResponse = await processUserRequest(currentInput, context);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
        context,
        actionButtons: getContextActionButtons(context)
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '❌ **System Error**\n\nI encountered an issue connecting to the CRM systems. Please check your connection and try again.\n\n💡 **Quick Fix:** Try one of the quick action buttons instead.',
        timestamp: new Date(),
        context
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getContextIcon = (ctx: string) => {
    switch (ctx) {
      case 'attendance': return <Clock className="w-4 h-4" />;
      case 'tasks': return <CheckCircle className="w-4 h-4" />;
      case 'journey': return <Route className="w-4 h-4" />;
      case 'dealers': return <Building2 className="w-4 h-4" />;
      case 'dvr': return <FileText className="w-4 h-4" />;
      case 'tvr': return <Zap className="w-4 h-4" />;
      case 'competition': return <TrendingUp className="w-4 h-4" />;
      case 'leave': return <Calendar className="w-4 h-4" />;
      case 'location_punch': return <MapPin className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  // 📱 RENDER COMPONENTS
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={toggleMinimized}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-xl animate-pulse"
        >
          <div className="relative">
            <Bot className="w-7 h-7 text-white" />
            <Sparkles className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1 animate-bounce" />
          </div>
        </Button>
      </div>
    );
  }

  return (
  <div className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl transition-all duration-300 z-40 ${isExpanded ? 'h-[85vh]' : 'h-auto'}`}>
    {/* 🎨 Enhanced Header */}
    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Badge variant="default" className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600">
              {getContextIcon(context)}
              <span className="capitalize font-semibold text-white">{context.replace('_', ' ')} AI</span>
            </Badge>
            <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
          </div>

          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            <Zap className="w-3 h-3 mr-1" />
            56+ Endpoints
          </Badge>

          {recentData && (
            <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
              <BarChart3 className="w-3 h-3 mr-1" />
              Live Data
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {currentLocation && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
              <MapPin className="w-3 h-3 mr-1" />
              GPS Active
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={toggleExpanded}
            className="p-2 hover:bg-blue-50"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleMinimized}
            className="p-2 hover:bg-red-50"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 🚀 Quick Action Buttons - Enhanced */}
      {!isExpanded && (
        <div className="flex space-x-2 mt-3 overflow-x-auto pb-2">
          {context === 'dvr' && punchState === 'ready' ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleSendMessage('punch in')}
                className="whitespace-nowrap text-xs font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700"
              >
                📍 Punch In
              </Button>
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className="whitespace-nowrap text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                >
                  {action}
                </Button>
              ))}
            </>
          ) : context === 'dvr' && punchState === 'punched-in' ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => setInputValue('Collection visit, got payment')}
                className="whitespace-nowrap text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              >
                💰 Collection
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setInputValue('Routine check, discussed products')}
                className="whitespace-nowrap text-xs font-medium bg-gradient-to-r from-orange-600 to-red-600 text-white"
              >
                🔄 Routine
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setInputValue('Order booking, confirmed delivery')}
                className="whitespace-nowrap text-xs font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              >
                📋 Order
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPunchState('ready');
                  setPunchInData(null);
                  setSelectedDealer(null);
                  setNewDealerName(null);
                }}
                className="whitespace-nowrap text-xs font-medium border-red-200 text-red-700 hover:bg-red-50"
              >
                ❌ Cancel
              </Button>
            </>
          ) : (
            quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                className="whitespace-nowrap text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
              >
                {action}
              </Button>
            ))
          )}
        </div>
      )}
    </div>

    {/* 💬 Messages Area - Enhanced */}
    {isExpanded && messages.length > 0 && (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white max-h-[60vh]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm transition-all hover:shadow-md ${message.type === 'user'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
                }`}
            >
              <div className="flex items-start space-x-3">
                {message.type === 'ai' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                  {/* 🎯 Action Buttons for AI messages */}
                  {message.type === 'ai' && message.actionButtons && message.actionButtons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.actionButtons.map((button, index) => (
                        <Button
                          key={index}
                          variant={button.variant}
                          size="sm"
                          onClick={() => handleActionButton(button.action)}
                          className="text-xs"
                        >
                          {button.icon && <span className="mr-1">{button.icon}</span>}
                          {button.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs opacity-75 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* 💭 Typing Indicator */}
        {typingIndicator && (
          <div className="flex justify-start">
            <div className="max-w-xs px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    )}

    {/* 🚀 Quick Actions - Expanded View */}
    {isExpanded && (
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="flex space-x-2 overflow-x-auto">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action)}
              className="whitespace-nowrap text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              {action}
            </Button>
          ))}
        </div>
      </div>
    )}

    {/* 💬 Input Area - Enhanced */}
    <div className="p-4 bg-white">
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => !isExpanded && setIsExpanded(true)}
            placeholder={`🚀 Ask about ${context.replace('_', ' ')}... I'll connect to the right systems!`}
            disabled={isLoading}
            className="w-full pr-12 py-3 text-sm border-2 border-gray-200 focus:border-blue-500 rounded-xl bg-gray-50 focus:bg-white transition-all"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="flex items-center space-x-1">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <Zap className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        </div>

        <Button
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputValue.trim()}
          size="lg"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-lg"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-500">
          • AI-powered responses • Real-time data
        </p>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            <Heart className="w-3 h-3 mr-1" />
            {messages.length} messages
          </Badge>
        </div>
      </div>
    </div>
  </div>
);}