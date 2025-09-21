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

  // --- socket ref
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // auto-scroll to bottom when messages change
    messagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, flow]);

  const MCP_SERVER_URL: string = (import.meta.env.VITE_MCP_SERVER_URL as string);

  const buildUrl = (path: string) => {
    if (!MCP_SERVER_URL) return path;
    return `${MCP_SERVER_URL.replace(/\/+$/, "")}${path}`;
  };

  // --- Socket setup: connect to BASE_URL if provided and wire incoming messages
  useEffect(() => {
    if (!BASE_URL) return;

    try {
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
    } catch (err) {
      console.error("Failed to initialize socket to BASE_URL", err);
      socketRef.current = null;
    }
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

  // --- Send message: prefers socket emission to BASE_URL, falls back to HTTP MCP_SERVER_URL if configured.
  // If neither available, posts an explicit error message to chat.
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
        // If a hosted bot socket exists and is connected, prefer socket emission to BASE_URL
        if (BASE_URL && socketRef.current && socketRef.current.connected) {
          await new Promise<void>((resolve, reject) => {
            socketRef.current!.emit("web:sendMessage", { text: trimmed }, (ack: any) => {
              if (ack && ack.ok === false) {
                reject(new Error(ack.error || "bot_send_failed"));
              } else {
                resolve();
              }
            });

            // If server never ACKs, we still resolve after 8s to avoid hanging UI
            setTimeout(() => resolve(), 8000);
          });

          // Wait for actual reply via 'telegram:message' emitted by the server.
          return;
        }

        // If socket is not available but MCP_SERVER_URL exists, use HTTP endpoint
        if (MCP_SERVER_URL) {
          const res = await fetch(buildUrl("/api/chat"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: trimmed,
            }),
          });

          if (!res.ok) {
            let serverMsg = `Server error ${res.status}`;
            try {
              const errBody = await res.json();
              if (errBody?.error) serverMsg += `: ${errBody.error}`;
            } catch { }
            throw new Error(serverMsg);
          }

          const data = await res.json();

          let replyText: string | undefined;
          if (typeof data.reply === "string") replyText = data.reply;
          else if (typeof data.message === "string") replyText = data.message;
          else if (data.data && typeof data.data.message === "string") replyText = data.data.message;
          else if (Array.isArray(data.messages) && data.messages.length > 0) {
            data.messages.forEach((m: any) =>
              setMessages((prev) => [
                ...prev,
                {
                  id: String(m.id ?? Date.now()),
                  content: String(m.content ?? ""),
                  sender: m.sender === "user" ? "user" : "ai",
                  timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                },
              ])
            );
          } else {
            replyText = typeof data === "string" ? data : JSON.stringify(data);
          }

          if (replyText) {
            const aiMsg: Message = {
              id: String(Date.now() + 1),
              content: replyText,
              sender: "ai",
              timestamp: new Date(),
            };
            setMessages((m) => [...m, aiMsg]);
          }
          return;
        }

        // Neither socket nor HTTP endpoint available -> explicit error message
        const errorMessage: Message = {
          id: String(Date.now() + 2),
          content: `❌ Error: No socket connection to bot and no MCP_SERVER_URL configured.`,
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
    [input, MCP_SERVER_URL]
  );

  // --- Flow handlers
  const openFlow = useCallback((f: Flow) => {
    setFlow(f);
    setMiniActionsVisible(false);
  }, []);
  const closeFlow = useCallback(() => setFlow(null), []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-blue-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-semibold">Welcome To CemTemChat AI</div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-5 pb-40">
        <div className="max-w-3xl mx-auto pt-8">
          <section className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-2 text-slate-100">
              What would you like to do today?
            </h1>
            <p className="text-sm text-slate-400">
              Create DVR, TVR, Sales Orders with our assistant.
            </p>
          </section>

          {/* Messages */}
          <section className="space-y-4">
            {messages.length === 0 && (
              <div className="p-8 my-48 rounded-xl bg-slate-800/40 border border-white/6 text-center text-slate-400">
                Your conversation will appear here...
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-xl px-4 py-3 max-w-[80%] ${m.sender === "user"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "bg-slate-800/60 text-slate-100 border border-white/6"
                    }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  <div className="text-xs text-slate-400 mt-2 text-right">
                    {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesRef} />
          </section>
        </div>
      </main>

      {/* Active form panel */}
      {flow && (
        <div className="fixed left-0 right-0 bottom-20 flex justify-center z-30">
          <div className="max-w-3xl w-full px-5">
            <div className="bg-slate-900/90 border border-white/6 rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">
                  {flow === "dvr" && "Create Daily Visit Report"}
                  {flow === "tvr" && "Create Technical Visit Report"}
                  {flow === "salesOrder" && "Create Sales Order"}
                </div>
                <button
                  onClick={closeFlow}
                  className="text-xs text-slate-300 bg-slate-800/60 px-2 py-1 rounded"
                >
                  Close
                </button>
              </div>
              <div className="bg-slate-900/60 p-3 rounded">
                {flow === "dvr" && <DVRForm />}
                {flow === "tvr" && <TVRForm />}
                {flow === "salesOrder" && <SalesOrderForm />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick action chips above input (only before first msg) */}
      {messages.length === 0 && !flow && (
        <div className="fixed left-0 right-0 bottom-48 z-30 flex justify-center px-6">
          <div className="max-w-3xl w-full flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => openFlow("dvr")}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-sm font-medium text-slate-100"
            >
              <FileText className="w-5 h-5 text-blue-400" />
              Create DVR
            </button>
            <button
              onClick={() => openFlow("tvr")}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-sm font-medium text-slate-100"
            >
              <FileText className="w-5 h-5 text-green-400" />
              Create TVR
            </button>
            <button
              onClick={() => openFlow("salesOrder")}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-sm font-medium text-slate-100"
            >
              <Calendar className="w-5 h-5 text-purple-400" />
              Sales Order
            </button>
          </div>
        </div>
      )}

      {/* Input bar (fixed, plus clickable, mini actions popover - vertical stack) */}
      <div className="fixed left-0 right-0 bottom-0 z-40">
        {/* bottom nav background */}
        <div className="h-16 bg-gradient-to-t from-black/80 to-transparent border-t border-white/6" />

        {/* input wrapper (no pointer-events-none) */}
        <div className="absolute left-0 right-0 -top-20 flex justify-center px-6">
          <div className="max-w-3xl w-full pointer-events-auto flex items-center gap-3">
            {/* PLUS button + vertical popover */}
            <div className="relative flex-shrink-0 z-50">
              <button
                onClick={() => setMiniActionsVisible((s) => !s)}
                aria-label="Open actions"
                className="w-12 h-12 rounded-xl bg-slate-800/70 border border-white/6 flex items-center justify-center shadow"
              >
                <PlusIcon className="w-5 h-5 text-slate-100" />
              </button>

              {/* === Vertical popover: stacked buttons above the Plus === */}
              {miniActionsVisible && (
                <div className="absolute bottom-full mb-3 left-4 md:left-1/2 md:transform md:-translate-x-1/2 z-60 pointer-events-auto"
                  style={{ minWidth: 160 }}>
                  <div className="bg-slate-900/95 border border-white/6 rounded-xl p-2 shadow-lg flex flex-col gap-2 items-stretch">
                    <button
                      onClick={() => { openFlow("dvr"); setMiniActionsVisible(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-sm text-slate-100"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Create DVR</span>
                    </button>

                    <button
                      onClick={() => { openFlow("tvr"); setMiniActionsVisible(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-sm text-slate-100"
                    >
                      <FileText className="w-4 h-4 text-green-400" />
                      <span>Create TVR</span>
                    </button>

                    <button
                      onClick={() => { openFlow("salesOrder"); setMiniActionsVisible(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-sm text-slate-100"
                    >
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span>Sales Order</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* main input */}
            <div className="flex-1">
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
                className="w-full px-4 py-3 rounded-xl bg-slate-800/70 border border-white/6 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-100 placeholder:text-slate-500"
                disabled={isLoading}
              />
            </div>

            {/* send */}
            <div className="flex-shrink-0">
              <button
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow disabled:opacity-50"
              >
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChatInterface;
