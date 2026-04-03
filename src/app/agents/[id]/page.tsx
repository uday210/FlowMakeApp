"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Cpu, Wrench, Palette, Code2, ChevronLeft,
  Loader2, X, Plus, Check, Copy, Send,
  Lock, Info, ExternalLink, ChevronDown, History, MessageSquare, User, Bot,
  Paperclip, File, Trash2, Shield, Sliders, Server, Monitor,
  Globe, ToggleLeft, ToggleRight, AlertTriangle, BrainCircuit, Zap,
} from "lucide-react";
//import { useRef } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "anthropic" | "openai" | "gemini" | "groq" | "mistral";

type Appearance = {
  agentName: string;
  avatar: string;
  primaryColor: string;
  headerBg: string;
  userBubbleBg: string;
  botBubbleBg: string;
  userBubbleText: string;
  botBubbleText: string;
  greetingMessage: string;
  placeholder: string;
  sendButtonLabel: string;
  showBranding: boolean;
  position: "bottom-right" | "bottom-left" | "inline";
  windowWidth: number;
  borderRadius: number;
  launcherColor: string;
  launcherSize: "sm" | "md" | "lg";
  launcherLabel: string;
};

type ConnectedWorkflow = {
  workflowId: string;
  name: string;
  description: string;
  whenToUse: string;
  enabled: boolean;
};

type Chatbot = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  knowledge_base: string;
  provider: Provider;
  model: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  appearance: Appearance;
  starter_questions: string[];
  connected_workflows: ConnectedWorkflow[];
  behavior: BehaviorConfig;
  mcp_tools: MCPTool[];
  is_active: boolean;
  created_at: string;
  agent_type: "full" | "simple";
  intents: Intent[];
};

type WorkflowItem = {
  id: string;
  name: string;
  description: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string; timestamp: Date };

type ConversationRecord = {
  id: string;
  agent_id: string;
  messages: { role: "user" | "assistant"; content: string }[];
  message_count: number;
  source: string;
  started_at: string;
  ended_at: string | null;
  session_id?: string;
  metadata?: {
    user_agent?: string;
    language?: string;
    screen?: string;
    timezone?: string;
    referrer?: string;
  };
};

type BehaviorConfig = {
  temperature_locked: boolean;
  response_format: "auto" | "markdown" | "json" | "plain";
  language: string;
  guardrails: string[];
  max_response_words: number;
};

type MCPTool = {
  id: string;
  name: string;
  server_url: string;
  description: string;
  enabled: boolean;
};

type Intent = {
  id: string;
  name: string;
  triggers: string;
  response: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<Provider, { bg: string; label: string; envVar: string }> = {
  anthropic: { bg: "#7c3aed", label: "Anthropic", envVar: "ANTHROPIC_API_KEY" },
  openai: { bg: "#10a37f", label: "OpenAI", envVar: "OPENAI_API_KEY" },
  gemini: { bg: "#4285f4", label: "Gemini (Google)", envVar: "GOOGLE_API_KEY" },
  groq: { bg: "#f97316", label: "Groq", envVar: "GROQ_API_KEY" },
  mistral: { bg: "#0ea5e9", label: "Mistral", envVar: "MISTRAL_API_KEY" },
};

const PROVIDER_MODELS: Record<Provider, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku (Fast)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet (Balanced)" },
    { value: "claude-opus-4-6", label: "Claude Opus (Powerful)" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
    { value: "gpt-4o", label: "GPT-4o (Balanced)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo (Powerful)" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Fast)" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Lightweight)" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Legacy)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Legacy)" },
  ],
  groq: [
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Fast)" },
    { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B (Balanced)" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  ],
  mistral: [
    { value: "mistral-small-latest", label: "Mistral Small (Fast)" },
    { value: "mistral-medium-latest", label: "Mistral Medium (Balanced)" },
    { value: "mistral-large-latest", label: "Mistral Large (Powerful)" },
  ],
};

const AVATAR_EMOJIS = [
  "🤖", "🎧", "💼", "🧑‍💻", "📊", "🛒", "📅", "👥",
  "🦾", "✨", "🎯", "🔧", "📱", "🌟", "💡", "🏆",
  "🎪", "🚀", "💬", "❓",
];

const DEFAULT_APPEARANCE: Appearance = {
  agentName: "Assistant",
  avatar: "🤖",
  primaryColor: "#7c3aed",
  headerBg: "#7c3aed",
  userBubbleBg: "#7c3aed",
  botBubbleBg: "#ffffff",
  userBubbleText: "#ffffff",
  botBubbleText: "#1f2937",
  greetingMessage: "Hi! How can I help you today?",
  placeholder: "Type a message...",
  sendButtonLabel: "Send",
  showBranding: true,
  position: "bottom-right",
  windowWidth: 400,
  borderRadius: 16,
  launcherColor: "#7c3aed",
  launcherSize: "md",
  launcherLabel: "",
};

// ─── Live Chat Preview ────────────────────────────────────────────────────────

