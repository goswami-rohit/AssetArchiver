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
  Download,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Maximize2
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
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
    
    if (welcomeMessage && !isMinimized) {
      setMessages([{
        id: Date.now().toString(),
        type: 'ai',
        content: welcomeMessage,
        timestamp: new Date(),
        context
      }]);
    }
  }, [context, isMinimized]);

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
    if (isMinimized) {
      setIsMinimized(false);
      setIsExpanded(true);
    }
    setInputValue(action);
    await handleSendMessage(action);
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

  // ... [Keep all the existing handler functions: processUserRequest, handleAttendanceRequest, etc.] ...
  const processUserRequest = async (input: string, ctx: string) => {
    // Your existing logic here...
    return `🤖 **CRM Assistant Response**\n\nProcessing: "${input}" in ${ctx} context\n\n✅ This would connect to your endpoints!`;
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

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={toggleMinimized}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
        >
          <Bot className="w-6 h-6 text-white" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl transition-all duration-300 ${
      isExpanded ? 'h-[80vh]' : 'h-auto'
    }`}>
      {/* Collapsible Header */}
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
          
          <div className="flex items-center space-x-2">
            {currentLocation && (
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                <MapPin className="w-3 h-3 mr-1" />
                GPS Active
              </Badge>
            )}
            
            {/* Control Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpanded}
              className="p-2"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMinimized}
              className="p-2"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Quick Action Buttons - only show when expanded */}
        {!isExpanded && (
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
        )}
      </div>

      {/* Messages Area - only show when expanded */}
      {isExpanded && messages.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 max-h-[60vh]">
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

      {/* Quick Actions - show when expanded */}
      {isExpanded && (
        <div className="px-4 py-2 bg-gray-50 border-b">
          <div className="flex space-x-2 overflow-x-auto">
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
      )}

      {/* Input Area - always visible when not minimized */}
      <div className="p-4 bg-white">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => !isExpanded && setIsExpanded(true)}
              placeholder={`🚀 Ask about ${context.replace('_', ' ')}... (AI will handle the rest!)`}
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
          💡 Powered by 56+ endpoints • Click {isExpanded ? 'minimize' : 'expand'} button to {isExpanded ? 'collapse' : 'see full chat'}
        </p>
      </div>
    </div>
  );
}