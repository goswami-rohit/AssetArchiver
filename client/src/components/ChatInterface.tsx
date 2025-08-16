import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, Paperclip, Sparkles, Bot, User, AlertCircle, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'message' | 'action' | 'error';
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatInterfaceProps {
  userId?: number;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'fallback' | 'error'>('connected');
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Convert our messages to ChatMessage format for API
  const formatMessagesForAPI = useCallback((messageHistory: Message[]): ChatMessage[] => {
    return messageHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }, []);

  // Primary API call to /api/ai/chat
  const callPrimaryAI = async (userInput: string): Promise<string> => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userInput,
        userId: currentUserId,
        context: {
          conversationHistory: messages.slice(-5), // Last 5 messages for context
          timestamp: new Date().toISOString()
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Primary AI failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'AI orchestration failed');
    }

    setConnectionStatus('connected');
    
    // If the AI executed steps, show them
    if (data.executedSteps && data.executedSteps.length > 0) {
      const stepsInfo = data.executedSteps.map((step: any) => step.type).join(', ');
      return `${data.message}\n\n✅ Executed: ${stepsInfo}`;
    }
    
    return data.message || 'Task completed successfully.';
  };

  // Fallback to RAG chat
  const callRAGChat = async (userInput: string): Promise<string> => {
    const chatMessages = formatMessagesForAPI(messages);
    chatMessages.push({ role: 'user', content: userInput });

    const response = await fetch('/api/rag/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: chatMessages,
        userId: currentUserId
      }),
    });

    if (!response.ok) {
      throw new Error(`RAG Chat failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'RAG chat failed');
    }

    setConnectionStatus('fallback');
    return data.message || 'I received your message but couldn\'t process it properly.';
  };

  // Final fallback to RAG submit (for structured data)
  const callRAGSubmit = async (userInput: string): Promise<string> => {
    const chatMessages = formatMessagesForAPI(messages);
    chatMessages.push({ role: 'user', content: userInput });

    const response = await fetch('/api/rag/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: chatMessages,
        userId: currentUserId
      }),
    });

    if (!response.ok) {
      throw new Error(`RAG Submit failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'RAG submit failed');
    }

    setConnectionStatus('fallback');
    
    if (data.endpoint && data.recordId) {
      return `✅ Successfully created ${data.endpoint.replace('/api/', '').toUpperCase()} record #${data.recordId}!\n\n${data.message}`;
    }
    
    return data.message || 'Data submitted successfully.';
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    if (!currentUserId) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: 'Please log in to use the AI assistant.',
        sender: 'ai',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      let aiResponse: string;
      
      // Try primary AI first
      try {
        console.log('🎯 Trying primary AI endpoint...');
        aiResponse = await callPrimaryAI(currentInput);
      } catch (primaryError) {
        console.warn('Primary AI failed, trying RAG chat...', primaryError);
        
        // Fallback to RAG chat
        try {
          aiResponse = await callRAGChat(currentInput);
        } catch (ragChatError) {
          console.warn('RAG chat failed, trying RAG submit...', ragChatError);
          
          // Final fallback to RAG submit
          try {
            aiResponse = await callRAGSubmit(currentInput);
          } catch (ragSubmitError) {
            console.error('All AI endpoints failed:', ragSubmitError);
            setConnectionStatus('error');
            throw new Error('All AI services are currently unavailable. Please try again later.');
          }
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
        type: connectionStatus === 'connected' ? 'action' : 'message'
      };

      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, currentUserId, connectionStatus]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const quickActions = [
    { 
      icon: Sparkles, 
      text: "Create DVR Report", 
      action: () => setInput("I need to create a daily visit report for today's dealer visit") 
    },
    { 
      icon: Bot, 
      text: "Show my tasks", 
      action: () => setInput("Show me my pending tasks for today") 
    },
    { 
      icon: CheckCircle, 
      text: "Punch attendance", 
      action: () => setInput("Help me punch in my attendance") 
    },
    { 
      icon: AlertCircle, 
      text: "Create PJP", 
      action: () => setInput("I want to create a new journey plan") 
    },
  ];

  // Connection status indicator
  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: 'bg-green-400', text: 'AI Orchestration Active' };
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
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusIndicator.color} rounded-full border-2 border-white shadow-sm`}></div>
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                AI Assistant
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{statusIndicator.text}</p>
            </div>
          </div>
          
          {/* User indicator */}
          {currentUserId && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              User ID: {currentUserId}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
              AI-Powered Field Assistant
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Create reports, manage tasks, get insights, and automate your field work with AI.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end space-x-3`}>
              <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shadow-lg ${
                message.sender === 'user' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
                  : message.type === 'error'
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : message.type === 'action'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600'
              }`}>
                {message.sender === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : message.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-white" />
                ) : message.type === 'action' ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className={`backdrop-blur-xl shadow-xl rounded-3xl px-6 py-4 ${
                message.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                  : message.type === 'error'
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                  : 'bg-white/70 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 border border-white/20'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-2 ${
                  message.sender === 'user' 
                    ? 'text-blue-100' 
                    : message.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
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

      {/* Quick Actions */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-white/20">
        <div className="flex space-x-3 overflow-x-auto">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/20 rounded-2xl hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-lg hover:shadow-xl group"
            >
              <action.icon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                {action.text}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-6 border-t border-white/20 backdrop-blur-xl bg-white/5 dark:bg-black/5">
        <div className="relative flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={currentUserId ? "Ask me to create reports, manage tasks, or get insights..." : "Please log in to chat"}
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
    </div>
  );
};

export default ChatInterface;