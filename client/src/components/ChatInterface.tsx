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
  MessageSquare, PlusCircle, Search, Filter, RefreshCw, Eye, Edit, Trash2, Phone, 
  Navigation, ArrowUp, ArrowDown, CheckCircle2, XCircle, Clock3, Wifi, WifiOff
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'action';
  content: string;
  timestamp: Date;
  context?: string;
  data?: any;
  actionButtons?: ActionButton[];
  isSuccess?: boolean;
  isError?: boolean;
  isStreaming?: boolean;
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
  const [aiPersonality, setAiPersonality] = useState('professional');
  
  // 🚀 NEW DVR WORKFLOW STATE
  const [punchState, setPunchState] = useState<'ready' | 'punched-in' | 'dealer-selection' | 'creating-dvr'>('ready');
  const [punchInData, setPunchInData] = useState<any>(null);
  const [selectedDealer, setSelectedDealer] = useState<any>(null);
  const [newDealerName, setNewDealerName] = useState<string | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isMinimized && messages.length === 0) {
      initializeContext();
    }
  }, [context, isMinimized, userId]);

  // 🚀 ENHANCED CONTEXT INITIALIZATION
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

    await fetchContextData(context);
  };

  // 🎯 ENHANCED DATA FETCHING
  const fetchContextData = async (ctx: string) => {
    try {
      let data = null;

      switch (ctx) {
        case 'attendance':
          const attendanceRes = await fetch(`/api/attendance/today/${userId}`);
          data = await attendanceRes.json();
          setRecentData(data);
          break;

        case 'journey':
          const journeyRes = await fetch(`/api/journey/active/${userId}`);
          data = await journeyRes.json();
          setRecentData(data);
          break;

        case 'dvr':
          const dvrRes = await fetch(`/api/dvr/recent?userId=${userId}&limit=5`);
          data = await dvrRes.json();
          setRecentData(data);
          break;

        case 'tvr':
          const tvrRes = await fetch(`/api/tvr/recent?userId=${userId}&limit=5`);
          data = await tvrRes.json();
          setRecentData(data);
          break;

        case 'dealers':
          const dealersRes = await fetch(`/api/dealers/recent?limit=10`);
          data = await dealersRes.json();
          setRecentData(data);
          break;

        case 'leave':
          const leaveRes = await fetch(`/api/leave/user/${userId}?limit=5`);
          data = await leaveRes.json();
          setRecentData(data);
          break;

        case 'competition':
          const compRes = await fetch(`/api/competition/recent?userId=${userId}&limit=5`);
          data = await compRes.json();
          setRecentData(data);
          break;

        case 'tasks':
          const tasksRes = await fetch(`/api/tasks/recent?userId=${userId}&limit=10`);
          data = await tasksRes.json();
          setRecentData(data);
          break;
      }
    } catch (error) {
      console.error('Error fetching context data:', error);
      setIsConnected(false);
    }
  };

  // 🤖 ENHANCED WELCOME MESSAGES
  const getContextWelcomeMessage = async (ctx: string): Promise<string> => {
    const timeOfDay = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';

    switch (ctx) {
      case 'dvr':
        return `🏪 **DVR Creation Wizard!**\n\n🌟 Good ${timeOfDay}! Ready for field excellence?\n\n🚀 **SMART WORKFLOW:**\n📍 **Step 1:** Tap "Punch In" at dealer location\n🏢 **Step 2:** Auto-detect or create dealer\n📝 **Step 3:** Describe visit naturally\n\n💡 **AI Magic:** "Visited ABC Store, got ₹50K order, customer happy with new cement grades"\n\n📊 **Recent:** ${recentData?.total || 0} DVRs this week\n\n✨ **Mobile-optimized for perfect field experience!**`;

      case 'attendance':
        return `⏰ **Attendance Command Center!**\n\n🌟 Good ${timeOfDay}!\n\n📊 **Today's Status:**\n${recentData?.hasAttendance ? '✅ You\'re checked in!' : '⏰ Ready to punch in?'}\n\n🚀 **Smart Actions:**\n• One-tap punch in/out\n• Live GPS tracking\n• Instant status updates\n• Weekly analytics\n\n💡 **Voice Ready:** Just say "punch in" and I'll handle everything!\n\n📱 **Touch-optimized for mobile efficiency!**`;

      case 'journey':
        return `🗺️ **Journey Intelligence Hub!**\n\n🚗 **Current Status:**\n${recentData?.hasActiveJourney ? '🔥 Journey in progress!' : '🏁 Ready for new adventure'}\n\n⚡ **AI-Powered Features:**\n• Smart route optimization\n• Auto dealer detection\n• Real-time tracking\n• Journey analytics\n\n🎯 **Natural Commands:** "Start journey to ABC Dealer" or "Show route history"\n\n📱 **GPS-optimized for field navigation!**`;

      default:
        return `🤖 **Ultimate CRM AI Assistant!**\n\n💪 **Connected to 56+ Endpoints**\n🧠 **AI-Powered Everything**\n📱 **Mobile-First Design**\n\n🌟 **Available Modules:**\n• 📊 Reports (DVR/TVR/Competition)\n• 🕐 Attendance & Leave\n• 🗺️ Journey Tracking\n• 🏢 Dealer Management\n• ✅ Task Management\n\n💫 **Just speak naturally!** I understand context and connect to the right systems automatically.\n\n🎯 **Try:** "Create DVR for my visit" or "Show my attendance"`;
    }
  };

  // 🎯 ENHANCED QUICK ACTIONS
  const getQuickActions = (ctx: string): string[] => {
    switch (ctx) {
      case 'dvr':
        return punchState === 'ready' 
          ? ['📍 Punch In', '📊 Recent DVRs', '📈 Analytics', '🔄 Sync']
          : punchState === 'punched-in'
          ? ['💰 Collection', '🔄 Routine', '📋 Order', '❌ Cancel']
          : ['📝 Complete DVR', '🔄 Start Over'];
      case 'attendance':
        return ['📍 Punch In', '📊 Status', '📈 Weekly', '📤 Export'];
      case 'journey':
        return ['🚗 Start Journey', '📍 Status', '📊 Analytics', '🗺️ History'];
      default:
        return ['🚀 Quick Start', '📊 Dashboard', '🔍 Search', '⚙️ Settings'];
    }
  };

  // 🎨 ENHANCED ACTION BUTTONS
  const getContextActionButtons = (ctx: string): ActionButton[] => {
    switch (ctx) {
      case 'dvr':
        if (punchState === 'ready') {
          return [
            { label: 'Punch In', action: 'punch in', variant: 'default', icon: <MapPin className="w-4 h-4" /> },
            { label: 'Recent DVRs', action: 'show recent dvrs', variant: 'outline', icon: <Eye className="w-4 h-4" /> }
          ];
        } else if (punchState === 'punched-in') {
          return [
            { label: 'Collection Visit', action: 'Collection visit, received payment of ₹50000', variant: 'default', icon: <Target className="w-4 h-4" /> },
            { label: 'Routine Check', action: 'Routine check, discussed new cement products and market situation', variant: 'outline', icon: <RefreshCw className="w-4 h-4" /> }
          ];
        }
        return [];
      default:
        return [
          { label: 'Help', action: 'help', variant: 'outline', icon: <MessageSquare className="w-4 h-4" /> }
        ];
    }
  };

  // 🔥 REVOLUTIONARY DVR HANDLER - HOOKS TO YOUR EXACT API
  const handleDVRWorkflow = async (input: string): Promise<string> => {
    setTypingIndicator(true);
    
    try {
      const trimmedInput = input.toLowerCase().trim();

      // 🚀 STEP 1: PUNCH IN WITH DEALER DETECTION
      if (trimmedInput === 'punch in' || trimmedInput === 'punch-in') {
        if (!currentLocation) {
          return `📍 **GPS Required**\n\n🛰️ Please enable location services to punch in.\n\n💡 **Why?** I need your exact coordinates to detect nearby dealers and create accurate DVRs.`;
        }

        setWorkflowProgress(25);

        const response = await fetch('/api/dvr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'punch-in',
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            userId: userId
          })
        });

        const data = await response.json();

        if (data.success) {
          setPunchState('punched-in');
          setPunchInData(data);
          setWorkflowProgress(50);

          if (data.dealerFound) {
            setSelectedDealer(data.dealer);
            return `✅ **PUNCH-IN SUCCESSFUL!**\n\n🏪 **DEALER DETECTED**\n**${data.dealer.name}**\n📍 Location confirmed\n🕐 ${new Date().toLocaleTimeString()}\n\n🎯 **READY FOR DVR!**\n\nDescribe your visit naturally:\n💰 "Collection visit, got ₹50K payment"\n🔄 "Routine check, discussed products"\n📋 "Order booking, confirmed 30MT"`;
          } else {
            return `🆕 **NEW LOCATION DETECTED**\n\n✅ **Punched in successfully!**\n🕐 ${new Date().toLocaleTimeString()}\n\n${data.agentMessage}\n\n💡 **Next:** ${data.firstQuestion}`;
          }
        } else {
          setWorkflowProgress(0);
          return `❌ **Punch-in failed:** ${data.error || 'Please try again'}`;
        }
      }

      // 🚀 STEP 2: DEALER CREATION (if needed)
      if (punchState === 'punched-in' && !selectedDealer) {
        const response = await fetch('/api/dvr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'dealer-questions',
            lat: currentLocation?.lat,
            lng: currentLocation?.lng,
            userId: userId,
            guidedResponses: { 1: input }
          })
        });

        const data = await response.json();

        if (data.success && data.dealerCreated) {
          setSelectedDealer(data.dealer);
          setWorkflowProgress(75);
          
          return `🎉 **DEALER CREATED!**\n\n🏪 **${data.dealer.name}**\n📍 Added to your database\n\n${data.agentMessage}`;
        } else {
          return `⚠️ **Need More Details**\n\n${data.details || data.agentMessage}\n\n💡 Include: name, type, contact, potential`;
        }
      }

      // 🚀 STEP 3: DVR COMPLETION
      if (punchState === 'punched-in' && selectedDealer) {
        if (input.trim().length < 10) {
          return `📝 **More Details Needed**\n\n💡 **Examples:**\n• "Collection visit, received ₹75K payment, customer satisfied"\n• "Routine check, discussed new cement grades, good feedback"\n• "Order booking, confirmed 25MT delivery next week"`;
        }

        const response = await fetch('/api/dvr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'dvr-questions',
            lat: currentLocation?.lat,
            lng: currentLocation?.lng,
            userId: userId,
            dealer: selectedDealer,
            guidedResponses: { 1: input }
          })
        });

        const data = await response.json();

        if (data.success) {
          // Reset workflow
          setPunchState('ready');
          setPunchInData(null);
          setSelectedDealer(null);
          setWorkflowProgress(100);

          setTimeout(() => setWorkflowProgress(0), 2000);

          return `🎉 **DVR CREATED SUCCESSFULLY!**\n\n📋 **REPORT SUMMARY:**\n🏪 **Dealer:** ${data.dvr.dealerName}\n💰 **Order:** ${data.dvr.todayOrderMt}MT\n💳 **Collection:** ₹${Number(data.dvr.todayCollectionRupees).toLocaleString()}\n📅 **Date:** ${data.dvr.reportDate}\n📍 **Location:** ${data.dvr.location}\n\n✅ **${data.agentMessage}**\n\n🚀 **Ready for next visit!**`;
        } else {
          return `❌ **DVR Creation Failed**\n\n${data.details || data.error}\n\n💡 Try providing more specific visit details.`;
        }
      }

      return `🤖 **DVR Assistant Ready!**\n\n🚀 Start with: "punch in"`;

    } catch (error: any) {
      console.error('DVR Workflow Error:', error);
      setPunchState('ready');
      setWorkflowProgress(0);
      return `❌ **Connection Error**\n\nUnable to process DVR request.\n\n**Error:** ${error?.message || 'Network issue'}\n\n💡 Please check your connection and try again.`;
    } finally {
      setTypingIndicator(false);
    }
  };

  // 🧠 ENHANCED REQUEST PROCESSOR
  const processUserRequest = async (input: string, ctx: string): Promise<string> => {
    const lowerInput = input.toLowerCase();

    try {
      // DVR Context - Use enhanced workflow
      if (ctx === 'dvr' || lowerInput.includes('dvr') || lowerInput.includes('visit') || lowerInput.includes('dealer') || lowerInput.includes('punch')) {
        return await handleDVRWorkflow(input);
      }

      // ATTENDANCE REQUESTS
      if (ctx === 'attendance' || lowerInput.includes('punch') || lowerInput.includes('attendance')) {
        if (lowerInput.includes('punch in') || lowerInput.includes('check in')) {
          return await handlePunchIn();
        }
        if (lowerInput.includes('status') || lowerInput.includes('today')) {
          return await handleAttendanceStatus();
        }
      }

      // JOURNEY REQUESTS
      if (ctx === 'journey' || lowerInput.includes('journey') || lowerInput.includes('route')) {
        if (lowerInput.includes('start') || lowerInput.includes('begin')) {
          return await handleStartJourney(input);
        }
        if (lowerInput.includes('status') || lowerInput.includes('active')) {
          return await handleJourneyStatus();
        }
      }

      // Default enhanced response
      return `🤖 **AI Processing...**\n\nI heard: "${input}"\n\n🎯 **Context:** ${ctx.replace('_', ' ')}\n\n✨ **Available Actions:**\n${getQuickActions(ctx).join(' • ')}\n\n💡 **Tip:** Be more specific about what you'd like to do!`;

    } catch (error) {
      console.error('Error processing request:', error);
      return `❌ **System Error**\n\nPlease try again or use quick action buttons.\n\n📱 **Mobile Tip:** Try shorter, more specific requests.`;
    }
  };

  // 🕐 ATTENDANCE HANDLERS (keeping your existing logic)
  const handlePunchIn = async (): Promise<string> => {
    if (!currentLocation) {
      return `❌ **Location Required**\n\nPlease enable GPS location services to punch in.`;
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
        return `✅ **Punch In Successful!**\n\n🕐 **Time:** ${new Date().toLocaleTimeString()}\n📍 **Location:** GPS Confirmed\n\n🎉 Have a productive day!`;
      } else {
        return `⚠️ **Punch In Issue**\n\n${data.error || 'Unable to punch in.'}\n\n💡 You might already be punched in today.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nPlease check your connection and try again.`;
    }
  };

  const handleAttendanceStatus = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/attendance/today/${userId}`);
      const data = await response.json();

      if (data.success && data.hasAttendance) {
        const attendance = data.data;
        const punchInTime = new Date(attendance.inTimeTimestamp).toLocaleTimeString();
        
        return `📊 **Today's Status**\n\n✅ **Punched In:** ${punchInTime}\n📍 **Location:** ${attendance.locationName}\n\n💪 Keep up the great work!`;
      } else {
        return `📊 **Not punched in yet**\n\n💡 Ready to start? Just say "punch in"!`;
      }
    } catch (error) {
      return `❌ **Unable to fetch status**\n\nPlease try again later.`;
    }
  };

  // 🗺️ JOURNEY HANDLERS (keeping your existing logic)
  const handleStartJourney = async (input: string): Promise<string> => {
    if (!currentLocation) {
      return `❌ **Location Required**\n\nPlease enable GPS to start journey tracking.`;
    }

    try {
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
        return `🚗 **Journey Started!**\n\n📍 **Starting Point:** ${siteName}\n🕐 **Start Time:** ${new Date().toLocaleTimeString()}\n🎯 **Journey ID:** ${data.data.id}\n\n📡 **GPS Tracking:** Active\n💫 I'll track your route and help with dealer check-ins!`;
      } else {
        return `⚠️ **Journey Start Issue**\n\n${data.error || 'Unable to start journey tracking.'}\n\n💡 You might already have an active journey.`;
      }
    } catch (error) {
      return `❌ **Connection Error**\n\nUnable to start journey tracking.`;
    }
  };

  const handleJourneyStatus = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/journey/active/${userId}`);
      const data = await response.json();

      if (data.success && data.hasActiveJourney) {
        const journey = data.data.journey;
        const status = data.data.status;

        return `🗺️ **Active Journey Status**\n\n📍 **Location:** ${journey.siteName}\n⏱️ **Duration:** ${status.duration}\n📏 **Distance:** ${status.totalDistance}\n🏪 **Check-ins:** ${status.activeCheckins}\n\n🚗 **Status:** Journey in progress`;
      } else {
        return `🗺️ **No Active Journey**\n\n💡 Ready to start? Say "start journey to [destination]"`;
      }
    } catch (error) {
      return `❌ **Unable to fetch journey status**\n\nPlease try again later.`;
    }
  };

  // 🎮 UI EVENT HANDLERS
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
      await new Promise(resolve => setTimeout(resolve, 300)); // Mobile optimization

      const aiResponse = await processUserRequest(currentInput, context);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
        context,
        actionButtons: getContextActionButtons(context),
        isSuccess: aiResponse.includes('✅') || aiResponse.includes('🎉'),
        isError: aiResponse.includes('❌') || aiResponse.includes('⚠️')
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '❌ **Connection Issue**\n\nPlease check your internet and try again.\n\n📱 **Mobile Tip:** Use quick action buttons for reliable operations.',
        timestamp: new Date(),
        context,
        isError: true
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

  const handleQuickAction = async (action: string) => {
    if (isMinimized) {
      setIsMinimized(false);
      setIsExpanded(true);
    }
    await handleSendMessage(action);
  };

  const handleActionButton = async (action: string) => {
    await handleSendMessage(action);
  };

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
    if (isMinimized) {
      setIsExpanded(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  const toggleExpanded = () => {
    if (isMinimized) {
      setIsMinimized(false);
    }
    setIsExpanded(!isExpanded);
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
      default: return <Bot className="w-4 h-4" />;
    }
  };

  // 🎨 YOUR BELOVED MINIMIZED BUTTON - UNCHANGED! ✨
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
            {unreadCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {unreadCount}
              </div>
            )}
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl transition-all duration-500 ease-in-out z-40 ${
      isExpanded ? 'h-[90vh]' : 'h-auto'
    } max-w-full`}>
      
      {/* 🔥 REVOLUTIONARY HEADER */}
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-purple-200/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="relative">
              <Badge variant="default" className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-xs sm:text-sm shadow-lg">
                {getContextIcon(context)}
                <span className="capitalize font-bold text-white">{context.replace('_', ' ')} AI</span>
              </Badge>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
            </div>

            {/* Enhanced Status Badges */}
            <div className="hidden sm:flex items-center space-x-2">
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/50 bg-emerald-500/10 text-xs font-semibold">
                <Zap className="w-3 h-3 mr-1" />
                Live API
              </Badge>

              {currentLocation && (
                <Badge variant="outline" className="text-blue-400 border-blue-400/50 bg-blue-500/10 text-xs font-semibold">
                  <MapPin className="w-3 h-3 mr-1" />
                  GPS
                </Badge>
              )}

              {isConnected ? (
                <Badge variant="outline" className="text-green-400 border-green-400/50 bg-green-500/10 text-xs">
                  <Wifi className="w-3 h-3 mr-1" />
                  Online
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-400 border-red-400/50 bg-red-500/10 text-xs">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpanded}
              className="p-2 hover:bg-purple-500/10 border-purple-300/30 text-white min-h-[36px] min-w-[36px]"
            >
              {isExpanded ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleMinimized}
              className="p-2 hover:bg-red-500/10 border-red-300/30 text-white min-h-[36px] min-w-[36px]"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 🚀 ENHANCED QUICK ACTIONS */}
        {!isExpanded && (
          <div className="flex space-x-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
            {context === 'dvr' && punchState === 'ready' ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSendMessage('punch in')}
                  className="whitespace-nowrap text-xs font-semibold bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-lg min-h-[40px] px-4"
                >
                  📍 Punch In
                </Button>
                {quickActions.slice(1).map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
                    className="whitespace-nowrap text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 min-h-[40px] px-3"
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
                  onClick={() => handleSendMessage('Collection visit, received payment of ₹50000')}
                  className="whitespace-nowrap text-xs font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg min-h-[40px] px-3"
                >
                  💰 Collection
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSendMessage('Routine check, discussed new products')}
                  className="whitespace-nowrap text-xs font-semibold bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg min-h-[40px] px-3"
                >
                  🔄 Routine
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSendMessage('Order booking, confirmed delivery')}
                  className="whitespace-nowrap text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg min-h-[40px] px-3"
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
                    setWorkflowProgress(0);
                  }}
                  className="whitespace-nowrap text-xs font-medium border-red-300 text-red-600 hover:bg-red-50 min-h-[40px] px-3"
                >
                  ❌ Cancel
                </Button>
              </>
            ) : (
              quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant={index === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className={`whitespace-nowrap text-xs font-medium min-h-[40px] px-3 ${
                    index === 0 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  {action}
                </Button>
              ))
            )}
          </div>
        )}

        {/* 🎯 WORKFLOW PROGRESS INDICATOR */}
        {workflowProgress > 0 && (
          <div className="mt-3 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-300/30">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-blue-200 font-medium">
                🔄 DVR Workflow Progress
              </span>
              <span className="text-blue-300 text-xs font-bold">
                {workflowProgress}%
              </span>
            </div>
            <div className="w-full bg-blue-900/30 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${workflowProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 💬 REVOLUTIONARY MESSAGES AREA */}
      {isExpanded && messages.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white max-h-[70vh] scroll-smooth">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-sm lg:max-w-md px-4 py-3 rounded-2xl shadow-md transition-all duration-300 hover:shadow-lg ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white transform hover:scale-[1.02]'
                    : message.isError
                    ? 'bg-red-50 text-red-900 border border-red-200 hover:bg-red-100'
                    : message.isSuccess
                    ? 'bg-green-50 text-green-900 border border-green-200 hover:bg-green-100'
                    : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {message.type === 'ai' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${
                      message.isError 
                        ? 'bg-red-500' 
                        : message.isSuccess 
                        ? 'bg-green-500' 
                        : 'bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600'
                    }`}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>

                    {/* 🎯 ENHANCED ACTION BUTTONS */}
                    {message.type === 'ai' && message.actionButtons && message.actionButtons.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.actionButtons.map((button, index) => (
                          <Button
                            key={index}
                            variant={button.variant}
                            size="sm"
                            onClick={() => handleActionButton(button.action)}
                            className="text-xs min-h-[36px] px-3 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            {button.icon && <span className="mr-1">{button.icon}</span>}
                            {button.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    <p className="text-xs opacity-75 mt-2 font-medium">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 🔥 ENHANCED TYPING INDICATOR */}
          {typingIndicator && (
            <div className="flex justify-start">
              <div className="max-w-xs px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 🚀 REVOLUTIONARY INPUT AREA */}
      <div className="p-3 sm:p-4 bg-gradient-to-r from-white via-blue-50 to-white border-t border-gray-100">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => !isExpanded && setIsExpanded(true)}
              placeholder={`💬 ${
                context === 'dvr' 
                  ? punchState === 'ready' 
                    ? 'Say "punch in" to start DVR workflow...' 
                    : 'Describe your dealer visit naturally...'
                  : `Ask about ${context.replace('_', ' ')}...`
              }`}
              disabled={isLoading}
              className="w-full pr-16 py-3 sm:py-4 text-base border-2 border-blue-200 focus:border-purple-500 rounded-xl bg-white focus:bg-blue-50/50 transition-all duration-300 min-h-[48px] shadow-sm focus:shadow-md"
              style={{ fontSize: '16px' }} // Prevents iOS zoom
            />
            
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="flex items-center space-x-1">
                {isLoading && <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />}
                <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
              </div>
            </div>
          </div>

          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            size="lg"
            className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-lg min-h-[48px] min-w-[48px] transition-all duration-300 ${
              isLoading || !inputValue.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 hover:from-emerald-700 hover:via-blue-700 hover:to-purple-700 hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* 🎯 ENHANCED STATUS BAR */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-3">
            <p className="text-xs text-gray-500 font-medium">
              📱 Mobile optimized • 🎯 Context aware • 🚀 Real-time API
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
              <MessageSquare className="w-3 h-3 mr-1" />
              {messages.length}
            </Badge>
            
            {punchState !== 'ready' && (
              <Badge variant="default" className="text-xs bg-emerald-600 text-white">
                DVR: {punchState.replace('-', ' ')}
              </Badge>
            )}

            {!isConnected && (
              <Badge variant="outline" className="text-xs text-red-600 border-red-300 animate-pulse">
                <AlertCircle className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}