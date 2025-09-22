// src/pages/ChatInterface.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  FileText,
  Calendar,
  Plus as PlusIcon,
} from "lucide-react";
import DVRForm from "@/pages/forms/DVRForm";
import TVRForm from "@/pages/forms/TVRForm";
import SalesOrderForm from "@/pages/forms/SalesOrderForm";
import { BASE_URL } from '@/components/ReusableUI';
import { io, Socket } from "socket.io-client";

type Flow = "dvr" | "tvr" | "salesOrder" | null;

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

const MiniActionButton: React.FC<{
  label: string;
  subtitle?: string;
  icon?: any;
  onClick?: () => void;
}> = ({ label, subtitle, icon: Icon, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-white/6 hover:scale-[1.02] transform transition"
  >
    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow">
      {Icon ? <Icon className="w-5 h-5 text-white" /> : null}
    </div>
    <div className="text-left">
      <div className="text-sm font-semibold text-slate-100">{label}</div>
      {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
    </div>
  </button>
);

const ChatInterface: React.FC = () => {
  // --- UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [flow, setFlow] = useState<Flow>(null);
  const [miniActionsVisible, setMiniActionsVisible] = useState(false);

  // --- refs
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // bottom scroll refs
  const mainRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // --- socket ref
  const socketRef = useRef<Socket | null>(null);

  // auto-scroll to bottom when messages change
  // ensure newest message is visible reliably
  useEffect(() => {
    if (!messages.length) return;

    // robust scroll helper using rAF to account for layout & keyboard
    const scrollToBottom = () => {
      // prefer scrolling the main container if available
      const container = mainRef.current;
      const endEl = messagesEndRef.current;
      if (container) {
        // smooth scroll to bottom of container
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        return;
      }
      if (endEl) {
        endEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    // run a couple of times with rAF to handle keyboard/resizes and async rendering
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });

    // also ensure we scroll if device keyboard focuses the input
    const inputEl = inputRef.current;
    if (inputEl) {
      inputEl.addEventListener('focus', scrollToBottom);
    }

    return () => {
      if (inputEl) inputEl.removeEventListener('focus', scrollToBottom);
    };
  }, [messages]);

  // --- Socket setup: connect to BASE_URL if provided and wire incoming messages
  useEffect(() => {
    if (!BASE_URL) {
      console.warn("BASE_URL not configured; socket disabled.");
      return;
    }

    const socket = io(BASE_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    const onConnect = () => {
      console.log("Connected to bot socket:", BASE_URL);
    };

    const onDisconnect = (reason: any) => {
      console.warn("Bot socket disconnected:", reason);
    };

    const onError = (err: any) => {
      console.error("Bot socket error:", err);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    // Incoming messages from the hosted telegram bot (bridge emits 'telegram:message')
    socket.on("telegram:message", (payload: any) => {
      getMessage(payload);
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.off("telegram:message");
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // --- getMessage: convert incoming socket payload into Message and append
  const getMessage = useCallback((payload: any) => {
    if (!payload) return;
    const text = (payload.text ?? payload.message ?? payload.content ?? "").toString();
    if (!text) return;

    const aiMsg: Message = {
      id: String(Date.now() + Math.floor(Math.random() * 1000)),
      content: text,
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages((m) => [...m, aiMsg]);
  }, []);

  // --- Send message: emits to socket only. If socket missing, add error message.
  const sendMessage = useCallback(
    async (opts?: { suppressQuickActionHide?: boolean }) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      if (!opts?.suppressQuickActionHide) setMiniActionsVisible(false);

      setIsLoading(true);

      const userMsg: Message = {
        id: String(Date.now()),
        content: trimmed,
        sender: "user",
        timestamp: new Date(),
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      inputRef.current?.focus();

      try {
        // If a hosted bot socket exists and is connected, emit to it and await ACK
        if (BASE_URL && socketRef.current && socketRef.current.connected) {
          await new Promise<void>((resolve, reject) => {
            socketRef.current!.emit("web:sendMessage", { text: trimmed }, (ack: any) => {
              if (ack && ack.ok === false) {
                reject(new Error(ack.error || "bot_send_failed"));
              } else {
                resolve();
              }
            });

            // safety: resolve after 8s if no ACK (server may still reply async)
            setTimeout(() => resolve(), 8000);
          });

          // Wait for actual reply via 'telegram:message' emitted by the server.
          return;
        }

        // No socket available -> explicit error message
        const errorMessage: Message = {
          id: String(Date.now() + 2),
          content: `❌ Error: No socket connection to bot (BASE_URL missing or disconnected).`,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((m) => [...m, errorMessage]);
      } catch (err: any) {
        console.error("sendMessage failed:", err);
        const errorMessage: Message = {
          id: String(Date.now() + 3),
          content: `❌ Error: ${err?.message ?? "Failed to send message"}`,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((m) => [...m, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input]
  );

  // --- Flow handlers
  const openFlow = useCallback((f: Flow) => {
    setFlow(f);
    setMiniActionsVisible(false);
  }, []);
  const closeFlow = useCallback(() => setFlow(null), []);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-blue-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-semibold">Welcome To CemTemChat AI</div>
          </div>
        </div>
      </header>

      {/* Messages / main scrollable content */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto px-5"
        style={{
          paddingBottom: "calc(72px + 84px + 16px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="max-w-3xl mx-auto pt-6">
          <section className="text-center mb-4">
            <h1 className="text-xl font-semibold mb-1 text-slate-100">
              What would you like to do today?
            </h1>
            <p className="text-xs text-slate-400">
              Create DVR, TVR, Sales Orders with our assistant.
            </p>
          </section>

          {/* Quick actions (only when empty and no flow) */}
          {messages.length === 0 && !flow && (
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-2 -mx-2 justify-center my-16">
              <div className="flex gap-3">
                <button
                  onClick={() => openFlow("dvr")}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-slate-100"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  Create DVR
                </button>
                <button
                  onClick={() => openFlow("tvr")}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-slate-100"
                >
                  <FileText className="w-4 h-4 text-green-400" />
                  Create TVR
                </button>
                <button
                  onClick={() => openFlow("salesOrder")}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-slate-100"
                >
                  <Calendar className="w-4 h-4 text-purple-400" />
                  Sales Order
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <section className="space-y-3 px-2">
            {messages.length === 0 && (
              <div className="p-6 rounded-xl bg-slate-800/40 border border-white/6 text-center text-slate-400">
                Your conversation will appear here...
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-xl px-4 py-2 max-w-[80%] text-sm ${m.sender === "user"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "bg-slate-800/60 text-slate-100 border border-white/6"
                    }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <div className="text-[10px] text-slate-400 mt-1 text-right">
                    {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </section>
        </div>
      </main>

      <footer
        className="fixed bottom-[74px] left-0 right-0 z-50 border-t border-white/6 bg-slate-900/90"
        style={{
          // include safe-area inset into footer height visually
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          {/* PLUS button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMiniActionsVisible((s) => !s)}
              aria-label="Open actions"
              className="w-10 h-10 rounded-lg bg-slate-800/70 border border-white/6 flex items-center justify-center shadow"
            >
              <PlusIcon className="w-5 h-5 text-slate-100" />
            </button>

            {miniActionsVisible && (
              <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[140px]">
                <div className="bg-slate-900/95 border border-white/6 rounded-xl p-2 shadow-lg flex flex-col gap-2">
                  <button
                    onClick={() => { openFlow("dvr"); setMiniActionsVisible(false); }}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-100"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    Create DVR
                  </button>
                  <button
                    onClick={() => { openFlow("tvr"); setMiniActionsVisible(false); }}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-100"
                  >
                    <FileText className="w-4 h-4 text-green-400" />
                    Create TVR
                  </button>
                  <button
                    onClick={() => { openFlow("salesOrder"); setMiniActionsVisible(false); }}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-100"
                  >
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Sales Order
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Input field */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask CemTemChat AI..."
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800/70 border border-white/6 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-slate-100 placeholder:text-slate-500"
            disabled={isLoading}
          />

          {/* Send button */}
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow disabled:opacity-50"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </footer>
    </div>
  );

};

export default ChatInterface;
