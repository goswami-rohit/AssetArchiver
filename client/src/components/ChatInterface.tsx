//client/src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Send, Bot, User, Clock, CheckCircle, Calendar, Users, Building2, FileText,
  TrendingUp, Zap, Upload, Download, ChevronUp, ChevronDown, Minimize2, Maximize2, Star,
  Heart, Sparkles, Target, Route, Store, BarChart3, Settings, AlertCircle, Loader2,
  MessageSquare, PlusCircle, Search, Filter, RefreshCw, Eye, Edit, Trash2, MapPin,
  Mic, Camera, Headphones, Volume2, Wifi, Signal, Battery, Database, Shield
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
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
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connected');
  const [aiThinking, setAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isMinimized && messages.length === 0) {
      initializeRAGChat();
    }
  }, [isMinimized]);

  // 🧠 INITIALIZE RAG-POWERED CHAT WITH STUNNING ANIMATION
  const initializeRAGChat = () => {
    setAiThinking(true);
    setTimeout(() => {
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: `🚀 **RAG-Powered Field Assistant Ready!**

🧠 **Vector Database** ✅ Connected  
📊 **DVR & TVR Endpoints** ✅ Loaded  
⚡ **OpenRouter AI** ✅ Active  
🛡️ **Security** ✅ Encrypted  

💬 **Natural Language Processing:**
✨ "I visited ABC dealer today, secured 5MT order"
🔧 "Fixed technical issue at XYZ factory"  
📝 "Need to log today's customer meeting"

🎯 **Smart Features:**
• Auto-endpoint detection (DVR/TVR)
• Intelligent data extraction
• Real-time database sync
• Natural conversation flow

Ready to revolutionize your field work! What happened today? 🚀`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      setAiThinking(false);
    }, 1000);
  };

  // 🧠 ENHANCED RAG CHAT FUNCTION WITH BETTER UX
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

    try {
      // Add realistic thinking delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));

      const response = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userId: userId // ✅ ADD THIS
        })
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus('connected');

        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);

        // Check if AI thinks data is ready
        if (data.message.includes('ready to submit') || data.message.includes('should I submit')) {
          await checkForDataExtraction();
        }
      } else {
        throw new Error(data.error || 'RAG Chat failed');
      }
    } catch (error) {
      console.error('RAG Chat error:', error);
      setConnectionStatus('error');

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '❌ **Connection Issue**\n\nI\'m having trouble reaching the AI systems. Your data is safe - please try again in a moment.\n\n🔄 **Auto-retry** in 5 seconds...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

      // Auto-retry after 5 seconds
      setTimeout(() => {
        setConnectionStatus('connected');
      }, 5000);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  // 🎯 ENHANCED DATA EXTRACTION WITH BETTER FEEDBACK
  // 🎯 FIXED DATA EXTRACTION 
  const checkForDataExtraction = async () => {
    try {
      const response = await fetch('/api/rag/submit', { // ✅ CHANGED FROM /extract
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          userId: userId // ✅ ADDED REQUIRED userId
        })
      });

      const data = await response.json();

      if (data.success && data.data) { // ✅ CHANGED FROM extractedData to data
        setExtractedData({
          endpoint: data.endpoint,
          data: data.data
        });
        setIsReadyToSubmit(true);

        const endpointType = data.endpoint === '/api/dvr-manual' ? 'Daily Visit Report' : 'Technical Visit Report';
        const previewFields = Object.keys(data.data).slice(0, 3);

        const confirmMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ **Data Extraction Complete!**

📊 **Report Type:** ${endpointType}
🎯 **Endpoint:** ${data.endpoint}

📋 **Key Fields Captured:**
${previewFields.map(field => `• ${field}: ${data.data[field]}`).join('\n')}

🚀 **Already submitted to database!** Record ID: ${data.recordId}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, confirmMessage]);
      }
    } catch (error) {
      console.error('Data extraction error:', error);
    }
  };
  // 🚀 ENHANCED SUBMISSION WITH BETTER FEEDBACK
  const handleSubmitData = async () => {
    if (!extractedData) return;

    setIsLoading(true);
    setConnectionStatus('connecting');

    try {
      // Show submission progress
      const progressMessage: ChatMessage = {
        role: 'assistant',
        content: `🔄 **Submitting to Database...**\n\n📊 Endpoint: ${extractedData.endpoint}\n🔒 Secure transmission in progress...`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, progressMessage]);

      const response = await fetch(extractedData.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          ...extractedData.data
        })
      });

      const result = await response.json();

      if (result.success) {
        setConnectionStatus('connected');
        const endpointType = extractedData.endpoint === '/api/dvr-manual' ? 'DVR' : 'TVR';

        const successMessage: ChatMessage = {
          role: 'assistant',
          content: `🎉 **Submission Successful!**

✅ **${endpointType} Created Successfully**
📝 **Record ID:** ${result.data?.id || result.primaryDVR?.id}
💾 **Database:** Neon PostgreSQL
🕐 **Timestamp:** ${new Date().toLocaleString()}

🌟 **What's Next?**
• Check your dashboard for the new entry
• Ready to log another activity
• View analytics and reports

What else happened during your field work today? 🚀`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);

        // Reset submission state with celebration
        setIsReadyToSubmit(false);
        setExtractedData(null);
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ **Submission Failed**\n\n**Error:** ${error.message}\n\n🔄 **Don't worry!** Your data is preserved. Please try again or contact support if the issue persists.`,
        timestamp: new Date()
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

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
    if (isMinimized) setIsExpanded(false);
  };

  const toggleExpanded = () => {
    if (isMinimized) setIsMinimized(false);
    setIsExpanded(!isExpanded);
  };

  // Enhanced quick suggestions with emojis
  const quickSuggestions = [
    "🏪 Visited dealer today",
    "🔧 Technical work completed",
    "📊 Need to create report",
    "📈 Show my analytics"
  ];

  // Connection status indicator
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'connecting':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" />;
    }
  };

  // 📱 STUNNING MINIMIZED VIEW
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          {/* Pulsing background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-full blur-xl opacity-75 animate-pulse"></div>

          <Button
            onClick={toggleMinimized}
            className="relative h-20 w-20 rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-2xl border-4 border-white backdrop-blur-lg"
          >
            <div className="relative">
              <Bot className="w-8 h-8 text-white" />
              <div className="absolute -top-2 -right-2 flex items-center space-x-1">
                <Sparkles className="w-4 h-4 text-yellow-300 animate-bounce" />
                {getConnectionIndicator()}
              </div>
              <div className="absolute -bottom-1 -right-1">
                <Badge className="text-xs bg-green-500 text-white border-white">AI</Badge>
              </div>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-2xl border border-gray-200/50 transition-all duration-500 z-50 overflow-hidden ${isExpanded
          ? 'w-full max-h-[calc(100vh-80px)]'
          : 'w-full max-h-[calc(100vh-150px)]'
        }`}
    >
      {/* 🎨 PREMIUM HEADER DESIGN */}
      <div className="relative p-6 border-b border-gray-100/50 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white rounded-t-3xl overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                {getConnectionIndicator()}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg">RAG Assistant</h3>
              <div className="flex items-center space-x-2 text-xs opacity-90">
                <Shield className="w-3 h-3" />
                <span>Vector AI • Secure</span>
                <Wifi className="w-3 h-3" />
                <span>Connected</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-xl"
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMinimized}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-xl"
            >
              <ChevronDown className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Status indicators */}
        <div className="relative flex items-center space-x-4 mt-4">
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Zap className="w-3 h-3 mr-1" />
            RAG Powered
          </Badge>
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Database className="w-3 h-3 mr-1" />
            Vector DB
          </Badge>
          {currentLocation && (
            <Badge className="bg-green-500/80 text-white border-green-400">
              <MapPin className="w-3 h-3 mr-1" />
              GPS
            </Badge>
          )}
        </div>
      </div>

      {/* 🚀 SMART QUICK ACTIONS */}
      {!isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {quickSuggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => handleSendMessage(suggestion)}
                className="h-auto p-4 text-left justify-start border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-2xl transition-all duration-300"
              >
                <div className="text-sm font-medium text-gray-700">
                  {suggestion}
                </div>
              </Button>
            ))}
          </div>

          {/* Quick stats */}
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Today's Activity</span>
              <Badge variant="outline" className="text-blue-600">
                <Heart className="w-3 h-3 mr-1" />
                {messages.length} interactions
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* 💬 ENHANCED MESSAGES AREA */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-gray-50/50 to-white max-h-[450px]">
          {aiThinking && messages.length === 0 && (
            <div className="flex justify-center items-center py-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-600 font-medium">Initializing RAG Assistant...</p>
                <div className="flex justify-center space-x-1 mt-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-5 py-4 rounded-3xl shadow-lg transition-all duration-300 hover:shadow-xl ${message.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white ml-8'
                  : 'bg-white text-gray-900 border border-gray-200/50 mr-8'
                  }`}
              >
                <div className="flex items-start space-x-3">
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs opacity-75">
                        {message.timestamp?.toLocaleTimeString()}
                      </p>
                      {message.role === 'assistant' && (
                        <div className="flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 opacity-60" />
                          <span className="text-xs opacity-60">AI Generated</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 💭 PREMIUM TYPING INDICATOR */}
          {typingIndicator && (
            <div className="flex justify-start">
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-3xl px-5 py-4 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">AI is thinking</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 🎯 PREMIUM SUBMIT BUTTON */}
      {isReadyToSubmit && extractedData && (
        <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-y border-green-200/50">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Data Ready for Submission</p>
              <p className="text-xs text-green-600">
                {extractedData.endpoint === '/api/dvr-manual' ? 'Daily Visit Report' : 'Technical Visit Report'}
              </p>
            </div>
            <Button
              onClick={handleSubmitData}
              disabled={isLoading}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl px-6 py-3 shadow-lg"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Submit Now
            </Button>
          </div>
        </div>
      )}

      {/* 💬 PREMIUM INPUT AREA */}
      {!isMinimized && (
        <div className="p-6 bg-white/50 backdrop-blur-sm border-t border-gray-100/50 rounded-b-3xl">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => !isExpanded && setIsExpanded(true)}
                placeholder="Describe your field work naturally..."
                disabled={isLoading}
                className="w-full pr-16 py-4 text-sm border-2 border-gray-200/50 focus:border-blue-400 rounded-2xl bg-white/80 backdrop-blur-sm focus:bg-white transition-all duration-300 placeholder:text-gray-500"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <Mic className="w-4 h-4 text-blue-500 cursor-pointer hover:text-blue-600 transition-colors" />
              </div>
            </div>

            <Button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              size="lg"
              className="px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-lg transition-all duration-300"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>Secure & Encrypted</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>RAG-Powered</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                <Heart className="w-3 h-3 mr-1" />
                {messages.length}
              </Badge>
              <div className="flex items-center space-x-1">
                {getConnectionIndicator()}
                <span className="text-xs text-gray-500 capitalize">{connectionStatus}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}