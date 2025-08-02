import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Send, 
  Mic, 
  Camera, 
  MapPin, 
  Bot,
  User,
  Clock,
  CheckCircle,
  Calendar,
  Users,
  Building2,
  FileText,
  TrendingUp,
  Zap,
  Upload,
  Download
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  context?: string;
  data?: any;
}

interface ChatInterfaceProps {
  context: string;
  currentLocation: {lat: number, lng: number} | null;
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
  const [pendingData, setPendingData] = useState<any>(null);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const welcomeMessage = getContextWelcomeMessage(context);
    const actions = getQuickActions(context);
    setQuickActions(actions);
    
    if (welcomeMessage) {
      setMessages([{
        id: Date.now().toString(),
        type: 'ai',
        content: welcomeMessage,
        timestamp: new Date(),
        context
      }]);
    }
  }, [context]);

  const getContextWelcomeMessage = (ctx: string): string => {
    switch (ctx) {
      case 'attendance':
        return "🕐 **Attendance Management Ready!**\n\n📍 Current options:\n• Check attendance status\n• View attendance history\n• Get attendance analytics\n\nWhat would you like to do?";
      case 'tasks':
        return "✅ **Task Management Hub!**\n\n📋 I can help you:\n• View pending tasks\n• Update task status\n• Create new tasks\n• Get task analytics\n\nTell me what you need!";
      case 'journey':
        return "🗺️ **Journey Planning & Tracking!**\n\n🚗 Available services:\n• View active journey\n• Plan new routes\n• Journey history\n• Location tracking\n\nHow can I assist your journey?";
      case 'dealers':
        return "👥 **Dealer Management Center!**\n\n🏢 I can help with:\n• Add new dealers\n• Find dealer information\n• Update dealer details\n• Dealer performance analytics\n\nWhat dealer task do you need?";
      case 'dvr':
        return "📊 **Daily Visit Report (DVR) Assistant!**\n\n📝 Just tell me:\n• Dealer name you visited\n• Order amount (if any)\n• Collection amount\n• Any feedback or observations\n\nI'll create a professional DVR for you!";
      case 'tvr':
        return "🔧 **Technical Visit Report (TVR) Creator!**\n\n⚡ Describe your technical work:\n• Site/customer details\n• Problem you solved\n• Work performed\n• Follow-up needed\n\n🪄 **AI Magic Available!** I'll format everything professionally!";
      case 'competition':
        return "🏆 **Competition Analysis Hub!**\n\n📈 Track competitor activity:\n• Competitor brand analysis\n• Scheme comparisons\n• Market intelligence\n• Trend analysis\n\nWhat competitive insights do you need?";
      case 'leave':
        return "🏖️ **Leave Management Portal!**\n\n📅 I can help you:\n• Apply for leave\n• Check leave balance\n• View leave history\n• Track approval status\n\nWhat leave assistance do you need?";
      case 'location_punch':
        return "📍 **Smart Location Services!**\n\n🎯 Available actions:\n• Punch in/out at current location\n• Capture location with photo\n• View location history\n\nReady to record your location!";
      case 'journey_active':
        return "🚗 **Journey Tracking Active!**\n\n📡 Real-time services:\n• Log dealer visits\n• Update journey status\n• Add waypoints\n• Record observations\n\nI'm monitoring your route!";
      default:
        return "🤖 **Advanced CRM Assistant Ready!**\n\n🚀 **Powered by 56+ Endpoints**\n\n💪 I can handle:\n• All reports (DVR, TVR, Competition)\n• Complete attendance management\n• Journey tracking & planning\n• Dealer & leave management\n• Real-time analytics\n\nClick any button above or describe what you need!";
    }
  };

  const getQuickActions = (ctx: string): string[] => {
    switch (ctx) {
      case 'attendance':
        return ['Check Status', 'View History', 'Analytics'];
      case 'tasks':
        return ['Pending Tasks', 'Update Status', 'New Task'];
      case 'dvr':
        return ['Quick DVR', 'Recent Visits', 'Analytics'];
      case 'tvr':
        return ['AI Generate', 'Quick TVR', 'Export'];
      case 'competition':
        return ['Market Analysis', 'Trends', 'Compare'];
      case 'dealers':
        return ['Find Dealer', 'Performance', 'Add New'];
      case 'leave':
        return ['Apply Leave', 'Check Balance', 'History'];
      default:
        return ['Help', 'Quick Start', 'Analytics'];
    }
  };

  const getContextIcon = (ctx: string) => {
    switch (ctx) {
      case 'attendance': return <Clock className="w-4 h-4" />;
      case 'tasks': return <CheckCircle className="w-4 h-4" />;
      case 'journey': return <Calendar className="w-4 h-4" />;
      case 'dealers': return <Building2 className="w-4 h-4" />;
      case 'dvr': return <FileText className="w-4 h-4" />;
      case 'tvr': return <Zap className="w-4 h-4" />;
      case 'competition': return <TrendingUp className="w-4 h-4" />;
      case 'leave': return <Users className="w-4 h-4" />;
      case 'location_punch': return <MapPin className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const handleQuickAction = async (action: string) => {
    setInputValue(action);
    await handleSendMessage(action);
  };

  const processUserRequest = async (input: string, ctx: string) => {
    // Route to appropriate endpoints based on context and input
    switch (ctx) {
      case 'attendance':
        return await handleAttendanceRequest(input);
      case 'dvr':
        return await handleDVRRequest(input);
      case 'tvr':
        return await handleTVRRequest(input);
      case 'competition':
        return await handleCompetitionRequest(input);
      case 'leave':
        return await handleLeaveRequest(input);
      case 'dealers':
        return await handleDealerRequest(input);
      case 'tasks':
        return await handleTaskRequest(input);
      default:
        return await handleGeneralRequest(input);
    }
  };

  const handleAttendanceRequest = async (input: string) => {
    try {
      if (input.toLowerCase().includes('status') || input.toLowerCase().includes('check')) {
        const response = await fetch(`/api/attendance/today/${userId}`);
        const data = await response.json();
        
        if (data.success) {
          return `📊 **Today's Attendance Status**\n\n${data.data ? 
            `✅ **Checked In**: ${new Date(data.data.checkInTime).toLocaleTimeString()}\n📍 Location: ${data.data.locationName}\n⏰ Status: ${data.data.status}` :
            '❌ **Not Checked In** today'}\n\nNeed to punch in/out?`;
        }
      } else if (input.toLowerCase().includes('history')) {
        const response = await fetch(`/api/attendance/user/${userId}?limit=5`);
        const data = await response.json();
        
        if (data.success) {
          const history = data.data.map((att: any) => 
            `• ${new Date(att.checkInTime).toLocaleDateString()}: ${att.status} at ${att.locationName}`
          ).join('\n');
          
          return `📈 **Recent Attendance History**\n\n${history}`;
        }
      } else if (input.toLowerCase().includes('analytics')) {
        const response = await fetch(`/api/attendance/stats/${userId}`);
        const data = await response.json();
        
        if (data.success) {
          return `📊 **Attendance Analytics**\n\n• Present Days: ${data.data.presentDays || 0}\n• Late Arrivals: ${data.data.lateDays || 0}\n• Attendance Rate: ${data.data.attendanceRate || 0}%`;
        }
      }
    } catch (error) {
      return '❌ Error fetching attendance data. Please try again.';
    }
    
    return 'I can help with attendance status, history, or analytics. What would you like to know?';
  };

  const handleDVRRequest = async (input: string) => {
    try {
      // Use AI magic to generate DVR from natural language
      const response = await fetch('/api/dvr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          useAI: true,
          userInput: input,
          visitDate: new Date().toISOString().split('T')[0],
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return `✅ **DVR Created Successfully!**\n\n📊 **Report Details:**\n• Dealer: ${data.data.dealerName}\n• Visit Type: ${data.data.visitType}\n• Order: ${data.data.todayOrderMt || 0} MT\n• Collection: ₹${data.data.todayCollectionRupees || 0}\n• Report ID: ${data.data.id}\n\n📅 Saved for ${new Date().toLocaleDateString()}`;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      return `❌ Error creating DVR: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  const handleTVRRequest = async (input: string) => {
    try {
      if (input.toLowerCase().includes('generate') || input.toLowerCase().includes('ai')) {
        // Use AI magic button functionality
        const response = await fetch('/api/tvr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            useAI: true,
            userInput: input,
            latitude: currentLocation?.lat,
            longitude: currentLocation?.lng
          })
        });

        const data = await response.json();
        
        if (data.success) {
          return `⚡ **AI-Powered TVR Created!**\n\n🔧 **Technical Report:**\n• Site: ${data.data.siteNameConcernedPerson}\n• Type: ${data.data.visitType}\n• Problem: ${data.data.problemDescription}\n• Solution: ${data.data.actionTaken}\n• Follow-up: ${data.data.followUp ? 'Required' : 'Not needed'}\n• Report ID: ${data.data.id}\n\n🎯 **AI Magic Applied!**`;
        } else {
          throw new Error(data.error);
        }
      }
    } catch (error) {
      return `❌ Error creating TVR: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return '🔧 Describe your technical work and I\'ll create a professional TVR with AI assistance!';
  };

  const handleCompetitionRequest = async (input: string) => {
    try {
      if (input.toLowerCase().includes('analysis') || input.toLowerCase().includes('trends')) {
        const response = await fetch(`/api/competition/analysis/${userId}`);
        const data = await response.json();
        
        if (data.success) {
          return `📈 **Competition Analysis**\n\n🏆 **Key Insights:**\n• Active Competitors: ${data.data.totalCompetitors || 0}\n• Market Trends: ${data.data.trends || 'Stable'}\n• Avg Scheme Cost: ₹${data.data.avgSchemeCost || 0}\n\nNeed detailed competitor intel?`;
        }
      } else {
        // Create new competition report
        const response = await fetch('/api/competition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            useAI: true,
            userInput: input,
            reportDate: new Date().toISOString().split('T')[0]
          })
        });

        const data = await response.json();
        
        if (data.success) {
          return `🏆 **Competition Report Created!**\n\n📊 **Market Intelligence:**\n• Brand: ${data.data.brandName}\n• Scheme: ${data.data.schemeDetails}\n• Cost Impact: ₹${data.data.avgSchemeCost}\n• Report ID: ${data.data.id}`;
        }
      }
    } catch (error) {
      return `❌ Error with competition data: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return '🏆 Tell me about competitor activity you observed and I\'ll create a market intelligence report!';
  };

  const handleLeaveRequest = async (input: string) => {
    try {
      if (input.toLowerCase().includes('balance') || input.toLowerCase().includes('check')) {
        const response = await fetch(`/api/leave/stats/${userId}`);
        const data = await response.json();
        
        if (data.success) {
          return `🏖️ **Leave Balance & Stats**\n\n📊 **Your Leave Status:**\n• Total Applied: ${data.data.totalLeaves || 0}\n• Approved: ${data.data.approvedLeaves || 0}\n• Pending: ${data.data.pendingLeaves || 0}\n• This Year: ${data.data.thisYearLeaves || 0}\n\nNeed to apply for leave?`;
        }
      } else if (input.toLowerCase().includes('history')) {
        const response = await fetch(`/api/leave/user/${userId}?limit=5`);
        const data = await response.json();
        
        if (data.success) {
          const history = data.data.map((leave: any) => 
            `• ${leave.leaveType}: ${new Date(leave.startDate).toLocaleDateString()} - ${leave.status}`
          ).join('\n');
          
          return `📅 **Recent Leave History**\n\n${history}`;
        }
      }
    } catch (error) {
      return `❌ Error fetching leave data: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return '🏖️ I can help check your leave balance, history, or guide you through applying for leave!';
  };

  const handleDealerRequest = async (input: string) => {
    try {
      if (input.toLowerCase().includes('find') || input.toLowerCase().includes('search')) {
        // This would require a dealer search endpoint
        return '🔍 **Dealer Search**\n\nTell me the dealer name or location you\'re looking for and I\'ll find their details!';
      } else if (input.toLowerCase().includes('performance')) {
        const response = await fetch('/api/dvr/dealer-performance');
        const data = await response.json();
        
        if (data.success) {
          return `📊 **Top Dealer Performance**\n\n🏆 **Best Performers:**\n${data.data.slice(0, 3).map((d: any, i: number) => 
            `${i + 1}. ${d.dealerName}: ₹${d.totalOrders || 0}`).join('\n')}`;
        }
      }
    } catch (error) {
      return `❌ Error with dealer data: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return '🏢 I can help find dealers, check performance, or guide you through adding new dealers!';
  };

  const handleTaskRequest = async (input: string) => {
    // Using TVR as task system
    try {
      if (input.toLowerCase().includes('pending')) {
        const response = await fetch(`/api/tvr/user/${userId}?limit=5`);
        const data = await response.json();
        
        if (data.success) {
          const tasks = data.data.filter((tvr: any) => tvr.followUp).map((task: any) => 
            `• ${task.visitType} at ${task.siteNameConcernedPerson} - ${task.nextAction}`
          ).join('\n');
          
          return `📋 **Pending Follow-up Tasks**\n\n${tasks || 'No pending follow-ups! 🎉'}`;
        }
      }
    } catch (error) {
      return `❌ Error fetching tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return '📋 I can show pending tasks, help update status, or create new task items!';
  };

  const handleGeneralRequest = async (input: string) => {
    return `🤖 **CRM Assistant at Your Service!**\n\n🚀 I understand you want: "${input}"\n\n💡 **Quick Suggestions:**\n• Click specific buttons above for focused help\n• Say "show stats" for analytics\n• Describe any work for instant reports\n• Ask about any CRM function\n\nHow can I assist you specifically?`;
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
      const aiResponse = await processUserRequest(currentInput, context);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
        context
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '❌ **System Error**\n\nSorry, I encountered an issue. Please try again or contact support if the problem persists.',
        timestamp: new Date(),
        context
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl">
      {/* Enhanced Context Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Badge variant="default" className="flex items-center space-x-2 px-3 py-1">
              {getContextIcon(context)}
              <span className="capitalize font-medium">{context.replace('_', ' ')} Assistant</span>
            </Badge>
            <Badge variant="outline" className="text-green-700 border-green-300">
              <Zap className="w-3 h-3 mr-1" />
              AI Powered
            </Badge>
          </div>
          {currentLocation && (
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              <MapPin className="w-3 h-3 mr-1" />
              GPS Active
            </Badge>
          )}
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex space-x-2 mt-3 overflow-x-auto">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action)}
              className="whitespace-nowrap text-xs"
            >
              {action}
            </Button>
          ))}
        </div>
      </div>

      {/* Enhanced Messages Area */}
      {messages.length > 0 && (
        <div className="max-h-72 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl shadow-sm ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 border'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.type === 'ai' && (
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className="text-xs opacity-75 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Enhanced Input Area */}
      <div className="p-4 bg-white">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`🚀 Describe your ${context.replace('_', ' ')} needs... (AI will handle the rest!)`}
              disabled={isLoading}
              className="w-full pr-12 py-3 text-sm border-2 border-gray-200 focus:border-blue-500 rounded-xl"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Zap className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            size="lg"
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isLoading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          💡 Powered by 56+ endpoints • AI-enhanced responses • Real-time data
        </p>
      </div>
    </div>
  );
}