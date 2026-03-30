"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plus, Trash2, Loader2, X, Check, Copy, Bot,
  AlertCircle, Sparkles, Code2, Settings, Zap,
} from "lucide-react";

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
  is_active: boolean;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<Provider, { bg: string; text: string; icon: string }> = {
  anthropic: { bg: "#7c3aed", text: "Anthropic", icon: "◆" },
  openai: { bg: "#10a37f", text: "OpenAI", icon: "⬡" },
  gemini: { bg: "#4285f4", text: "Gemini", icon: "✦" },
  groq: { bg: "#f97316", text: "Groq", icon: "▲" },
  mistral: { bg: "#0ea5e9", text: "Mistral", icon: "❋" },
};

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
};

const EXAMPLE_PROMPTS = [
  "Customer support for a SaaS product",
  "FAQ bot for an e-commerce store",
  "Sales assistant that books demos",
  "IT helpdesk assistant",
];

type TemplateConfig = Omit<Chatbot, "id" | "is_active" | "created_at" | "api_key" | "connected_workflows">;

const TEMPLATES: (TemplateConfig & { emoji: string; category: string })[] = [
  {
    emoji: "🎧",
    name: "Customer Support Agent",
    description: "Handle questions, returns, complaints & escalations 24/7",
    category: "Support",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    system_prompt:
      "You are a friendly, professional customer support agent. Help customers with their questions, complaints, and issues. Be empathetic, clear, and solution-focused. If you cannot resolve an issue, offer to escalate to a human agent.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "How do I track my order?",
      "I need help with a refund",
      "How do I reset my password?",
      "Can I change my subscription?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#0ea5e9",
      headerBg: "#0ea5e9",
      userBubbleBg: "#0ea5e9",
      agentName: "Support",
      avatar: "🎧",
      greetingMessage:
        "Hi! I'm here to help with any questions or issues. What can I assist you with today?",
    },
  },
  {
    emoji: "💼",
    name: "Sales Assistant",
    description: "Qualify leads, answer product questions, book demos",
    category: "Sales",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are an enthusiastic sales assistant. Help prospects understand the product's value, answer questions about pricing and features, qualify leads, and encourage booking a demo. Be persuasive but not pushy.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "What does your product do?",
      "How much does it cost?",
      "Can I get a demo?",
      "How does it compare to competitors?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#10b981",
      headerBg: "#10b981",
      userBubbleBg: "#10b981",
      agentName: "Sales",
      avatar: "💼",
      greetingMessage: "Hi! Interested in learning more about us? I'd love to help!",
    },
  },
  {
    emoji: "❓",
    name: "FAQ Bot",
    description: "Answer common questions instantly from your knowledge base",
    category: "Support",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    system_prompt:
      "You are a helpful FAQ assistant. Answer questions concisely and accurately. If a question isn't covered in the knowledge base, politely let the user know and suggest they contact support.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "What are your hours?",
      "Where are you located?",
      "How do I get started?",
      "What payment methods do you accept?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#8b5cf6",
      headerBg: "#8b5cf6",
      userBubbleBg: "#8b5cf6",
      agentName: "FAQ Bot",
      avatar: "❓",
      greetingMessage: "Hello! Ask me anything — I'll do my best to help!",
    },
  },
  {
    emoji: "👥",
    name: "HR Onboarding Assistant",
    description: "Guide new employees through onboarding, answer HR questions",
    category: "HR",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are a friendly HR onboarding assistant. Help new employees navigate their first weeks: answer questions about policies, benefits, tools, and processes. Be welcoming and informative.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "How do I set up my benefits?",
      "What's the vacation policy?",
      "How do I request time off?",
      "Who do I contact for IT help?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#f59e0b",
      headerBg: "#f59e0b",
      userBubbleBg: "#f59e0b",
      agentName: "HR Assistant",
      avatar: "👥",
      greetingMessage:
        "Welcome aboard! I'm here to help you settle in. What questions do you have?",
    },
  },
  {
    emoji: "💻",
    name: "Code Assistant",
    description: "Help developers with code reviews, debugging, and questions",
    category: "Dev",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are an expert software engineering assistant. Help with code reviews, debugging, architecture questions, and best practices. Provide clear code examples when helpful. Support multiple programming languages.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "Can you review this code?",
      "How do I fix this bug?",
      "What's the best approach for...?",
      "Explain this error message",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#6366f1",
      headerBg: "#6366f1",
      userBubbleBg: "#6366f1",
      agentName: "Code Bot",
      avatar: "💻",
      greetingMessage: "Hey! Ready to help with code, debugging, or technical questions.",
    },
  },
  {
    emoji: "🛒",
    name: "Shopping Assistant",
    description: "Help customers find products, compare options, and complete purchases",
    category: "E-commerce",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    system_prompt:
      "You are a helpful shopping assistant. Help customers find the right products, compare options, understand sizing and specifications, and complete their purchase. Be helpful and knowledgeable about the product catalog.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "Help me find a product",
      "What's the difference between...?",
      "Do you have this in my size?",
      "What's your return policy?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#f97316",
      headerBg: "#f97316",
      userBubbleBg: "#f97316",
      agentName: "Shop Assistant",
      avatar: "🛒",
      greetingMessage:
        "Hi! Looking for something specific? I'm here to help you find the perfect match!",
    },
  },
  {
    emoji: "📅",
    name: "Appointment Booking Bot",
    description: "Schedule appointments, manage bookings, send reminders",
    category: "Scheduling",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    system_prompt:
      "You are an appointment scheduling assistant. Help users book, reschedule, or cancel appointments. Collect necessary information (name, preferred date/time, service type) and confirm bookings. Be efficient and friendly.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "I'd like to book an appointment",
      "Can I reschedule?",
      "What times are available?",
      "How do I cancel?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#ec4899",
      headerBg: "#ec4899",
      userBubbleBg: "#ec4899",
      agentName: "Booking Bot",
      avatar: "📅",
      greetingMessage:
        "Hi! I can help you schedule, reschedule, or manage appointments. What do you need?",
    },
  },
  {
    emoji: "📊",
    name: "Data Analyst",
    description: "Answer questions about your data, generate insights and reports",
    category: "Analytics",
    provider: "anthropic",
    model: "claude-opus-4-6",
    system_prompt:
      "You are an expert data analyst assistant. Help users understand their data, identify trends, generate reports, and draw insights. Be precise with numbers, explain your reasoning, and suggest actionable next steps.",
    knowledge_base: "",
    temperature: 0.7,
    max_tokens: 1024,
    starter_questions: [
      "Analyze this data for me",
      "What trends do you see?",
      "Generate a summary report",
      "What are the key insights?",
    ],
    appearance: {
      ...DEFAULT_APPEARANCE,
      primaryColor: "#14b8a6",
      headerBg: "#14b8a6",
      userBubbleBg: "#14b8a6",
      agentName: "Data Analyst",
      avatar: "📊",
      greetingMessage:
        "Hello! I can help you make sense of your data. What would you like to analyze?",
    },
  },
];

