import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Users
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  context?: string;
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
  const [pendingTVRData, setPendingTVRData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add context-specific welcome message
    const welcomeMessage = getContextWelcomeMessage(context);
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
        return "🕐 Ready to handle attendance! Say 'check in' or 'check out' to get started.";
      case 'tasks':
        return "✅ Let's manage your tasks! I can show pending tasks or help you update task status.";
      case 'journey':
        return "🗺️ Journey planning mode! Tell me where you need to go or say 'show my plans' to see today's schedule.";
      case 'dealers':
        return "👥 Dealer management! I can help you add new dealers, find dealer info, or manage contacts.";
      case 'dvr':
        return "📊 Let's create your Daily Visit Report! Just tell me about your visit - dealer name, order amount, collection, and any feedback.";
      case 'tvr':
        return "🔧 Technical Visit Report mode! Describe the technical work you performed and I'll help format the report. Tell me about the site, issue, and work done!";
      case 'location_punch':
        return "📍 Location punch ready! I can help you check in/out at your current location with photo capture.";
      case 'journey_active':
        return "🚗 Journey tracking active! I'm monitoring your route. Tell me when you reach a destination to log visits.";
      default:
        return "👋 Hi! I'm your CRM assistant. Click any button above or tell me what you'd like to do - submit reports, check attendance, manage tasks, or plan your journey!";
    }
  };

  const getContextIcon = (ctx: string) => {
    switch (ctx) {
      case 'attendance': return <Clock className="w-4 h-4" />;
      case 'tasks': return <CheckCircle className="w-4 h-4" />;
      case 'journey': return <Calendar className="w-4 h-4" />;
      case 'dealers': return <Users className="w-4 h-4" />;
      case 'dvr': case 'tvr': return <Bot className="w-4 h-4" />;
      case 'location_punch': return <MapPin className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const handleTVRSubmission = async (tvrData: any) => {
    try {
      const response = await fetch('/api/tvr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          useAI: true,
          userInput: inputValue,
          userId: userId,
          location: currentLocation,
          ...tvrData
        })
      });

      const data = await response.json();

      if (data.success) {
        const successMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'ai',
          content: `✅ ${data.message}\n\n🔧 **TVR Created Successfully!**\n• Report ID: ${data.data.id}\n• Site: ${data.data.siteNameConcernedPerson}\n• Type: ${data.data.visitType}\n• Time: ${new Date(data.data.checkInTime).toLocaleString()}\n\nYour technical visit report has been saved to the database!`,
          timestamp: new Date(),
          context: 'tvr'
        };
        setMessages(prev => [...prev, successMessage]);
        setPendingTVRData(null);
      } else {
        throw new Error(data.error || 'Failed to submit TVR');
      }
    } catch (error) {
      console.error('TVR submission error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'ai',
        content: `❌ Error submitting TVR: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
        context: 'tvr'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
      context
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Check for TVR submission commands
      if (context === 'tvr' && pendingTVRData && (currentInput.toLowerCase().includes('submit') || currentInput.toLowerCase().includes('save'))) {
        await handleTVRSubmission(pendingTVRData);
        setIsLoading(false);
        return;
      }

      // Determine which API endpoint to use based on context
      let apiEndpoint = '/api/ai/chat-assist';
      let requestBody: any = {
        userInput: currentInput,
        context,
        userId,
        location: currentLocation
      };

      // Special handling for DVR/TVR generation
      if (context === 'dvr' && currentLocation) {
        apiEndpoint = '/api/ai/generate-dvr';
        requestBody = {
          userInput: currentInput,
          location: currentLocation,
          userId
        };
      } else if (context === 'tvr' && currentLocation) {
        // For TVR, we'll simulate AI generation and then submit to our fixed endpoint
        const mockTVRData = {
          visitType: currentInput.toLowerCase().includes('repair') ? 'Repair' : 
                     currentInput.toLowerCase().includes('install') ? 'Installation' : 'Maintenance',
          siteNameConcernedPerson: currentInput.includes('at ') ? 
            currentInput.split('at ')[1]?.split(' ')[0] || 'Customer Site' : 'Customer Site',
          phoneNo: '0000000000', // Default, could be extracted from input
          clientsRemarks: currentInput,
          salespersonRemarks: `Technical support provided based on: ${currentInput}`,
          emailId: null
        };

        setPendingTVRData(mockTVRData);

        const aiResponse = `Perfect! I've prepared your TVR:\n\n🔧 **Technical Visit Report**\n• Site: ${mockTVRData.siteNameConcernedPerson}\n• Type: ${mockTVRData.visitType}\n• Issue Description: ${mockTVRData.clientsRemarks}\n• Work Performed: ${mockTVRData.salespersonRemarks}\n\n💾 Say **'submit'** or **'save'** to create this TVR in the database, or describe more details to modify it.`;

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: aiResponse,
          timestamp: new Date(),
          context
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        return;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      let aiResponse = '';
      if (context === 'dvr' && data.generatedDVR) {
        aiResponse = `Great! I've generated your DVR:\n\n📊 **Daily Visit Report**\n• Dealer: ${data.generatedDVR.dealerName}\n• Order: ${data.generatedDVR.todayOrderMt} MT\n• Collection: ₹${data.generatedDVR.todayCollectionRupees}\n• Feedback: ${data.generatedDVR.feedbacks}\n\nSay 'submit' to save this report or 'edit' to modify.`;
      } else {
        aiResponse = data.response || data.assistance || 'I understand! How can I help you further?';
      }

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
        content: 'Sorry, I encountered an error. Please try again.',
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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
      {/* Context Indicator */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="flex items-center space-x-1">
            {getContextIcon(context)}
            <span className="capitalize">{context.replace('_', ' ')} Mode</span>
          </Badge>
          {currentLocation && (
            <Badge variant="outline" className="text-green-600">
              <MapPin className="w-3 h-3 mr-1" />
              Location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages Area */}
      {messages.length > 0 && (
        <div className="max-h-64 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.type === 'ai' && <Bot className="w-4 h-4 mt-0.5 text-blue-600" />}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-75 mt-1">
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

      {/* Input Area */}
      <div className="p-4">
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Type your message for ${context.replace('_', ' ')} assistance...`}
              disabled={isLoading}
              className="w-full"
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className="px-3"
          >
            {isLoading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}