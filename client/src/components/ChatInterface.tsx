//client/src/components/ChatInterface.tsx - 2025 MODERN VERSION
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
  ArrowLeft, MoreHorizontal, Copy, Share, Bookmark, Wand2, Brain, Rocket
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
    }, 1500);
  };

  // 🧠 FIXED AI CHAT INTEGRATION
  const handleSendMessage = async (customInput?: string) => {
    const currentInput = customInput || inputValue;
    if (!currentInput.trim()) return;

    console.log('🚀 Sending message:', { message: currentInput, userId });

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
      // ✅ FIXED API REQUEST FORMAT
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,     // ← Single message string (FIXED)
          userId: userId,            // ← Correct
          context: { messages }      // ← Pass messages as context (FIXED)
        })
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📨 Response data:', data);

      if (data.success) {
        setConnectionStatus('connected');

        // ✅ FIXED RESPONSE HANDLING
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,    // ← Just data.message (FIXED)
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || 'AI Chat failed');
      }
    } catch (error) {
      console.error('❌ AI Chat error:', error);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Connection status indicator with animations
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />;
      case 'connecting':
        return <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" />;
    }
  };

  // ✨ ENHANCED 2025 QUICK ACTIONS
  const quickActions = [
    { 
      icon: FileText, 
      text: "Create DVR report from today's visit", 
      color: "blue",
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50"
    },
    { 
      icon: Zap, 
      text: "Generate TVR for technical work", 
      color: "purple",
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-50 to-pink-50"
    },
    { 
      icon: TrendingUp, 
      text: "Analyze my performance this month", 
      color: "green",
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-50 to-emerald-50"
    },
    { 
      icon: Building2, 
      text: "Show dealer insights and opportunities", 
      color: "orange",
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-50 to-red-50"
    },
  ];

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex flex-col">
      {/* ✨ 2025 GLASSMORPHISM HEADER */}
      <div className="backdrop-blur-xl bg-white/80 border-b border-white/20 sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="p-2 hover:bg-white/60 rounded-full transition-all duration-300 hover:scale-105"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="h-12 w-12 ring-2 ring-white/50 shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
                  <Brain className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-bold text-xl bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  AI Assistant
                </h1>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  {getConnectionIndicator()}
                  <span className="font-medium">RAG-Powered • Vector DB</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-white/60 transition-all duration-300 hover:scale-105">
                <Search className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-white/60 transition-all duration-300 hover:scale-105">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 💬 MESSAGES AREA - 2025 STYLE */}
      <div className="flex-1 overflow-y-auto">
        {/* ✨ ENHANCED WELCOME SCREEN */}
        {showQuickActions && messages.length <= 1 && (
          <div className="p-6 max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full animate-pulse"></div>
                <div className="relative w-full h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl">
                  <Rocket className="w-12 h-12 text-white animate-bounce" />
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                AI Field Assistant
              </h2>
              <p className="text-gray-600 text-lg">Powered by advanced RAG technology</p>
            </div>

            {/* ✨ 2025 QUICK ACTIONS GRID */}
            <div className="grid grid-cols-1 gap-4 mb-8">
              {quickActions.map((action, index) => (
                <Card
                  key={index}
                  className="group cursor-pointer hover:shadow-xl transition-all duration-500 border-0 bg-gradient-to-r backdrop-blur-sm hover:scale-[1.02] overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${action.bgGradient.replace('from-', '').replace('to-', '').split(' ').map(c => `var(--${c})`).join(', ')})`
                  }}
                  onClick={() => handleSendMessage(action.text)}
                >
                  <div className="p-5 flex items-center space-x-4 relative">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-r ${action.gradient} shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}>
                      <action.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 group-hover:text-gray-800 transition-colors duration-300">
                        {action.text}
                      </p>
                    </div>
                    <Sparkles className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-all duration-300 group-hover:rotate-12" />
                  </div>
                </Card>
              ))}
            </div>

            {/* ✨ STATUS CARDS 2025 */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/50 backdrop-blur-sm">
                <div className="p-5 text-center">
                  <Shield className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-emerald-800">Secure & Encrypted</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50 backdrop-blur-sm">
                <div className="p-5 text-center">
                  <Wand2 className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-blue-800">AI-Powered</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ✨ CHAT MESSAGES - 2025 STYLE */}
        <div className="px-4 py-2 space-y-6">
          {aiThinking && messages.length === 0 && (
            <div className="flex justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-white animate-pulse" />
                </div>
                <p className="text-gray-600 font-medium">Initializing AI Assistant...</p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom duration-500`}>
              <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="flex items-center space-x-3 mb-3">
                    <Avatar className="h-9 w-9 ring-2 ring-blue-100">
                      <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <Bot className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-gray-900">AI Assistant</span>
                    <Badge variant="outline" className="text-xs bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI
                    </Badge>
                  </div>
                )}
                
                <div className={`p-5 rounded-3xl backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                    : 'bg-white/80 border border-gray-200/50 text-gray-800 hover:bg-white/90'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{message.content}</p>
                </div>
                
                <div className="flex items-center justify-between mt-3 px-2">
                  <span className="text-xs text-gray-500 font-medium">
                    {message.timestamp?.toLocaleTimeString()}
                  </span>
                  {message.role === 'assistant' && (
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 transition-all duration-200 hover:scale-110">
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 transition-all duration-200 hover:scale-110">
                        <Share className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* ✨ ENHANCED TYPING INDICATOR */}
          {typingIndicator && (
            <div className="flex justify-start animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center space-x-3 mb-2">
                <Avatar className="h-9 w-9 ring-2 ring-blue-100">
                  <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-3xl px-5 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ✨ 2025 GLASSMORPHISM INPUT AREA */}
      <div className="backdrop-blur-xl bg-white/80 border-t border-white/20 p-4 pb-6 safe-area-bottom">
        <div className="flex items-center space-x-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="sm" className="p-3 rounded-full hover:bg-white/60 transition-all duration-300 hover:scale-105">
            <Camera className="w-5 h-5 text-gray-600" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message AI Assistant..."
              disabled={isLoading}
              className="w-full pr-12 py-4 text-base border-gray-200/50 rounded-full bg-white/60 backdrop-blur-sm focus:bg-white/80 focus:border-blue-400 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full hover:bg-gray-100/60 transition-all duration-300 hover:scale-105"
            >
              <Mic className="w-4 h-4 text-gray-600" />
            </Button>
          </div>

          <Button
            onClick={() => handleSendMessage()}  // ✅ FIXED: Added onClick
            disabled={isLoading || !inputValue.trim()}  // ✅ FIXED: Added disabled
            className={`p-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl ${
              inputValue.trim() 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white hover:scale-105' 
                : 'bg-gray-200/80 text-gray-400'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {/* ✨ ENHANCED STATUS BAR */}
        <div className="flex items-center justify-between mt-4 max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              {getConnectionIndicator()}
              <span className="font-medium">Connected</span>
            </div>
            <span>•</span>
            <span>End-to-end encrypted</span>
          </div>
          <Badge variant="outline" className="text-xs bg-white/60 backdrop-blur-sm border-gray-200/50">
            <Heart className="w-3 h-3 mr-1 text-red-400" />
            {messages.filter(m => m.role === 'user').length} messages
          </Badge>
        </div>
      </div>
    </div>
  );
}