// ─── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  loading,
}: {
  template: (typeof TEMPLATES)[number];
  onUse: () => void;
  loading: boolean;
}) {
  const color = template.appearance.primaryColor;
  return (
    <div
      className="flex-shrink-0 w-60 bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: color + "1a" }}
        >
          {template.emoji}
        </div>
        <div className="min-w-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: color + "1a", color }}
          >
            {template.category}
          </span>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1">
          {template.name}
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {template.description}
        </p>
      </div>
      <button
        onClick={onUse}
        disabled={loading}
        className="mt-auto w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: color }}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
        Use Template
      </button>
    </div>
  );
}

// ─── Embed Modal ──────────────────────────────────────────────────────────────

function EmbedModal({ agent, onClose }: { agent: Chatbot; onClose: () => void }) {
  const [tab, setTab] = useState<"iframe" | "script">("iframe");
  const [copied, setCopied] = useState(false);

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const iframeCode = `<iframe
  src="${origin}/embed/${agent.id}"
  width="400"
  height="600"
  frameborder="0"
  allow="clipboard-write"
  style="border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
></iframe>`;

  const scriptCode = `<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${origin}/embed/${agent.id}';
    iframe.width = '400';
    iframe.height = '600';
    iframe.frameBorder = '0';
    iframe.style.cssText = 'position:fixed;bottom:24px;right:24px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:9999;';
    document.body.appendChild(iframe);
  })();
</script>`;

  const code = tab === "iframe" ? iframeCode : scriptCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Embed &quot;{agent.name}&quot;</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add this chatbot to any website</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
            {(["iframe", "script"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
                  tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "iframe" ? "iFrame" : "Script Tag"}
              </button>
            ))}
          </div>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed">
              {code}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Paste this code anywhere in your website&apos;s HTML. The chatbot will be publicly
            accessible — no login required.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onDelete,
  onEmbed,
  onToggle,
  onConfigure,
  onClone,
}: {
  agent: Chatbot;
  onDelete: () => void;
  onEmbed: () => void;
  onToggle: () => void;
  onConfigure: () => void;
  onClone: () => void;
}) {
  const provider = agent.provider ?? "anthropic";
  const providerInfo = PROVIDER_COLORS[provider as Provider] ?? PROVIDER_COLORS.anthropic;
  const avatar = agent.appearance?.avatar ?? "🤖";
  const primaryColor = agent.appearance?.primaryColor ?? "#7c3aed";
  const connectedCount = (agent.connected_workflows ?? []).filter(w => w.enabled).length;
  // Shorten model name for display (e.g. "claude-haiku-4-5-20251001" → "claude-haiku-4-5")
  const shortModel = agent.model?.replace(/-\d{8,}$/, "").replace(/^(claude|gpt|gemini|llama|mistral)-/, m => m) ?? "";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:border-gray-300 transition-all flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: primaryColor + "18" }}
          >
            {avatar}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate leading-tight">{agent.name}</h3>
            {agent.description && (
              <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">{agent.description}</p>
            )}
          </div>
        </div>
        {/* Active toggle */}
        <button
          onClick={onToggle}
          title={agent.is_active ? "Deactivate" : "Activate"}
          className="flex-shrink-0 ml-2"
        >
          <div className={`w-9 h-5 rounded-full transition-colors relative ${agent.is_active ? "bg-violet-500" : "bg-gray-200"}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${agent.is_active ? "left-4" : "left-0.5"}`} />
          </div>
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: providerInfo.bg }}
        >
          {providerInfo.icon} {providerInfo.text}
        </span>
        <span className="text-[10px] bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full font-mono">
          {shortModel}
        </span>
        {connectedCount > 0 && (
          <span className="text-[10px] bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap size={9} />
            {connectedCount} flow{connectedCount !== 1 ? "s" : ""}
          </span>
        )}
        {agent.starter_questions?.length > 0 && (
          <span className="text-[10px] bg-blue-50 text-blue-500 font-semibold px-2 py-0.5 rounded-full">
            {agent.starter_questions.length} starters
          </span>
        )}
      </div>

      {/* System prompt preview — fixed height so all cards align */}
      <div className="flex-1 mb-4">
        <p className="text-[11px] text-gray-400 line-clamp-3 leading-relaxed">
          {agent.system_prompt || <span className="italic">No system prompt set</span>}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-3 border-t border-gray-100">
        <button
          onClick={onConfigure}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
        >
          <Settings size={12} /> Configure
        </button>
        <button
          onClick={onEmbed}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 transition-all"
        >
          <Code2 size={12} /> Embed
        </button>
        <button
          onClick={onClone}
          title="Duplicate agent"
          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-violet-600 px-2 py-1.5 rounded-lg hover:bg-violet-50 transition-all"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={onDelete}
          title="Delete agent"
          className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-300 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [embedAgent, setEmbedAgent] = useState<Chatbot | null>(null);
  const [templateLoading, setTemplateLoading] = useState<number | null>(null);

  // AI generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/agents")
      .then(r => r.json())
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUseTemplate = async (template: (typeof TEMPLATES)[number], index: number) => {
    setTemplateLoading(index);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          system_prompt: template.system_prompt,
          knowledge_base: template.knowledge_base,
          provider: template.provider,
          model: template.model,
          temperature: template.temperature,
          max_tokens: template.max_tokens,
          appearance: template.appearance,
          starter_questions: template.starter_questions,
          connected_workflows: [],
          is_active: true,
        }),
      });
      const created = await res.json();
      if (created.id) {
        router.push(`/agents/${created.id}`);
      }
    } catch {
      // fail silently — user can create manually
    } finally {
      setTemplateLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const handleClone = async (agent: Chatbot) => {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Copy of ${agent.name}`,
        description: agent.description,
        system_prompt: agent.system_prompt,
        knowledge_base: agent.knowledge_base,
        provider: agent.provider,
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        appearance: agent.appearance,
        starter_questions: agent.starter_questions,
        connected_workflows: [],
        is_active: false,
      }),
    });
    if (res.ok) {
      const cloned = await res.json();
      setAgents(prev => [cloned, ...prev]);
    }
  };

  const handleToggle = async (agent: Chatbot) => {
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !agent.is_active }),
    });
    const updated = await res.json();
    setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const config = await res.json();

      const createRes = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name ?? "Generated Agent",
          description: config.description ?? "",
          system_prompt: config.system_prompt ?? "You are a helpful assistant.",
          model: "claude-haiku-4-5-20251001",
          provider: "anthropic",
          appearance: {
            ...DEFAULT_APPEARANCE,
            ...(config.appearance ?? {}),
          },
          starter_questions: config.starter_questions ?? [],
        }),
      });
      const created = await createRes.json();
      if (created.id) {
        router.push(`/agents/${created.id}`);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="AI Agents"
        subtitle="Create embeddable chatbots for your website"
        action={
          <button
            onClick={() => router.push("/agents/new")}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> New Agent
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6 space-y-8">
        {/* Templates Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold text-gray-900">Pre-built Templates</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
              {TEMPLATES.length} templates
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {TEMPLATES.map((template, i) => (
              <TemplateCard
                key={i}
                template={template}
                onUse={() => handleUseTemplate(template, i)}
                loading={templateLoading === i}
              />
            ))}
          </div>
        </div>

        {/* AI Generation Card */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-violet-200" />
            <h2 className="text-sm font-bold">Generate with AI</h2>
          </div>
          <p className="text-xs text-violet-200 mb-4">
            Describe your chatbot and AI will configure it for you — system prompt, starter
            questions, and appearance.
          </p>

          <div className="flex gap-2 mb-3">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="e.g. A friendly customer support bot for a project management SaaS..."
              rows={2}
              className="flex-1 text-sm bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 placeholder-violet-300 text-white outline-none focus:bg-white/20 resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !aiPrompt.trim()}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white text-violet-700 text-sm font-semibold rounded-xl hover:bg-violet-50 transition-colors disabled:opacity-50 self-start"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => setAiPrompt(p)}
                className="text-[11px] bg-white/15 hover:bg-white/25 text-violet-100 px-3 py-1 rounded-full transition-all border border-white/10"
              >
                {p}
              </button>
            ))}
          </div>

          {aiError && (
            <p className="mt-3 text-xs text-red-300 flex items-center gap-1.5">
              <AlertCircle size={12} /> {aiError}
            </p>
          )}
        </div>

        {/* Agents Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">
              Your Agents
              {agents.length > 0 && (
                <span className="ml-2 text-xs font-medium text-gray-400">
                  ({agents.length})
                </span>
              )}
            </h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-52 bg-white border border-gray-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-100">
                <Bot size={28} className="text-violet-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-700 mb-2">No agents yet</h2>
              <p className="text-sm text-gray-400 mb-2 max-w-sm mx-auto">
                Use a template above or create a custom agent. Configure its personality, knowledge,
                and appearance.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onConfigure={() => router.push(`/agents/${agent.id}`)}
                  onDelete={() => handleDelete(agent.id)}
                  onEmbed={() => setEmbedAgent(agent)}
                  onToggle={() => handleToggle(agent)}
                  onClone={() => handleClone(agent)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {embedAgent && (
        <EmbedModal
          agent={embedAgent}
          onClose={() => setEmbedAgent(null)}
        />
      )}
    </AppShell>
  );
}
