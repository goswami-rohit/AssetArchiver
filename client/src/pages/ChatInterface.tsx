// src/pages/ChatInterface.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, Paperclip, Sparkles, Bot, User, AlertCircle, CheckCircle,
  Building2, MapPin, Phone, FileText, Calendar, Users, Plus,
  ThumbsUp, ThumbsDown, Star, Clock, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Import your forms from the forms index (user requested)
import DVRForm from '@/pages/forms/DVRForm';
import TVRForm from '@/pages/forms/TVRForm';
import AddDealerForm from '@/pages/forms/AddDealerForm';
import SalesOrderForm from '@/pages/forms/SalesOrderForm';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'message' | 'action' | 'error' | 'form' | 'success';
  metadata?: any;
}

interface Dealer {
  id: string;
  dealerName: string;
  location: string;
  contactPerson?: string;
  contactPersonPhoneNo?: string;
}

interface FormData {
  [key: string]: any;
}

interface ChatInterfaceProps {
  userId?: number;
  onBack?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userId, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'fallback' | 'error'>('connected');
  const [currentFlow, setCurrentFlow] = useState<'chat' | 'dvr' | 'tvr' | 'dealer' | 'salesOrder' | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get userId from localStorage if not provided
  const currentUserId = userId || (() => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData).id : null;
    } catch {
      return null;
    }
  })();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, currentFlow, isLoading]);

  // Fetch dealers on component mount
  useEffect(() => {
    if (currentUserId) {
      fetchDealers();
    }
  }, [currentUserId]);

  // Fetch dealers using new API
  const fetchDealers = useCallback(async () => {
    try {
      const response = await fetch(`/api/dealers/user/${currentUserId}?limit=20`);
      const data = await response.json();
      if (data.success) {
        setDealers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch dealers:', error);
    }
  }, [currentUserId]);

  // Enhanced Vector RAG Chat
  const callVectorRAGChat = useCallback(async (userInput: string): Promise<any> => {
    const response = await fetch('/api/rag/vector-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userInput,
        userId: currentUserId
      }),
    });

    if (!response.ok) {
      throw new Error(`Vector RAG failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Vector RAG failed');
    }

    setConnectionStatus('connected');
    return data;
  }, [currentUserId]);

  // Start DVR Flow
  const startDVRFlow = useCallback(() => {
    setCurrentFlow('dvr');
    setShowQuickActions(false);
    setFormData({
      reportDate: new Date().toISOString().split('T')[0],
      visitType: 'Regular'
    });

    const dvrMessage: Message = {
      id: Date.now().toString(),
      content: 'Starting Daily Visit Report creation...',
      sender: 'ai',
      timestamp: new Date(),
      type: 'form',
      metadata: { flowType: 'dvr', step: 'dealer' }
    };
    setMessages(prev => [...prev, dvrMessage]);
  }, []);

  // Start TVR Flow
  const startTVRFlow = useCallback(() => {
    setCurrentFlow('tvr');
    setShowQuickActions(false);
    setFormData({
      reportDate: new Date().toISOString().split('T')[0],
      visitType: 'Installation'
    });

    const tvrMessage: Message = {
      id: Date.now().toString(),
      content: 'Starting Technical Visit Report creation...',
      sender: 'ai',
      timestamp: new Date(),
      type: 'form',
      metadata: { flowType: 'tvr', step: 'site' }
    };
    setMessages(prev => [...prev, tvrMessage]);
  }, []);

  // Start Dealer Creation Flow
  const startDealerFlow = useCallback(() => {
    setCurrentFlow('dealer');
    setShowQuickActions(false);
    setFormData({});

    const dealerMessage: Message = {
      id: Date.now().toString(),
      content: 'Creating new dealer...',
      sender: 'ai',
      timestamp: new Date(),
      type: 'form',
      metadata: { flowType: 'dealer', step: 'basic' }
    };
    setMessages(prev => [...prev, dealerMessage]);
  }, []);

  // Submit form data using vector RAG
  const submitFormData = useCallback(async (endpoint: string, data: any) => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/rag/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          data,
          userId: currentUserId
        }),
      });

      const result = await response.json();

      if (result.success) {
        const successMessage: Message = {
          id: Date.now().toString(),
          content: `✅ Successfully created ${endpoint.replace('/api/', '').toUpperCase()} record!`,
          sender: 'ai',
          timestamp: new Date(),
          type: 'success',
          metadata: { recordId: result.data?.id, endpoint }
        };
        setMessages(prev => [...prev, successMessage]);

        // Reset flow
        setCurrentFlow(null);
        setFormData({});
        setShowQuickActions(true);

        // Refresh dealers if dealer was created
        if (endpoint === '/api/dealers') {
          await fetchDealers();
        }
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ Error: ${error instanceof Error ? error.message : 'Submission failed'}`,
        sender: 'ai',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, fetchDealers]);

  // Handle regular chat
  const handleRegularChat = useCallback(async (userInput: string) => {
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await callVectorRAGChat(userInput);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: result.message,
        sender: 'ai',
        timestamp: new Date(),
        type: result.data ? 'success' : 'message',
        metadata: {
          endpoint: result.endpoint,
          similarity: result.similarity,
          vectorSearch: true
        }
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [callVectorRAGChat]);

  // Render DVR Form wrapper (delegates to imported component)
  const renderDVRForm = () => (
    <div className="w-full max-w-md mx-auto">
      <DVRForm />
    </div>
  );

  // Render TVR Form wrapper
  const renderTVRForm = () => (
    <div className="w-full max-w-md mx-auto">
      <TVRForm />
    </div>
  );

  // Render Dealer Form wrapper
  const renderDealerForm = () => (
    <div className="w-full max-w-md mx-auto">
      <AddDealerForm />
    </div>
  );

  // Render Sales Order Form wrapper
  const renderSalesOrderForm = () => (
    <div className="w-full max-w-md mx-auto">
      <SalesOrderForm />
    </div>
  );

  // Enhanced Quick Actions
  const quickActions = [
    {
      icon: FileText,
      text: "Create DVR",
      description: "Daily Visit Report",
      color: "from-blue-500 to-blue-600",
      action: startDVRFlow
    },
    {
      icon: FileText,
      text: "Create TVR",
      description: "Technical Visit Report",
      color: "from-green-500 to-green-600",
      action: startTVRFlow
    },
    {
      icon: Building2,
      text: "New Dealer",
      description: "Add dealer to system",
      color: "from-purple-500 to-purple-600",
      action: startDealerFlow
    },
    {
      icon: Calendar,
      text: "Create PJP",
      description: "Journey Plan",
      color: "from-orange-500 to-orange-600",
      action: () => setInput("I want to create a new permanent journey plan")
    },
    {
      icon: Clock,
      text: "Punch In",
      description: "Mark attendance",
      color: "from-emerald-500 to-emerald-600",
      action: () => setInput("Help me punch in my attendance")
    },
    {
      icon: Users,
      text: "View Tasks",
      description: "Today's tasks",
      color: "from-indigo-500 to-indigo-600",
      action: () => setInput("Show me my pending tasks for today")
    }
  ];

  // Handle send message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || currentFlow) return;

    const currentInput = input.trim();
    setInput('');

    await handleRegularChat(currentInput);
    inputRef.current?.focus();
  }, [input, isLoading, currentFlow, handleRegularChat]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Connection status indicator
  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: 'bg-green-400', text: 'Vector RAG Active' };
      case 'fallback':
        return { color: 'bg-yellow-400', text: 'Using Fallback Mode' };
      case 'error':
        return { color: 'bg-red-400', text: 'Connection Issues' };
      default:
        return { color: 'bg-gray-400', text: 'Connecting...' };
    }
  };

  const statusIndicator = getStatusIndicator();

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-white/20 backdrop-blur-xl bg-white/10 dark:bg-black/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-2xl p-2 hover:bg-black/10 dark:hover:bg-white/10"
                aria-label="Back"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusIndicator.color} rounded-full border-2 border-white shadow-sm`}></div>
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Enhanced AI Assistant
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{statusIndicator.text}</p>
            </div>
          </div>

          {currentUserId && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              User ID: {currentUserId} | Dealers: {dealers.length}
            </div>
          )}
        </div>
      </div>

      {/* Messages: the scrollable region */}
      <div
        className="flex-1 overflow-y-auto p-6 space-y-6"
        style={{ paddingBottom: `calc(7rem + env(safe-area-inset-bottom))` }}
      >
        {messages.length === 0 && showQuickActions && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Vector-Powered Field Assistant
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Create reports, manage dealers, and automate workflows with intelligent buttons and AI.
            </p>
          </div>
        )}

        {/* Render Forms */}
        {currentFlow === 'dvr' && renderDVRForm()}
        {currentFlow === 'tvr' && renderTVRForm()}
        {currentFlow === 'dealer' && renderDealerForm()}
        {currentFlow === 'salesOrder' && renderSalesOrderForm()}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} py-1`}
          >
            <div className={`flex max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end space-x-3`}>
              <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shadow-lg ${message.sender === 'user'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                : message.type === 'error'
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : message.type === 'success'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                }`}>
                {message.sender === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : message.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-white" />
                ) : message.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className={`backdrop-blur-xl shadow-xl rounded-3xl px-6 py-4 ${message.sender === 'user'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                : message.type === 'error'
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                  : message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                    : 'bg-white/70 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 border border-white/20'
                }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.metadata?.endpoint && (
                  <div className="mt-2 text-xs opacity-70">
                    <span className="font-mono bg-black/10 px-1 rounded">
                      {message.metadata.endpoint}
                    </span>
                    {message.metadata.similarity && (
                      <span className="ml-2">
                        Similarity: {message.metadata.similarity.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
                <p className={`text-xs mt-2 ${message.sender === 'user'
                  ? 'text-blue-100'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start py-1">
            <div className="flex items-end space-x-3">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/20 rounded-3xl px-6 py-4 shadow-xl">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Quick Actions */}
      {showQuickActions && !currentFlow && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/20 backdrop-blur-xl bg-white/5 dark:bg-black/5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className={`flex flex-col items-center space-y-2 p-4 bg-gradient-to-r ${action.color} text-white rounded-2xl hover:shadow-xl transition-all duration-200 transform hover:scale-105 group`}
              >
                <action.icon className="w-6 h-6" />
                <div className="text-center">
                  <span className="text-sm font-medium block">{action.text}</span>
                  <span className="text-xs opacity-80">{action.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input (anchored) */}
      {!currentFlow && (
        <div
          className="flex-shrink-0 p-6 border-t border-white/20 backdrop-blur-xl bg-white/5 dark:bg-black/5"
          style={{ paddingBottom: `env(safe-area-inset-bottom)` }}
        >
          <div className="relative flex items-center space-x-4">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={currentUserId ? "Ask me anything or use the buttons above..." : "Please log in to chat"}
                disabled={isLoading || !currentUserId}
                className="w-full px-6 py-4 pr-20 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 shadow-xl transition-all duration-200 disabled:opacity-50"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors"
                  disabled={!currentUserId}
                >
                  <Paperclip className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
                <button
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors"
                  disabled={!currentUserId}
                >
                  <Mic className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || !currentUserId}
              className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 rounded-3xl text-white shadow-xl hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
