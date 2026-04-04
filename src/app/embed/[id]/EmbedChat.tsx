"use client";

import { useRef, useState, useCallback } from "react";
import { Send, ChevronDown, Paperclip, X, FileText } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";

export type Appearance = {
  primaryColor: string;
  headerBg: string;
  userBubbleBg: string;
  botBubbleBg: string;
  userBubbleText: string;
  botBubbleText: string;
  greetingMessage: string;
  placeholder: string;
  sendButtonLabel: string;
  agentName: string;
  avatar: string;
  showBranding: boolean;
  position: "bottom-right" | "bottom-left" | "inline";
  windowWidth: number;
  borderRadius: number;
  launcherColor?: string;
  launcherSize?: "sm" | "md" | "lg";
  launcherLabel?: string;
};

export type AgentConfig = {
  id: string;
  name: string;
  appearance: Appearance;
  starter_questions: string[];
};

type AttachedFile = {
  name: string;
  type: string;
  dataUrl: string;
  size: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: AttachedFile[];
};

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);
    [[880, 0, 0.12], [1108, 0.06, 0.10]].forEach(([freq, start, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
    setTimeout(() => ctx.close(), 600);
  } catch { /* AudioContext not available */ }
}

function TypingIndicator({ color, avatar }: { color: string; avatar: string }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: color + "1a" }}>
        {avatar}
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex gap-1 items-center h-4">
          {[0, 150, 300].map(delay => (
            <span key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: `${delay}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmbedChat({ agent }: { agent: AgentConfig }) {
  const greeting = agent.appearance?.greetingMessage ?? "Hi! How can I help you today?";
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: greeting, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const primaryColor = agent.appearance?.primaryColor ?? "#7c3aed";
  const headerBg = agent.appearance?.headerBg ?? primaryColor;
  const userBubbleBg = agent.appearance?.userBubbleBg ?? primaryColor;
  const botBubbleBg = agent.appearance?.botBubbleBg ?? "#ffffff";
  const userBubbleText = agent.appearance?.userBubbleText ?? "#ffffff";
  const botBubbleText = agent.appearance?.botBubbleText ?? "#1f2937";
  const avatar = agent.appearance?.avatar ?? "🤖";
  const borderRadius = agent.appearance?.borderRadius ?? 16;
  const hasUserSentMessage = messages.some(m => m.role === "user");

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const MAX = 10 * 1024 * 1024;
    files.forEach(file => {
      if (file.size > MAX) { alert(`${file.name} is too large (max 10 MB)`); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        setAttachments(prev => [...prev, {
          name: file.name, type: file.type,
          dataUrl: ev.target?.result as string, size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, []);

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const sendMessage = async (text: string, files: AttachedFile[] = []) => {
    if ((!text.trim() && files.length === 0) || streaming) return;

    const userMsg: Message = { role: "user", content: text.trim(), timestamp: new Date(), attachments: files.length > 0 ? files : undefined };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setStreaming(true);
    setStreamingText("");

    // Scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const apiMessages = nextMessages.map(m => {
      let content = m.content;
      if (m.attachments?.length) {
        const fileInfo = m.attachments.map(f =>
          f.type.startsWith("image/")
            ? `[Image attached: ${f.name}] (base64: ${f.dataUrl.slice(0, 100)}...)`
            : `[File attached: ${f.name}, type: ${f.type}, size: ${formatSize(f.size)}]`
        ).join("\n");
        content = content ? `${content}\n\n${fileInfo}` : fileInfo;
      }
      return { role: m.role, content };
    });

    let accumulated = "";
    let serverError = "";

    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `Request failed (${res.status})`); }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break outer;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) serverError = parsed.error;
            if (parsed.text) { accumulated += parsed.text; setStreamingText(accumulated); }
          } catch { /* skip */ }
        }
      }

      const finalContent = accumulated || (serverError ? `Error: ${serverError}` : "Sorry, I couldn't generate a response.");
      const finalMessages: Message[] = [...nextMessages, { role: "assistant", content: finalContent, timestamp: new Date() }];
      setMessages(finalMessages);
      setStreamingText("");
      playNotificationSound();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

      // Save conversation: POST once per session, PATCH thereafter
      const msgPayload = finalMessages.map(m => ({ role: m.role, content: m.content }));
      if (!conversationIdRef.current) {
        fetch(`/api/agents/${agent.id}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgPayload, message_count: finalMessages.length, source: "embed" }),
        }).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.id) conversationIdRef.current = data.id;
        }).catch(() => {});
      } else {
        fetch(`/api/agents/${agent.id}/conversations`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationIdRef.current, messages: msgPayload, message_count: finalMessages.length }),
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${msg}`, timestamp: new Date() }]);
      setStreamingText("");
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input, attachments); };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 text-white flex-shrink-0" style={{ backgroundColor: headerBg }}>
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-xl flex-shrink-0">{avatar}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">{agent.appearance?.agentName || agent.name}</span>
            <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full inline-block" /> Online
            </span>
          </div>
          <p className="text-xs text-white/70 truncate">{agent.name}</p>
        </div>
        <button
          onClick={() => { if (typeof window !== "undefined" && window.parent !== window) window.parent.postMessage("fm-minimize", "*"); }}
          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          title="Minimize"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 mb-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: primaryColor + "1a" }}>{avatar}</div>
            )}
            <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.attachments?.map((f, fi) => (
                <div key={fi} className="mb-1">
                  {f.type.startsWith("image/") ? (
                    <img src={f.dataUrl} alt={f.name} className="max-w-[220px] max-h-[180px] rounded-xl object-cover shadow-sm border border-white/30" />
                  ) : (
                    <div className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-xs" style={{ color: msg.role === "user" ? userBubbleText : botBubbleText }}>
                      <FileText size={14} />
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <span className="opacity-60">{formatSize(f.size)}</span>
                    </div>
                  )}
                </div>
              ))}
              {msg.content && (
                <div
                  className="px-4 py-2.5"
                  style={{
                    backgroundColor: msg.role === "user" ? userBubbleBg : botBubbleBg,
                    color: msg.role === "user" ? userBubbleText : botBubbleText,
                    borderRadius: msg.role === "user" ? `${borderRadius}px ${borderRadius}px 4px ${borderRadius}px` : `${borderRadius}px ${borderRadius}px ${borderRadius}px 4px`,
                    boxShadow: msg.role === "assistant" ? "0 1px 3px rgba(0,0,0,0.06)" : undefined,
                    border: msg.role === "assistant" ? "1px solid rgba(0,0,0,0.06)" : undefined,
                  }}
                >
                  {msg.role === "assistant"
                    ? <MarkdownMessage content={msg.content} textColor="text-inherit" />
                    : <span className="text-sm leading-relaxed">{msg.content}</span>
                  }
                </div>
              )}
              <span className="text-xs text-gray-400 px-1">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}

        {streaming && !streamingText && <TypingIndicator color={primaryColor} avatar={avatar} />}

        {streamingText && (
          <div className="flex items-end gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: primaryColor + "1a" }}>{avatar}</div>
            <div className="max-w-[80%]">
              <div className="px-4 py-2.5" style={{ backgroundColor: botBubbleBg, color: botBubbleText, borderRadius: `${borderRadius}px ${borderRadius}px ${borderRadius}px 4px`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.06)" }}>
                <MarkdownMessage content={streamingText} textColor="text-inherit" isStreaming />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Starter Questions */}
      {!hasUserSentMessage && agent.starter_questions?.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {agent.starter_questions.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm"
              style={{ borderColor: primaryColor + "66", color: primaryColor, backgroundColor: primaryColor + "0d" }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="px-4 pb-1 flex flex-wrap gap-2">
          {attachments.map((f, i) => (
            <div key={i} className="relative group">
              {f.type.startsWith("image/") ? (
                <img src={f.dataUrl} alt={f.name} className="w-14 h-14 rounded-lg object-cover border border-gray-200 shadow-sm" />
              ) : (
                <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 max-w-[140px]">
                  <FileText size={12} className="flex-shrink-0" />
                  <span className="truncate">{f.name}</span>
                </div>
              )}
              <button onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 bg-gray-50">
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.csv,.json,.md" multiple className="hidden" onChange={handleFileChange} />
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50"
            title="Attach file"
          >
            <Paperclip size={15} />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={agent.appearance?.placeholder ?? "Type a message..."}
            disabled={streaming}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none bg-white disabled:opacity-60 transition-all"
            onFocus={e => { e.currentTarget.style.borderColor = primaryColor; }}
            onBlur={e => { e.currentTarget.style.borderColor = ""; }}
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || streaming}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {streaming
              ? <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "white" }} />
              : <Send size={15} />
            }
          </button>
        </form>
      </div>

      {/* Branding */}
      {agent.appearance?.showBranding && (
        <div className="text-center pb-2 flex-shrink-0">
          <span className="text-xs text-gray-300">Powered by FlowMake</span>
        </div>
      )}
    </div>
  );
}