function ChatPreview({ chatbot }: { chatbot: Chatbot | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const appearance = chatbot?.appearance ?? DEFAULT_APPEARANCE;
  const primaryColor = appearance.primaryColor ?? "#7c3aed";
  const headerBg = appearance.headerBg ?? primaryColor;
  const userBubbleBg = appearance.userBubbleBg ?? primaryColor;
  const botBubbleBg = appearance.botBubbleBg ?? "#ffffff";
  const userBubbleText = appearance.userBubbleText ?? "#ffffff";
  const botBubbleText = appearance.botBubbleText ?? "#1f2937";
  const borderRadius = appearance.borderRadius ?? 16;

  // Reset chat when chatbot changes
  useEffect(() => {
    if (!chatbot) return;
    setMessages([
      {
        role: "assistant",
        content: appearance.greetingMessage ?? "Hi! How can I help you today?",
        timestamp: new Date(),
      },
    ]);
    setStreamingText("");
  }, [chatbot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming || !chatbot) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim(), timestamp: new Date() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setStreamingText("");

    const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));

    let acc = "";
    let serverError = "";

    try {
      const res = await fetch(`/api/agents/${chatbot.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMsgs }),
      });

      if (!res.ok) {
        // HTTP-level error (e.g. 500 with JSON body)
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Request failed (${res.status})`);
      }
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
            if (parsed.error) { serverError = parsed.error; }
            if (parsed.text) { acc += parsed.text; setStreamingText(acc); }
          } catch { /* ignore malformed lines */ }
        }
      }

      const finalContent = acc || (serverError ? `Error: ${serverError}` : "Sorry, I couldn't generate a response.");
      const finalMessages: ChatMessage[] = [
        ...next,
        { role: "assistant", content: finalContent, timestamp: new Date() },
      ];
      setMessages(finalMessages);
      setStreamingText("");

      // Save conversation to history (only if there's at least one user + assistant exchange)
      const saveMsgs = finalMessages.filter(m => m.role !== "assistant" || m.content !== (chatbot.appearance?.greetingMessage ?? "Hi! How can I help you today?"));
      if (saveMsgs.some(m => m.role === "user")) {
        const sessionMeta = {
          user_agent: navigator.userAgent,
          language: navigator.language,
          screen: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          referrer: document.referrer || undefined,
        };
        fetch(`/api/agents/${chatbot.id}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: saveMsgs.map(m => ({ role: m.role, content: m.content })),
            message_count: saveMsgs.length,
            source: "preview",
            metadata: sessionMeta,
          }),
        }).catch(() => { /* non-critical */ });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}`, timestamp: new Date() },
      ]);
      setStreamingText("");
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const hasUserMessage = messages.some(m => m.role === "user");

  if (!chatbot) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading preview...</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-center bg-gray-100 p-6 overflow-hidden"
    >
      <div
        className="flex flex-col overflow-hidden shadow-xl bg-white"
        style={{
          width: `${Math.min(appearance.windowWidth ?? 400, 520)}px`,
          height: "600px",
          borderRadius: `${borderRadius}px`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 text-white flex-shrink-0"
          style={{ backgroundColor: headerBg }}
        >
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-xl">
            {appearance.avatar ?? "🤖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">
                {appearance.agentName || chatbot.name}
              </span>
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
                Online
              </span>
            </div>
            <p className="text-xs text-white/70 truncate">{chatbot.name}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-gray-50">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 mb-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ backgroundColor: primaryColor + "1a" }}
                >
                  {appearance.avatar ?? "🤖"}
                </div>
              )}
              <div
                className="max-w-[75%] px-3 py-2"
                style={{
                  backgroundColor: msg.role === "user" ? userBubbleBg : botBubbleBg,
                  color: msg.role === "user" ? userBubbleText : botBubbleText,
                  borderRadius:
                    msg.role === "user"
                      ? `${borderRadius}px ${borderRadius}px 4px ${borderRadius}px`
                      : `${borderRadius}px ${borderRadius}px ${borderRadius}px 4px`,
                  boxShadow: msg.role === "assistant" ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
                  border: msg.role === "assistant" ? "1px solid rgba(0,0,0,0.06)" : undefined,
                }}
              >
                {msg.role === "assistant" ? (
                  <MarkdownMessage content={msg.content} textColor="text-inherit" />
                ) : (
                  <span className="text-xs leading-relaxed">{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {streaming && !streamingText && (
            <div className="flex items-end gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: primaryColor + "1a" }}
              >
                {appearance.avatar ?? "🤖"}
              </div>
              <div
                className="px-3 py-2 text-xs"
                style={{
                  backgroundColor: botBubbleBg,
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: `${borderRadius}px ${borderRadius}px ${borderRadius}px 4px`,
                }}
              >
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: primaryColor, animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {streamingText && (
            <div className="flex items-end gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: primaryColor + "1a" }}
              >
                {appearance.avatar ?? "🤖"}
              </div>
              <div
                className="max-w-[75%] px-3 py-2"
                style={{
                  backgroundColor: botBubbleBg,
                  color: botBubbleText,
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: `${borderRadius}px ${borderRadius}px ${borderRadius}px 4px`,
                }}
              >
                <MarkdownMessage content={streamingText} textColor="text-inherit" isStreaming />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Starter Questions */}
        {!hasUserMessage && chatbot.starter_questions?.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5 bg-gray-50">
            {chatbot.starter_questions.slice(0, 3).map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="text-xs px-2.5 py-1 rounded-full border transition-all hover:shadow-sm"
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
        <div className="px-3 pb-3 pt-2 bg-white border-t border-gray-100 flex-shrink-0">
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2 items-center"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={appearance.placeholder ?? "Type a message..."}
              disabled={streaming}
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none bg-gray-50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <Send size={13} />
            </button>
          </form>
        </div>

        {/* Branding */}
        {appearance.showBranding && (
          <div className="text-center pb-2 bg-white flex-shrink-0">
            <span className="text-xs text-gray-300">Powered by FlowMake</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const [newQ, setNewQ] = useState("");
  const [knowledgeFiles, setKnowledgeFiles] = useState<{ filename: string; chunks: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing knowledge files from DB
  useEffect(() => {
    fetch(`/api/agents/${chatbot.id}/knowledge`)
      .then(r => r.json())
      .then(d => setKnowledgeFiles(d.files ?? []))
      .catch(() => {});
  }, [chatbot.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/agents/${chatbot.id}/knowledge`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const result = await res.json() as { filename: string; chunks_created: number };
      setKnowledgeFiles(prev => {
        const filtered = prev.filter(f => f.filename !== result.filename);
        return [...filtered, { filename: result.filename, chunks: result.chunks_created }];
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    setDeletingFile(filename);
    try {
      const res = await fetch(
        `/api/agents/${chatbot.id}/knowledge?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      setKnowledgeFiles(prev => prev.filter(f => f.filename !== filename));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setDeletingFile(null);
    }
  };

  const addQuestion = () => {
    const q = newQ.trim();
    if (!q) return;
    onChange({ starter_questions: [...(chatbot.starter_questions ?? []), q] });
    setNewQ("");
  };

  const removeQuestion = (i: number) => {
    onChange({
      starter_questions: chatbot.starter_questions.filter((_, idx) => idx !== i),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Agent Name</label>
        <input
          value={chatbot.name}
          onChange={e => onChange({ name: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description</label>
        <textarea
          value={chatbot.description}
          onChange={e => onChange({ description: e.target.value })}
          rows={2}
          placeholder="What does this agent do?"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
        />
      </div>

      {chatbot.agent_type !== "simple" && (
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">System Prompt</label>
          <p className="text-xs text-gray-400 mb-1.5">
            The instructions that define your agent&apos;s personality and behavior.
          </p>
          <textarea
            value={chatbot.system_prompt}
            onChange={e => onChange({ system_prompt: e.target.value })}
            rows={6}
            placeholder="You are a helpful assistant..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
          />
        </div>
      )}

      {chatbot.agent_type !== "simple" && <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-gray-600">Knowledge Base</label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50 transition-colors"
          >
            {uploading
              ? <><Loader2 size={10} className="animate-spin" /> Embedding...</>
              : <><Paperclip size={10} /> Upload file</>
            }
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
        <p className="text-xs text-gray-400 mb-1.5">
          Files are chunked &amp; embedded as vectors — only relevant chunks are retrieved per query.
          Supports .txt, .md, .csv, .json, .pdf
        </p>

        {/* Uploaded files list */}
        {knowledgeFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {knowledgeFiles.map(f => (
              <span key={f.filename} className="flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full">
                <File size={9} />
                {f.filename}
                <span className="text-violet-400 ml-0.5">({f.chunks} chunks)</span>
                <button
                  onClick={() => handleDeleteFile(f.filename)}
                  disabled={deletingFile === f.filename}
                  className="ml-0.5 text-violet-400 hover:text-red-500 disabled:opacity-50"
                >
                  {deletingFile === f.filename ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          value={chatbot.knowledge_base}
          onChange={e => onChange({ knowledge_base: e.target.value })}
          rows={4}
          placeholder="Paste additional context here (always included in every prompt)..."
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Text above is always appended to the prompt. Use uploaded files for large documents.
        </p>
      </div>}

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          Starter Questions
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {(chatbot.starter_questions ?? []).map((q, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full"
            >
              {q}
              <button
                onClick={() => removeQuestion(i)}
                className="text-violet-400 hover:text-violet-700 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } }}
            placeholder="Add a question..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
          />
          <button
            onClick={addQuestion}
            disabled={!newQ.trim()}
            className="px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Model ────────────────────────────────────────────────────────────────

function ModelTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const provider = chatbot.provider ?? "anthropic";
  const providerInfo = PROVIDER_COLORS[provider];
  const models = PROVIDER_MODELS[provider] ?? [];

  const handleProviderChange = (newProvider: Provider) => {
    const defaultModel = PROVIDER_MODELS[newProvider][0]?.value ?? "";
    onChange({ provider: newProvider, model: defaultModel });
  };

  return (
    <div className="space-y-5">
      {/* Provider */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Provider</label>
        <div className="relative">
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
            style={{ backgroundColor: providerInfo.bg }}
          />
          <select
            value={provider}
            onChange={e => handleProviderChange(e.target.value as Provider)}
            className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-8 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none bg-white"
          >
            {Object.entries(PROVIDER_COLORS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Model</label>
        <div className="relative">
          <select
            value={chatbot.model}
            onChange={e => onChange({ model: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none bg-white pr-8"
          >
            {models.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1.5">
          <Lock size={11} /> API Key
        </label>
        <input
          type="password"
          value={chatbot.api_key ?? ""}
          onChange={e => onChange({ api_key: e.target.value })}
          placeholder="Leave empty to use platform default"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-mono"
        />
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
          <Info size={10} />
          Fallback env var: <code className="font-mono">{providerInfo.envVar}</code>
        </p>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-600">Temperature</label>
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
            {(chatbot.temperature ?? 0.7).toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={chatbot.temperature ?? 0.7}
          onChange={e => onChange({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-violet-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-600">Max Response Length</label>
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
            {chatbot.max_tokens ?? 1024} tokens
          </span>
        </div>
        <input
          type="range"
          min={256}
          max={4096}
          step={256}
          value={chatbot.max_tokens ?? 1024}
          onChange={e => onChange({ max_tokens: parseInt(e.target.value) })}
          className="w-full accent-violet-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>256</span>
          <span>4096</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Tools ────────────────────────────────────────────────────────────────

function ToolsTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  useEffect(() => {
    fetch("/api/workflows?agent_callable=true")
      .then(r => r.json())
      .then(d => setWorkflows(Array.isArray(d) ? d : []))
      .catch(() => setWorkflows([]))
      .finally(() => setLoadingWorkflows(false));
  }, []);

  const connected = chatbot.connected_workflows ?? [];

  const getConnected = (wfId: string): ConnectedWorkflow | undefined =>
    connected.find(c => c.workflowId === wfId);

  const toggleWorkflow = (wf: WorkflowItem) => {
    const existing = getConnected(wf.id);
    if (existing) {
      // Toggle enabled
      onChange({
        connected_workflows: connected.map(c =>
          c.workflowId === wf.id ? { ...c, enabled: !c.enabled } : c
        ),
      });
    } else {
      // Add new
      onChange({
        connected_workflows: [
          ...connected,
          {
            workflowId: wf.id,
            name: wf.name,
            description: wf.description ?? "",
            whenToUse: wf.description ?? "",
            enabled: true,
          },
        ],
      });
    }
  };

  const updateWhenToUse = (wfId: string, whenToUse: string) => {
    onChange({
      connected_workflows: connected.map(c =>
        c.workflowId === wfId ? { ...c, whenToUse } : c
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Connect Workflows</h3>
        <p className="text-xs text-gray-400">
          Only workflows with an <span className="font-medium text-violet-600">Agent Invoke</span> trigger are shown here.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
        <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-600 leading-relaxed">
          When enabled, your agent will automatically invoke the workflow when relevant to the
          conversation.
        </p>
      </div>

      {loadingWorkflows ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-8 text-gray-400 px-2">
          <p className="text-xs font-medium text-gray-700">No agent-callable workflows found.</p>
          <p className="text-xs mt-1 leading-relaxed">
            To expose a workflow as a tool, add an{" "}
            <span className="font-semibold text-violet-600">Agent Invoke</span> trigger node as the
            first step of your workflow.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(wf => {
            const conn = getConnected(wf.id);
            const isEnabled = conn?.enabled ?? false;
            return (
              <div
                key={wf.id}
                className={`border rounded-xl p-3 transition-all ${isEnabled
                    ? "border-violet-300 bg-violet-50"
                    : "border-gray-200 bg-white"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => toggleWorkflow(wf)}
                    className="mt-0.5 accent-violet-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{wf.name}</p>
                    {wf.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {wf.description}
                      </p>
                    )}
                    {isEnabled && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-500 mb-1 block">
                          When to use this workflow:
                        </label>
                        <textarea
                          value={conn?.whenToUse ?? ""}
                          onChange={e => updateWhenToUse(wf.id, e.target.value)}
                          rows={2}
                          placeholder="Describe when the agent should invoke this workflow..."
                          className="w-full text-xs border border-violet-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-400 resize-none bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Branding ─────────────────────────────────────────────────────────────

function BrandingTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const appearance = chatbot.appearance ?? DEFAULT_APPEARANCE;

  const setAppearance = (updates: Partial<Appearance>) => {
    onChange({ appearance: { ...appearance, ...updates } });
  };

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Identity
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Agent Display Name
            </label>
            <input
              value={appearance.agentName}
              onChange={e => setAppearance({ agentName: e.target.value })}
              placeholder="Assistant"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Avatar</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {AVATAR_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setAppearance({ avatar: emoji })}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${appearance.avatar === emoji
                      ? "bg-violet-100 ring-2 ring-violet-400"
                      : "bg-gray-100 hover:bg-gray-200"
                    }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              value={appearance.avatar}
              onChange={e => setAppearance({ avatar: e.target.value })}
              placeholder="Or type any emoji..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Colors
        </h3>
        <div className="space-y-3">
          {[
            { key: "primaryColor" as const, label: "Primary Color" },
            { key: "headerBg" as const, label: "Header Background" },
            { key: "userBubbleBg" as const, label: "User Message Bubble" },
            { key: "botBubbleBg" as const, label: "Bot Message Bubble" },
            { key: "userBubbleText" as const, label: "User Bubble Text" },
            { key: "botBubbleText" as const, label: "Bot Bubble Text" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-xs text-gray-600">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={appearance[key] ?? "#000000"}
                  onChange={e => setAppearance({ [key]: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white"
                />
                <span className="text-xs font-mono text-gray-400 w-16">
                  {appearance[key]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Chat Window
        </h3>
        <div className="space-y-4">
          {/* Position */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Position</label>
            <div className="grid grid-cols-3 gap-2">
              {(["bottom-right", "bottom-left", "inline"] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setAppearance({ position: pos })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${appearance.position === pos
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                >
                  {pos === "bottom-right" ? "↘ Right" : pos === "bottom-left" ? "↙ Left" : "Inline"}
                </button>
              ))}
            </div>
          </div>

          {/* Window Width */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-600">Window Width</label>
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                {appearance.windowWidth ?? 400}px
              </span>
            </div>
            <input
              type="range"
              min={300}
              max={600}
              step={10}
              value={appearance.windowWidth ?? 400}
              onChange={e => setAppearance({ windowWidth: parseInt(e.target.value) })}
              className="w-full accent-violet-600"
            />
          </div>

          {/* Border Radius */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-600">Border Radius</label>
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                {appearance.borderRadius ?? 16}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={2}
              value={appearance.borderRadius ?? 16}
              onChange={e => setAppearance({ borderRadius: parseInt(e.target.value) })}
              className="w-full accent-violet-600"
            />
          </div>

          {/* Show Branding */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Show &quot;Powered by FlowMake&quot;</label>
            <button
              onClick={() => setAppearance({ showBranding: !appearance.showBranding })}
              className={`w-10 h-5 rounded-full transition-all relative ${appearance.showBranding ? "bg-violet-600" : "bg-gray-200"
                }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${appearance.showBranding ? "left-5" : "left-0.5"
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Messages
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Greeting Message
            </label>
            <input
              value={appearance.greetingMessage}
              onChange={e => setAppearance({ greetingMessage: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Input Placeholder
            </label>
            <input
              value={appearance.placeholder}
              onChange={e => setAppearance({ placeholder: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Send Button Label
            </label>
            <input
              value={appearance.sendButtonLabel}
              onChange={e => setAppearance({ sendButtonLabel: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>
        </div>
      </div>

      {/* Launcher Button */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Launcher Button
        </h3>
        <div className="space-y-4">
          {/* Launcher Color */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Button Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={appearance.launcherColor ?? appearance.primaryColor ?? "#7c3aed"}
                onChange={e => setAppearance({ launcherColor: e.target.value })}
                className="w-7 h-7 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white"
              />
              <span className="text-xs font-mono text-gray-400 w-16">
                {appearance.launcherColor ?? appearance.primaryColor}
              </span>
            </div>
          </div>

          {/* Launcher Size */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Button Size</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "sm", label: "Small", px: "44px" },
                { value: "md", label: "Medium", px: "56px" },
                { value: "lg", label: "Large", px: "68px" },
              ] as const).map(({ value, label, px }) => (
                <button
                  key={value}
                  onClick={() => setAppearance({ launcherSize: value })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                    (appearance.launcherSize ?? "md") === value
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {label}
                  <span className="block text-xs opacity-60">{px}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Launcher Label */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Button Label <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={appearance.launcherLabel ?? ""}
              onChange={e => setAppearance({ launcherLabel: e.target.value })}
              placeholder="e.g. Chat with us"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              When set, shows a pill with your label next to the bubble.
            </p>
          </div>
        </div>
      </div>

      {/* Launcher bubble preview */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">Launcher Button Preview</label>
        <p className="text-xs text-gray-400 mb-3">How the chat bubble looks when collapsed on your website.</p>
        <div className="relative bg-gray-100 rounded-xl h-28 overflow-hidden">
          {/* Fake website content */}
          <div className="absolute inset-0 p-3 space-y-1.5">
            <div className="h-2 w-2/3 bg-gray-300 rounded" />
            <div className="h-2 w-1/2 bg-gray-200 rounded" />
            <div className="h-2 w-3/4 bg-gray-200 rounded" />
          </div>
          {/* Launcher bubble — matches exactly what the script renders */}
          {(() => {
            const lColor = appearance.launcherColor || appearance.primaryColor || "#7c3aed";
            const lSize = appearance.launcherSize === "sm" ? 34 : appearance.launcherSize === "lg" ? 50 : 42;
            const lLabel = appearance.launcherLabel?.trim();
            return (
              <div
                className="absolute bottom-3 flex items-center gap-1.5 cursor-pointer select-none"
                style={{
                  right: appearance.position === "bottom-left" ? "auto" : "12px",
                  left: appearance.position === "bottom-left" ? "12px" : "auto",
                }}
              >
                {lLabel && appearance.position !== "bottom-left" && (
                  <div
                    className="flex items-center px-2.5 py-1 rounded-full text-white text-xs font-semibold shadow-md"
                    style={{ backgroundColor: lColor }}
                  >
                    {lLabel}
                  </div>
                )}
                <div
                  className="flex items-center justify-center rounded-full shadow-lg"
                  style={{
                    backgroundColor: lColor,
                    width: lSize,
                    height: lSize,
                    fontSize: lSize * 0.46,
                    lineHeight: 1,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
                  }}
                >
                  {appearance.avatar || "🤖"}
                </div>
                {lLabel && appearance.position === "bottom-left" && (
                  <div
                    className="flex items-center px-2.5 py-1 rounded-full text-white text-xs font-semibold shadow-md"
                    style={{ backgroundColor: lColor }}
                  >
                    {lLabel}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Embed ────────────────────────────────────────────────────────────────

function EmbedTab({ chatbot }: { chatbot: Chatbot }) {
  const [tab, setTab] = useState<"iframe" | "script">("iframe");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [domains, setDomains] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `${origin}/embed/${chatbot.id}`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${chatbot.appearance?.windowWidth ?? 400}"
  height="600"
  frameborder="0"
  allow="clipboard-write"
  style="border-radius: ${chatbot.appearance?.borderRadius ?? 16}px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
></iframe>`;

  const side = chatbot.appearance?.position === "bottom-left" ? "left" : "right";
  const primaryColor = chatbot.appearance?.primaryColor ?? "#7c3aed";
  const launcherColor = chatbot.appearance?.launcherColor || primaryColor;
  const avatar = chatbot.appearance?.avatar ?? "🤖";
  const windowWidth = chatbot.appearance?.windowWidth ?? 400;
  const borderRadius = chatbot.appearance?.borderRadius ?? 16;
  const launcherSizePx = chatbot.appearance?.launcherSize === "sm" ? 44 : chatbot.appearance?.launcherSize === "lg" ? 68 : 56;
  const launcherLabel = chatbot.appearance?.launcherLabel?.trim() ?? "";

  const scriptCode = `<script>
(function(){
  var src='${embedUrl}';
  var color='${launcherColor}';
  var side='${side}';
  var br='${borderRadius}';
  var w='${windowWidth}';
  var avatar='${avatar}';
  var btnSize=${launcherSizePx};
  var label='${launcherLabel.replace(/'/g, "\\'")}';

  var wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;'+side+':24px;bottom:24px;z-index:2147483647;display:flex;flex-direction:row;align-items:center;gap:8px;pointer-events:none;'+(side==='right'?'flex-direction:row-reverse;':'');

  var fr=document.createElement('iframe');
  fr.src=src;
  fr.allow='clipboard-write';
  fr.setAttribute('frameborder','0');
  fr.style.cssText='position:fixed;'+side+':24px;bottom:'+(btnSize+36)+'px;width:'+w+'px;height:600px;border:none;border-radius:'+br+'px;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:none;pointer-events:auto;transition:opacity 0.2s,transform 0.2s;opacity:0;transform:translateY(12px) scale(0.97);z-index:2147483646;';

  var iconSize=Math.round(btnSize*0.43);
  var closeSvg='<svg xmlns="http://www.w3.org/2000/svg" width="'+iconSize+'" height="'+iconSize+'" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
  var avatarHtml='<span style="font-size:'+Math.round(btnSize*0.4)+'px;line-height:1;">'+avatar+'</span>';

  var btn=document.createElement('button');
  btn.setAttribute('aria-label','Open chat');
  btn.innerHTML=avatarHtml;
  btn.style.cssText='width:'+btnSize+'px;height:'+btnSize+'px;border-radius:50%;background:'+color+';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.25);transition:transform 0.2s,box-shadow 0.2s;flex-shrink:0;pointer-events:auto;';
  btn.onmouseenter=function(){btn.style.transform='scale(1.08)';btn.style.boxShadow='0 6px 24px rgba(0,0,0,0.3)';};
  btn.onmouseleave=function(){btn.style.transform='scale(1)';btn.style.boxShadow='0 4px 20px rgba(0,0,0,0.25)';};

  var labelEl=null;
  if(label){
    labelEl=document.createElement('div');
    labelEl.textContent=label;
    labelEl.style.cssText='background:'+color+';color:#fff;padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.18);pointer-events:auto;cursor:pointer;font-family:inherit;';
    labelEl.addEventListener('click',function(){isOpen?close():open();});
  }

  var isOpen=false;
  function open(){
    isOpen=true;
    fr.style.display='block';
    setTimeout(function(){fr.style.opacity='1';fr.style.transform='translateY(0) scale(1)';},10);
    btn.innerHTML=closeSvg;
    if(labelEl)labelEl.style.display='none';
    btn.setAttribute('aria-label','Close chat');
  }
  function close(){
    isOpen=false;
    fr.style.opacity='0';
    fr.style.transform='translateY(12px) scale(0.97)';
    setTimeout(function(){if(!isOpen)fr.style.display='none';},200);
    btn.innerHTML=avatarHtml;
    if(labelEl)labelEl.style.display='';
    btn.setAttribute('aria-label','Open chat');
  }
  btn.addEventListener('click',function(){isOpen?close():open();});
  window.addEventListener('message',function(e){if(e.data==='fm-minimize'&&isOpen)close();});

  if(labelEl&&side==='left')wrap.appendChild(btn);
  wrap.appendChild(labelEl||document.createTextNode(''));
  if(labelEl&&side!=='left')wrap.appendChild(btn);
  if(!labelEl)wrap.appendChild(btn);
  document.body.appendChild(fr);
  document.body.appendChild(wrap);
})();
</script>`;

  const code = tab === "iframe" ? iframeCode : scriptCode;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(embedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* URL */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Embed URL</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={embedUrl}
            className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 font-mono text-gray-500"
          />
          <button
            onClick={copyUrl}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-xl transition-all"
          >
            {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
            {copiedUrl ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Embed code tabs */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">Embed Code</label>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
          {(["iframe", "script"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              {t === "iframe" ? "iFrame" : "Script Tag"}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {code}
          </pre>
          <button
            onClick={copyCode}
            className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all"
          >
            {copiedCode ? <Check size={11} /> : <Copy size={11} />}
            {copiedCode ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Allowed Domains */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Allowed Domains</label>
        <p className="text-xs text-gray-400 mb-1.5">
          Comma-separated list of allowed domains (for security).
        </p>
        <input
          value={domains}
          onChange={e => setDomains(e.target.value)}
          placeholder="example.com, mysite.io, ..."
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
        />
      </div>

      {/* Test link */}
      <a
        href={embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-violet-50 text-violet-700 text-xs font-semibold rounded-xl hover:bg-violet-100 transition-all border border-violet-200"
      >
        <ExternalLink size={12} />
        Test your agent
      </a>
    </div>
  );
}

// ─── Tab: Behavior ────────────────────────────────────────────────────────────

function BehaviorTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const [newGuardrail, setNewGuardrail] = useState("");
  const behavior: BehaviorConfig = chatbot.behavior ?? {
    temperature_locked: false,
    response_format: "auto",
    language: "",
    guardrails: [],
    max_response_words: 0,
  };

  const set = (updates: Partial<BehaviorConfig>) =>
    onChange({ behavior: { ...behavior, ...updates } });

  const addGuardrail = () => {
    const g = newGuardrail.trim();
    if (!g) return;
    set({ guardrails: [...(behavior.guardrails ?? []), g] });
    setNewGuardrail("");
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
        <Shield size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Behavior controls add deterministic rules on top of your model settings. They are injected into the system prompt automatically.
        </p>
      </div>

      {/* Temperature lock */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-800">Lock temperature to 0</p>
          <p className="text-xs text-gray-400 mt-0.5">Forces fully deterministic responses. Overrides the model temperature setting.</p>
        </div>
        <button
          onClick={() => set({ temperature_locked: !behavior.temperature_locked })}
          className={`flex-shrink-0 mt-0.5 transition-colors ${behavior.temperature_locked ? "text-violet-600" : "text-gray-300"}`}
        >
          {behavior.temperature_locked
            ? <ToggleRight size={22} />
            : <ToggleLeft size={22} />}
        </button>
      </div>

      {/* Response format */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          <Sliders size={11} className="inline mr-1" />Response Format
        </label>
        <select
          value={behavior.response_format ?? "auto"}
          onChange={e => set({ response_format: e.target.value as BehaviorConfig["response_format"] })}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 bg-white"
        >
          <option value="auto">Auto (let the model decide)</option>
          <option value="markdown">Always Markdown</option>
          <option value="plain">Always Plain Text</option>
          <option value="json">Always JSON</option>
        </select>
        {behavior.response_format === "json" && (
          <p className="text-xs text-amber-600 mt-1">The agent will be instructed to respond with valid JSON only.</p>
        )}
      </div>

      {/* Language */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          <Globe size={11} className="inline mr-1" />Force Response Language
        </label>
        <input
          value={behavior.language ?? ""}
          onChange={e => set({ language: e.target.value })}
          placeholder="e.g. English, Spanish, French (leave blank for auto)"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
        />
      </div>

      {/* Max words */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Max Response Words</label>
        <input
          type="number"
          min={0}
          value={behavior.max_response_words ?? 0}
          onChange={e => set({ max_response_words: parseInt(e.target.value) || 0 })}
          placeholder="0 = no limit"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
        />
        <p className="text-xs text-gray-400 mt-1">Set to 0 for no limit.</p>
      </div>

      {/* Guardrails */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">
          <AlertTriangle size={11} className="inline mr-1" />Guardrails
        </label>
        <p className="text-xs text-gray-400 mb-2">Rules the agent must always follow (e.g. "Never discuss competitors", "Always recommend contacting support").</p>
        <div className="space-y-1.5 mb-2">
          {(behavior.guardrails ?? []).map((g, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-red-700 flex-1">{g}</span>
              <button
                onClick={() => set({ guardrails: behavior.guardrails.filter((_, j) => j !== i) })}
                className="text-red-300 hover:text-red-600 flex-shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newGuardrail}
            onChange={e => setNewGuardrail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGuardrail(); } }}
            placeholder="Add a guardrail rule..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
          />
          <button
            onClick={addGuardrail}
            disabled={!newGuardrail.trim()}
            className="px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 disabled:opacity-40"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: MCP Tools ───────────────────────────────────────────────────────────

function MCPTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const tools: MCPTool[] = chatbot.mcp_tools ?? [];
  const [form, setForm] = useState({ name: "", server_url: "", description: "" });
  const [adding, setAdding] = useState(false);

  const addTool = () => {
    if (!form.name.trim() || !form.server_url.trim()) return;
    const newTool: MCPTool = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      server_url: form.server_url.trim(),
      description: form.description.trim(),
      enabled: true,
    };
    onChange({ mcp_tools: [...tools, newTool] });
    setForm({ name: "", server_url: "", description: "" });
    setAdding(false);
  };

  const toggleTool = (id: string) =>
    onChange({ mcp_tools: tools.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t) });

  const removeTool = (id: string) =>
    onChange({ mcp_tools: tools.filter(t => t.id !== id) });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-gray-900 mb-0.5">External MCP Tools</h3>
        <p className="text-xs text-gray-400">
          Connect MCP (Model Context Protocol) servers to extend your agent with external tools like search, code execution, or custom APIs.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
        <Server size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          The agent will call MCP tools as needed during conversations. Each tool call is executed server-side.
        </p>
      </div>

      {tools.length === 0 && !adding ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <Server size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-gray-500">No MCP tools configured</p>
          <p className="text-xs text-gray-400 mt-1">Add an MCP server to extend your agent&apos;s capabilities.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map(tool => (
            <div key={tool.id} className={`border rounded-xl p-3 transition-all ${tool.enabled ? "border-violet-200 bg-violet-50" : "border-gray-200 bg-white"}`}>
              <div className="flex items-start gap-2">
                <button onClick={() => toggleTool(tool.id)} className={`flex-shrink-0 mt-0.5 transition-colors ${tool.enabled ? "text-violet-600" : "text-gray-300"}`}>
                  {tool.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{tool.name}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{tool.server_url}</p>
                  {tool.description && <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>}
                </div>
                <button onClick={() => removeTool(tool.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="border border-violet-200 rounded-xl p-3 space-y-2 bg-violet-50/50">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Tool name (e.g. web_search)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 bg-white"
          />
          <input
            value={form.server_url}
            onChange={e => setForm(f => ({ ...f, server_url: e.target.value }))}
            placeholder="MCP server URL (e.g. https://mcp.example.com)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 bg-white font-mono text-xs"
          />
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 bg-white"
          />
          <div className="flex gap-2">
            <button onClick={addTool} disabled={!form.name.trim() || !form.server_url.trim()}
              className="flex-1 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40">
              Add Tool
            </button>
            <button onClick={() => { setAdding(false); setForm({ name: "", server_url: "", description: "" }); }}
              className="px-3 py-2 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">
          <Plus size={13} /> Add MCP Tool
        </button>
      )}
    </div>
  );
}

// ─── Main Editor Page ─────────────────────────────────────────────────────────

type TabId = "overview" | "model" | "tools" | "behavior" | "mcp" | "branding" | "embed" | "history" | "intents";

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ agentId }: { agentId: string }) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/conversations`)
      .then(r => r.json())
      .then(d => setConversations(Array.isArray(d) ? d : []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <MessageSquare size={28} className="text-gray-300 mb-3" />
        <p className="text-xs font-semibold text-gray-600">No conversations yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Conversations from the preview and embed will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
        {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
      </p>
      {conversations.map(conv => {
        const isOpen = expanded === conv.id;
        const firstUserMsg = conv.messages.find(m => m.role === "user");
        const date = new Date(conv.started_at);
        const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const userCount = conv.messages.filter(m => m.role === "user").length;

        return (
          <div key={conv.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : conv.id)}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors"
            >
              <MessageSquare size={13} className="text-violet-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {firstUserMsg?.content ?? "No messages"}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{dateStr} · {timeStr}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {userCount} msg{userCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded-full capitalize">
                    {conv.source}
                  </span>
                </div>
              </div>
              <ChevronDown
                size={12}
                className={`text-gray-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-3">
                {/* Session metadata */}
                {conv.metadata && Object.keys(conv.metadata).length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-lg p-2 space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Session Details</p>
                    {conv.metadata.screen && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Monitor size={9} className="text-gray-400" />
                        <span>Screen: {conv.metadata.screen}</span>
                      </div>
                    )}
                    {conv.metadata.timezone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Globe size={9} className="text-gray-400" />
                        <span>Timezone: {conv.metadata.timezone}</span>
                      </div>
                    )}
                    {conv.metadata.language && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Globe size={9} className="text-gray-400" />
                        <span>Language: {conv.metadata.language}</span>
                      </div>
                    )}
                    {conv.metadata.referrer && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <ExternalLink size={9} className="text-gray-400" />
                        <span className="truncate">From: {conv.metadata.referrer}</span>
                      </div>
                    )}
                    {conv.metadata.user_agent && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-500">
                        <Monitor size={9} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{conv.metadata.user_agent}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Messages */}
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {conv.messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot size={10} className="text-violet-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${msg.role === "user"
                            ? "bg-violet-600 text-white rounded-br-sm"
                            : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"
                          }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User size={10} className="text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Simple Bot Intents ───────────────────────────────────────────────────

function SimpleBotIntentsTab({
  chatbot,
  onChange,
}: {
  chatbot: Chatbot;
  onChange: (updates: Partial<Chatbot>) => void;
}) {
  const intents: Intent[] = chatbot.intents ?? [];
  const [newName, setNewName] = useState("");
  const [newTriggers, setNewTriggers] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Intent | null>(null);

  const addIntent = () => {
    if (!newName.trim() || !newTriggers.trim() || !newResponse.trim()) return;
    const intent: Intent = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      triggers: newTriggers.trim(),
      response: newResponse.trim(),
    };
    onChange({ intents: [...intents, intent] });
    setNewName(""); setNewTriggers(""); setNewResponse(""); setAdding(false);
  };

  const removeIntent = (id: string) => {
    onChange({ intents: intents.filter(i => i.id !== id) });
  };

  const startEdit = (intent: Intent) => {
    setEditingId(intent.id);
    setEditForm({ ...intent });
  };

  const saveEdit = () => {
    if (!editForm) return;
    onChange({ intents: intents.map(i => i.id === editForm.id ? editForm : i) });
    setEditingId(null); setEditForm(null);
  };

  const appearance = chatbot.appearance ?? DEFAULT_APPEARANCE;
  const setAppearance = (updates: Partial<Appearance>) => {
    onChange({ appearance: { ...appearance, ...updates } });
  };

  return (
    <div className="space-y-5">
      {/* Greeting & Fallback */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-3">
        <h3 className="text-xs font-semibold text-emerald-800">Bot Messages</h3>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Greeting Message</label>
          <textarea
            value={appearance.greetingMessage ?? ""}
            onChange={e => setAppearance({ greetingMessage: e.target.value })}
            rows={2}
            placeholder="Hi! How can I help you?"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 resize-none bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Fallback Message</label>
          <input
            value={(appearance as Appearance & { fallbackMessage?: string }).fallbackMessage ?? ""}
            onChange={e => setAppearance({ ...(appearance as object), fallbackMessage: e.target.value } as Partial<Appearance>)}
            placeholder="Sorry, I didn't understand that."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white"
          />
          <p className="text-xs text-gray-400 mt-1">Shown when no intent matches the user input.</p>
        </div>
      </div>

      {/* Intents list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-900">Intents</h3>
            <p className="text-xs text-gray-400">Keyword-matched responses — no AI needed.</p>
          </div>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              <Plus size={12} /> Add Intent
            </button>
          )}
        </div>

        {intents.length === 0 && !adding && (
          <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
            <MessageSquare size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No intents yet. Add one to get started.</p>
          </div>
        )}

        <div className="space-y-2">
          {intents.map(intent => (
            <div key={intent.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {editingId === intent.id && editForm ? (
                <div className="p-3 space-y-2 bg-emerald-50/50">
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)}
                    placeholder="Intent name"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 bg-white"
                  />
                  <input
                    value={editForm.triggers}
                    onChange={e => setEditForm(f => f ? { ...f, triggers: e.target.value } : f)}
                    placeholder="Trigger keywords (comma-separated)"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 bg-white font-mono text-xs"
                  />
                  <textarea
                    value={editForm.response}
                    onChange={e => setEditForm(f => f ? { ...f, response: e.target.value } : f)}
                    rows={2}
                    placeholder="Bot response"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">Save</button>
                    <button onClick={() => { setEditingId(null); setEditForm(null); }} className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{intent.name}</p>
                      <p className="text-xs text-emerald-600 font-mono mt-0.5 truncate">{intent.triggers}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{intent.response}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(intent)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                        <FileText size={11} />
                      </button>
                      <button onClick={() => removeIntent(intent.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {adding && (
          <div className="border border-emerald-200 rounded-xl p-3 space-y-2 bg-emerald-50/50 mt-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Intent name (e.g. Greeting)"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 bg-white"
            />
            <input
              value={newTriggers}
              onChange={e => setNewTriggers(e.target.value)}
              placeholder="Trigger keywords (e.g. hello, hi, hey)"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 bg-white font-mono text-xs"
            />
            <textarea
              value={newResponse}
              onChange={e => setNewResponse(e.target.value)}
              rows={2}
              placeholder="Bot response..."
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 resize-none bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={addIntent}
                disabled={!newName.trim() || !newTriggers.trim() || !newResponse.trim()}
                className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                Add Intent
              </button>
              <button
                onClick={() => { setAdding(false); setNewName(""); setNewTriggers(""); setNewResponse(""); }}
                className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FULL_AGENT_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <FileText size={13} /> },
  { id: "model", label: "Model", icon: <Cpu size={13} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={13} /> },
  { id: "behavior", label: "Behavior", icon: <Shield size={13} /> },
  { id: "mcp", label: "MCP", icon: <Server size={13} /> },
  { id: "branding", label: "Branding", icon: <Palette size={13} /> },
  { id: "embed", label: "Embed", icon: <Code2 size={13} /> },
  { id: "history", label: "History", icon: <History size={13} /> },
];

const SIMPLE_BOT_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <FileText size={13} /> },
  { id: "intents", label: "Intents", icon: <Zap size={13} /> },
  { id: "branding", label: "Branding", icon: <Palette size={13} /> },
  { id: "embed", label: "Embed", icon: <Code2 size={13} /> },
  { id: "history", label: "History", icon: <History size={13} /> },
];

export default function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [agentId, setAgentId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Partial<Chatbot>>({});

  // Resolve params
  useEffect(() => {
    params.then(p => setAgentId(p.id));
  }, [params]);

  // Load chatbot
  useEffect(() => {
    if (!agentId) return;

    // Handle "new" agent creation
    if (agentId === "new") {
      setLoading(true);
      fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Agent",
          description: "",
          system_prompt: "You are a helpful assistant.",
          model: "claude-haiku-4-5-20251001",
          provider: "anthropic",
          appearance: {
            agentName: "Assistant",
            avatar: "🤖",
            primaryColor: "#7c3aed",
            headerBg: "#7c3aed",
            userBubbleBg: "#7c3aed",
            botBubbleBg: "#ffffff",
            userBubbleText: "#ffffff",
            botBubbleText: "#1f2937",
            greetingMessage: "Hi! How can I help you today?",
            placeholder: "Type a message...",
            sendButtonLabel: "Send",
            showBranding: true,
            position: "bottom-right",
            windowWidth: 400,
            borderRadius: 16,
          },
        }),
      })
        .then(r => r.json())
        .then(created => {
          if (created.id) {
            router.replace(`/agents/${created.id}`);
          }
        })
        .catch(() => router.push("/agents"))
        .finally(() => setLoading(false));
      return;
    }

    setLoading(true);
    fetch(`/api/agents/${agentId}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(data => {
        // Ensure appearance has all fields with defaults
        const appearance: Appearance = {
          agentName: "Assistant",
          avatar: "🤖",
          primaryColor: "#7c3aed",
          headerBg: "#7c3aed",
          userBubbleBg: "#7c3aed",
          botBubbleBg: "#ffffff",
          userBubbleText: "#ffffff",
          botBubbleText: "#1f2937",
          greetingMessage: "Hi! How can I help you today?",
          placeholder: "Type a message...",
          sendButtonLabel: "Send",
          showBranding: true,
          position: "bottom-right",
          windowWidth: 400,
          borderRadius: 16,
          ...(data.appearance ?? {}),
        };
        setChatbot({
          ...data,
          provider: data.provider ?? "anthropic",
          api_key: data.api_key ?? "",
          temperature: data.temperature ?? 0.7,
          max_tokens: data.max_tokens ?? 1024,
          knowledge_base: data.knowledge_base ?? "",
          connected_workflows: data.connected_workflows ?? [],
          agent_type: data.agent_type ?? "full",
          intents: data.intents ?? [],
          appearance,
        });
      })
      .catch(() => router.push("/agents"))
      .finally(() => setLoading(false));
  }, [agentId, router]);

  // Debounced auto-save
  const scheduleSave = useCallback(
    (updates: Partial<Chatbot>) => {
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");

      saveTimerRef.current = setTimeout(async () => {
        if (!agentId) return;
        try {
          const res = await fetch(`/api/agents/${agentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingUpdatesRef.current),
          });
          if (!res.ok) throw new Error("Save failed");
          pendingUpdatesRef.current = {};
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("error");
        }
      }, 1500);
    },
    [agentId]
  );

  const handleChange = useCallback(
    (updates: Partial<Chatbot>) => {
      setChatbot(prev => {
        if (!prev) return prev;
        const updated = { ...prev, ...updates };
        scheduleSave(updates);
        return updated;
      });
    },
    [scheduleSave]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={20} className="animate-spin text-violet-500" />
          <p className="text-xs text-gray-400">Loading agent...</p>
        </div>
      </div>
    );
  }

  if (!chatbot) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => router.push("/agents")}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft size={14} />
          Agents
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-semibold text-gray-900 truncate">{chatbot.name}</span>
          {chatbot.agent_type === "simple" ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 bg-emerald-100 text-emerald-700">
              <MessageSquare size={9} />
              Simple Bot
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 bg-violet-100 text-violet-700">
              <BrainCircuit size={9} />
              Full Agent
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${chatbot.is_active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${chatbot.is_active ? "bg-green-500" : "bg-gray-400"
                }`}
            />
            {chatbot.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Save indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {saveStatus === "saving" && (
            <>
              <Loader2 size={12} className="animate-spin text-gray-400" />
              <span className="text-gray-400">Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check size={12} className="text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <span className="text-red-500">Save failed</span>
          )}
        </div>

        <a
          href={`/embed/${chatbot.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 text-xs font-semibold rounded-lg hover:bg-violet-100 transition-all border border-violet-200"
        >
          <ExternalLink size={12} />
          Preview
        </a>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          {/* Tabs */}
          {(() => {
            const isSimple = chatbot.agent_type === "simple";
            const tabs = isSimple ? SIMPLE_BOT_TABS : FULL_AGENT_TABS;
            const activeColor = isSimple ? "border-emerald-500 text-emerald-600" : "border-violet-500 text-violet-600";
            return (
              <>
                <div className="flex border-b border-gray-200 flex-shrink-0">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all border-b-2 ${activeTab === tab.id
                          ? activeColor
                          : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === "overview" && (
                    <OverviewTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "intents" && isSimple && (
                    <SimpleBotIntentsTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "model" && !isSimple && (
                    <ModelTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "tools" && !isSimple && (
                    <ToolsTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "behavior" && !isSimple && (
                    <BehaviorTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "mcp" && !isSimple && (
                    <MCPTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "branding" && (
                    <BrandingTab chatbot={chatbot} onChange={handleChange} />
                  )}
                  {activeTab === "embed" && (
                    <EmbedTab chatbot={chatbot} />
                  )}
                  {activeTab === "history" && agentId && (
                    <HistoryTab agentId={agentId} />
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Right panel: live chat preview */}
        <ChatPreview chatbot={chatbot} />
      </div>
    </div>
  );
}

