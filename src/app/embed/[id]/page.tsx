"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot } from "lucide-react";

type Appearance = {
  primaryColor: string;
  greetingMessage: string;
  placeholder: string;
  agentName: string;
  showBranding: boolean;
};

type Chatbot = {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  appearance: Appearance;
  starter_questions: string[];
  is_active: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + "1a" }}
      >
        <Bot size={14} style={{ color }} />
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex gap-1 items-center h-4">
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: color, animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: color, animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: color, animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve params
  useEffect(() => {
    params.then(p => setAgentId(p.id));
  }, [params]);

  // Load chatbot config
  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/agents/${agentId}`)
      .then(r => {
        if (!r.ok) throw new Error("Agent not found");
        return r.json();
      })
      .then((bot: Chatbot) => {
        setChatbot(bot);
        setMessages([
          {
            role: "assistant",
            content: bot.appearance.greetingMessage ?? "Hi! How can I help you today?",
            timestamp: new Date(),
          },
        ]);
      })
      .catch(e => setLoadError(e.message));
  }, [agentId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming || !chatbot || !agentId) return;

    const userMsg: Message = { role: "user", content: text.trim(), timestamp: new Date() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setStreamingText("");

    const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error("Chat request failed");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              accumulated += parsed.text;
              setStreamingText(accumulated);
            }
          } catch {
            // skip malformed
          }
        }
      }

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: accumulated, timestamp: new Date() },
      ]);
      setStreamingText("");
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const primaryColor = chatbot?.appearance.primaryColor ?? "#7c3aed";
  const hasUserSentMessage = messages.some(m => m.role === "user");

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bot size={20} className="text-red-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">Agent not found</p>
          <p className="text-xs text-gray-400 mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full animate-spin border-2 border-transparent"
            style={{ borderTopColor: primaryColor }}
          />
          <p className="text-xs text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 text-white flex-shrink-0"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">
              {chatbot.appearance.agentName || chatbot.name}
            </span>
            <span className="flex items-center gap-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full inline-block" />
              Online
            </span>
          </div>
          <p className="text-[11px] text-white/70 truncate">{chatbot.name}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 mb-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {msg.role === "assistant" && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: primaryColor + "1a" }}
              >
                <Bot size={14} style={{ color: primaryColor }} />
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "text-white rounded-2xl rounded-br-sm"
                    : "bg-white text-gray-800 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100"
                }`}
                style={msg.role === "user" ? { backgroundColor: primaryColor } : {}}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 px-1">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {streaming && !streamingText && <TypingIndicator color={primaryColor} />}

        {streamingText && (
          <div className="flex items-end gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: primaryColor + "1a" }}
            >
              <Bot size={14} style={{ color: primaryColor }} />
            </div>
            <div className="max-w-[80%]">
              <div className="bg-white text-gray-800 text-sm leading-relaxed px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100">
                {streamingText}
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Questions */}
      {!hasUserSentMessage && chatbot.starter_questions.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {chatbot.starter_questions.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm"
              style={{
                borderColor: primaryColor + "66",
                color: primaryColor,
                backgroundColor: primaryColor + "0d",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 bg-gray-50">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={chatbot.appearance.placeholder || "Type a message..."}
            disabled={streaming}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 bg-white disabled:opacity-60 transition-all"
            style={{ "--tw-ring-color": primaryColor + "40" } as React.CSSProperties}
            onFocus={e => {
              e.currentTarget.style.borderColor = primaryColor;
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "";
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {streaming ? (
              <div
                className="w-4 h-4 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: "white" }}
              />
            ) : (
              <Send size={15} />
            )}
          </button>
        </form>
      </div>

      {/* Branding */}
      {chatbot.appearance.showBranding && (
        <div className="text-center pb-2 flex-shrink-0">
          <span className="text-[10px] text-gray-300">Powered by FlowMake</span>
        </div>
      )}
    </div>
  );
}
