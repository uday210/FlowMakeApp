"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plus, Trash2, Loader2, X, Check, Copy, Bot,
  AlertCircle, Sparkles, Pencil, Code2, ToggleLeft, ToggleRight,
  ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  description: string;
  system_prompt: string;
  model: string;
  appearance: Appearance;
  starter_questions: string[];
  is_active: boolean;
  created_at: string;
};

const DEFAULT_APPEARANCE: Appearance = {
  primaryColor: "#7c3aed",
  greetingMessage: "Hi! How can I help you today?",
  placeholder: "Type a message...",
  agentName: "Assistant",
  showBranding: true,
};

const MODELS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku (Fast)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet (Balanced)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const EXAMPLE_PROMPTS = [
  "Customer support for a SaaS product",
  "FAQ bot for an e-commerce store",
  "Sales assistant that books demos",
  "IT helpdesk assistant",
];

// ─── Agent Modal ──────────────────────────────────────────────────────────────

function AgentModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Chatbot>;
  onSave: (data: Partial<Chatbot>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    initial?.system_prompt ?? "You are a helpful assistant."
  );
  const [model, setModel] = useState(initial?.model ?? "claude-haiku-4-5-20251001");
  const [starterQs, setStarterQs] = useState(
    (initial?.starter_questions ?? []).join(", ")
  );
  const [appearance, setAppearance] = useState<Appearance>(
    initial?.appearance ?? { ...DEFAULT_APPEARANCE }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Agent name is required"); return; }
    setSaving(true);
    try {
      const questions = starterQs
        .split(",")
        .map(q => q.trim())
        .filter(Boolean);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        model,
        appearance,
        starter_questions: questions,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {initial?.id ? "Edit Agent" : "Create New Agent"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Agent name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Support Bot, Sales Assistant"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={5}
              placeholder="Instructions for how the agent should behave..."
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
            />
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none bg-white"
              >
                {MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Starter Questions */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Starter questions <span className="font-normal text-gray-400">(comma-separated)</span>
            </label>
            <input
              value={starterQs}
              onChange={e => setStarterQs(e.target.value)}
              placeholder="How can I reset my password?, What are your hours?, ..."
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Appearance */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-3 block">Appearance</label>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-gray-500 mb-1 block">Agent display name</label>
                  <input
                    value={appearance.agentName}
                    onChange={e => setAppearance(a => ({ ...a, agentName: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 bg-white"
                    placeholder="Assistant"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Primary color</label>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                    <input
                      type="color"
                      value={appearance.primaryColor}
                      onChange={e => setAppearance(a => ({ ...a, primaryColor: e.target.value }))}
                      className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <span className="text-xs font-mono text-gray-500">{appearance.primaryColor}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Greeting message</label>
                <input
                  value={appearance.greetingMessage}
                  onChange={e => setAppearance(a => ({ ...a, greetingMessage: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 bg-white"
                  placeholder="Hi! How can I help you today?"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-gray-500">Show &quot;Powered by FlowMake&quot; branding</label>
                <button
                  type="button"
                  onClick={() => setAppearance(a => ({ ...a, showBranding: !a.showBranding }))}
                  className={`transition-colors ${appearance.showBranding ? "text-violet-600" : "text-gray-300"}`}
                >
                  {appearance.showBranding ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {initial?.id ? "Save changes" : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Embed Code Modal ─────────────────────────────────────────────────────────

function EmbedModal({ agent, onClose }: { agent: Chatbot; onClose: () => void }) {
  const [tab, setTab] = useState<"iframe" | "script">("iframe");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

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
          {/* Tabs */}
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

          {/* Code block */}
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
            Paste this code anywhere in your website&apos;s HTML. The chatbot will be publicly accessible — no login required.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onEdit,
  onDelete,
  onEmbed,
  onToggle,
}: {
  agent: Chatbot;
  onEdit: () => void;
  onDelete: () => void;
  onEmbed: () => void;
  onToggle: () => void;
}) {
  const modelLabel = MODELS.find(m => m.value === agent.model)?.label ?? agent.model;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{
              backgroundColor: agent.appearance.primaryColor + "1a",
              borderColor: agent.appearance.primaryColor + "33",
            }}
          >
            <Bot size={18} style={{ color: agent.appearance.primaryColor }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{agent.name}</h3>
            {agent.description && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{agent.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={onToggle}
          title={agent.is_active ? "Deactivate" : "Activate"}
          className={`flex-shrink-0 transition-colors ${agent.is_active ? "text-violet-600" : "text-gray-300"}`}
        >
          {agent.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>

      {/* Model badge */}
      <div className="mb-4">
        <span className="text-[10px] bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full">
          {modelLabel}
        </span>
        {agent.starter_questions.length > 0 && (
          <span className="ml-2 text-[10px] bg-blue-50 text-blue-500 font-medium px-2 py-0.5 rounded-full">
            {agent.starter_questions.length} starter question{agent.starter_questions.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* System prompt preview */}
      <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
        {agent.system_prompt}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={onEmbed}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-all"
        >
          <Code2 size={12} /> Embed
        </button>
        <button
          onClick={onDelete}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; agent?: Chatbot } | null>(null);
  const [embedAgent, setEmbedAgent] = useState<Chatbot | null>(null);

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

  const handleSave = async (data: Partial<Chatbot>) => {
    if (modal?.mode === "edit" && modal.agent) {
      const res = await fetch(`/api/agents/${modal.agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const created = await res.json();
      setAgents(prev => [created, ...prev]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const handleToggle = async (agent: Chatbot) => {
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...agent, is_active: !agent.is_active }),
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
      setModal({
        mode: "create",
        agent: {
          id: "",
          name: config.name ?? "",
          description: config.description ?? "",
          system_prompt: config.system_prompt ?? "You are a helpful assistant.",
          model: "claude-haiku-4-5-20251001",
          appearance: {
            ...DEFAULT_APPEARANCE,
            ...(config.appearance ?? {}),
          },
          starter_questions: config.starter_questions ?? [],
          is_active: true,
          created_at: "",
        },
      });
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
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> New Agent
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* AI Generation Card */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-violet-200" />
            <h2 className="text-sm font-bold">Generate with AI</h2>
          </div>
          <p className="text-xs text-violet-200 mb-4">
            Describe your chatbot and AI will configure it for you — system prompt, starter questions, and appearance.
          </p>

          <div className="flex gap-2 mb-3">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
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

          {/* Example chips */}
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
              Create your first AI chatbot and embed it on any website. Configure its personality, knowledge, and appearance.
            </p>
            <button
              onClick={() => setModal({ mode: "create" })}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors mx-auto"
            >
              <Plus size={14} /> Create your first agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={() => setModal({ mode: "edit", agent })}
                onDelete={() => handleDelete(agent.id)}
                onEmbed={() => setEmbedAgent(agent)}
                onToggle={() => handleToggle(agent)}
              />
            ))}
            <button
              onClick={() => setModal({ mode: "create" })}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/50 transition-all text-gray-400 hover:text-violet-500 min-h-[200px]"
            >
              <Plus size={22} />
              <span className="text-xs font-medium">New agent</span>
            </button>
          </div>
        )}
      </main>

      {modal && (
        <AgentModal
          initial={modal.agent}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {embedAgent && (
        <EmbedModal
          agent={embedAgent}
          onClose={() => setEmbedAgent(null)}
        />
      )}
    </AppShell>
  );
}
