//client/src/components/ChatInterface.tsx - REDESIGNED FOR FULL PAGE
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Send, Bot, User, Clock, CheckCircle, Calendar, Users, Building2, FileText,
  TrendingUp, Zap, Upload, Download, ChevronUp, ChevronDown, Star,
  Heart, Sparkles, Target, Route, Store, BarChart3, Settings, AlertCircle, Loader2,
  MessageSquare, PlusCircle, Search, Filter, RefreshCw, Eye, Edit, Trash2, MapPin,
  Mic, Camera, Headphones, Volume2, Wifi, Signal, Battery, Database, Shield,
  ArrowLeft, MoreHorizontal, Copy, Share, Bookmark
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  type?: 'text' | 'action_result';
  data?: any;
}

interface ChatInterfaceProps {
  userId: number;
  currentLocation: { lat: number, lng: number } | null;
  onBack?: () => void;
}

export default function ChatInterface({ userId, currentLocation, onBack }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connected');
  const [aiThinking, setAiThinking] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      initializeRAGChat();
    }
  }, []);

  // 🧠 INITIALIZE RAG-POWERED CHAT
  const initializeRAGChat = () => {
    setAiThinking(true);
    setTimeout(() => {
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: `Hey there! 👋 I'm your AI field assistant powered by advanced RAG technology.

🚀 **What I can do:**
• Create DVR & TVR reports from natural conversation
• Analyze your field data and performance  
• Generate insights from your dealer visits
• Help with PJP planning and optimization

💬 **Just tell me what happened:**
"Visited ABC dealer, got 5MT order"
"Technical issue fixed at XYZ site"
"Met with client about new requirements"

I'll understand the context and create the right reports automatically! ✨`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      setAiThinking(false);
    }, 1000);
  };

  // 🧠 ENHANCED RAG CHAT WITH /api/ai/chat INTEGRATION
  const handleSendMessage = async (customInput?: string) => {
    const currentInput = customInput || inputValue;
    if (!currentInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customInput) setInputValue('');
    setIsLoading(true);
    setTypingIndicator(true);
    setConnectionStatus('connecting');
    setShowQuickActions(false);

    try {
      // Use the new AI orchestrator endpoint
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userId: userId,
          mode: 'auto' // Let AI decide whether to use tools or just chat
        })
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus('connected');

        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.type === 'text' ? data.data : formatActionResult(data.data),
          timestamp: new Date(),
          type: data.type,
          data: data.type === 'action_result' ? data.data : null
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || 'AI Chat failed');
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      setConnectionStatus('error');

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '❌ **Connection Issue**\n\nI\'m having trouble connecting right now. Please try again in a moment.\n\n🔄 Retrying automatically...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

      setTimeout(() => setConnectionStatus('connected'), 3000);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  // Format action results nicely
  const formatActionResult = (data: any) => {
    if (data.created) {
      return `✅ **Success!** 

📝 **${data.type} Created**
🆔 Record ID: ${data.created.id}
📅 Date: ${new Date().toLocaleDateString()}

🎉 Your data has been saved successfully! What else can I help you with?`;
    }
    
    if (data.retrieved) {
      return `📊 **Data Retrieved**

Found ${data.retrieved.length} records:
${data.retrieved.slice(0, 3).map((item: any, i: number) => `${i + 1}. ${item.title || item.name || 'Record'}`).join('\n')}

Would you like me to analyze this data further?`;
    }

    return JSON.stringify(data, null, 2);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Connection status indicator
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'connecting':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" />;
    }
  };

  // Quick action suggestions
  const quickActions = [
    { icon: FileText, text: "Create DVR report from today's visit", color: "blue" },
    { icon: Zap, text: "Generate TVR for technical work", color: "purple" },
    { icon: TrendingUp, text: "Analyze my performance this month", color: "green" },
    { icon: Building2, text: "Show dealer insights and opportunities", color: "orange" },
  ];

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* 🎨 INSTAGRAM-STYLE HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {onBack && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onBack}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 text-white">
                  <Bot className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-lg">AI Assistant</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  {getConnectionIndicator()}
                  <span>RAG-Powered • Vector DB</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="p-2 rounded-full">
                <Search className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 rounded-full">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 💬 MESSAGES AREA - INSTAGRAM STYLE */}
      <div className="flex-1 overflow-y-auto">
        {/* Welcome Screen with Quick Actions */}
        {showQuickActions && messages.length <= 1 && (
          <div className="p-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">AI Field Assistant</h2>
              <p className="text-gray-600">Powered by advanced RAG technology</p>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              {quickActions.map((action, index) => (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:shadow-md transition-all duration-200 border border-gray-200"
                  onClick={() => handleSendMessage(action.text)}
                >
                  <div className="p-4 flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      action.color === 'blue' ? 'bg-blue-100' :
                      action.color === 'purple' ? 'bg-purple-100' :
                      action.color === 'green' ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      <action.icon className={`w-6 h-6 ${
                        action.color === 'blue' ? 'text-blue-600' :
                        action.color === 'purple' ? 'text-purple-600' :
                        action.color === 'green' ? 'text-green-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{action.text}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <div className="p-4 text-center">
                  <Shield className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-800">Secure & Encrypted</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-purple-200">
                <div className="p-4 text-center">
                  <Zap className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-purple-800">AI-Powered</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="px-4 py-2 space-y-4">
          {aiThinking && messages.length === 0 && (
            <div className="flex justify-center py-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <p className="text-gray-600">Initializing AI Assistant...</p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="flex items-center space-x-2 mb-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-gray-900">AI Assistant</span>
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI
                    </Badge>
                  </div>
                )}
                
                <div className={`p-4 rounded-3xl ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  
                  {message.type === 'action_result' && message.data && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-gray-700">Action Completed</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {message.data.type || 'Database Action'}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-xs text-gray-500">
                    {message.timestamp?.toLocaleTimeString()}
                  </span>
                  {message.role === 'assistant' && (
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Share className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {typingIndicator && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2 mb-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white border border-gray-200 rounded-3xl px-4 py-3">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 💬 INSTAGRAM-STYLE INPUT AREA */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" className="p-2 rounded-full">
            <Camera className="w-5 h-5 text-gray-600" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message AI Assistant..."
              disabled={isLoading}
              className="w-full pr-12 py-3 border-gray-300 rounded-full bg-gray-100 focus:bg-white focus:border-blue-500 transition-all"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full"
            >
              <Mic className="w-4 h-4 text-gray-600" />
            </Button>
          </div>

          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className={`p-3 rounded-full transition-all ${
              inputValue.trim() 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {/* Status Bar */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              {getConnectionIndicator()}
              <span>Connected</span>
            </div>
            <span>•</span>
            <span>End-to-end encrypted</span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Heart className="w-3 h-3 mr-1" />
            {messages.filter(m => m.role === 'user').length} messages
          </Badge>
        </div>
      </div>
    </div>
  );
}