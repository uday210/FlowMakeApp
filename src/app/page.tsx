"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workflow } from "@/lib/types";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plus,
  Workflow as WorkflowIcon,
  Play,
  Clock,
  Trash2,
  ChevronRight,
  Zap,
  Loader2,
  PauseCircle,
  PlayCircle,
  Search,
  LayoutTemplate,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";

function WorkflowCard({
  workflow,
  onDelete,
  onRun,
  onToggleActive,
  isRunning,
  runStatus,
}: {
  workflow: Workflow;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  isRunning: boolean;
  runStatus?: "success" | "failed";
}) {
  const router = useRouter();
  const nodeCount = workflow.nodes?.length ?? 0;
  const updatedAt = new Date(workflow.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`group relative bg-white border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer ${
        runStatus === "success"
          ? "border-green-300 shadow-green-50"
          : runStatus === "failed"
          ? "border-red-300"
          : "border-gray-200 hover:border-violet-200"
      }`}
      onClick={() => router.push(`/workflows/${workflow.id}`)}
    >
      {isRunning && (
        <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center z-10">
          <span className="text-xs text-violet-600 font-medium flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Running…
          </span>
        </div>
      )}

      {/* App icons row (node type icons) */}
      <div className="flex items-center gap-1.5 mb-3">
        {(workflow.nodes ?? []).slice(0, 4).map((n, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0"
          >
            <Zap size={12} className="text-violet-600" />
          </div>
        ))}
        {(workflow.nodes?.length ?? 0) > 4 && (
          <span className="text-[10px] text-gray-400 font-medium">
            +{(workflow.nodes?.length ?? 0) - 4}
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">
        {workflow.name}
      </h3>
      {workflow.description && (
        <p className="text-xs text-gray-400 truncate mb-3">{workflow.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock size={9} /> {updatedAt}
          </span>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              workflow.is_active
                ? "bg-green-50 text-green-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {workflow.is_active ? "● Active" : "Paused"}
          </span>
        </div>
        <ChevronRight size={14} className="text-gray-300 group-hover:text-violet-400 transition-colors" />
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onRun(workflow.id)}
          className="flex items-center gap-1 text-[10px] font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Play size={10} /> Run once
        </button>
        <button
          onClick={() => onToggleActive(workflow.id, !workflow.is_active)}
          className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
            workflow.is_active
              ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
              : "text-violet-600 bg-violet-50 hover:bg-violet-100"
          }`}
        >
          {workflow.is_active ? <><PauseCircle size={10} /> Pause</> : <><PlayCircle size={10} /> Activate</>}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onDelete(workflow.id)}
          className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── AI Prompt Bar ────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "When a form is submitted, save the data to my table and send a confirmation email",
  "Every day at 9am fetch data from an HTTP API and post a summary to Slack",
  "When a webhook is received, parse the payload and insert a row into my table",
  "Form submission → summarize with OpenAI → save result to my table",
];

type GeneratedPreview = {
  id: string;
  name: string;
  nodeCount: number;
};

const GENERATING_STEPS = [
  "Reading your description…",
  "Identifying trigger and actions…",
  "Wiring up nodes…",
  "Saving workflow…",
];

function AIPromptBar({ onCreated }: { onCreated: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GeneratedPreview | null>(null);

  // Cycle through steps while generating
  useEffect(() => {
    if (!generating) { setStepIdx(0); return; }
    const t = setInterval(() => setStepIdx(i => Math.min(i + 1, GENERATING_STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [generating]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/ai/generate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate workflow");
      setPreview({
        id: data.id,
        name: data.workflow.name,
        nodeCount: data.workflow.nodes?.length ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try rephrasing.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpen = () => {
    if (preview) onCreated(preview.id);
  };

  const handleReset = () => {
    setPreview(null);
    setPrompt("");
    setError("");
  };

  return (
    <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 rounded-2xl p-5 mb-7 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} className="text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-white">Build with AI</span>
          <span className="text-[10px] text-violet-300 ml-2">Describe what you want — Claude builds it</span>
        </div>
      </div>

      {/* Preview state — show after generation */}
      {preview ? (
        <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-200 mb-0.5">Workflow created</p>
            <p className="text-sm font-bold text-white truncate">{preview.name}</p>
            <p className="text-[10px] text-violet-300 mt-0.5">{preview.nodeCount} node{preview.nodeCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-violet-200 hover:text-white border border-white/20 rounded-lg transition-colors"
            >
              New
            </button>
            <button
              onClick={handleOpen}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-violet-700 text-xs font-bold rounded-lg hover:bg-violet-50 transition-colors shadow-sm"
            >
              Open workflow <ArrowRight size={12} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Input row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={prompt}
                onChange={e => { setPrompt(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleGenerate()}
                disabled={generating}
                placeholder="e.g. When a form is submitted, save the data to my table and send an email"
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white/15 focus:border-white/50 transition-all disabled:opacity-60"
              />
              {prompt && !generating && (
                <button
                  onClick={handleReset}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-white text-violet-700 text-sm font-bold rounded-xl hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm min-w-[130px] justify-center"
            >
              {generating
                ? <><Loader2 size={14} className="animate-spin flex-shrink-0" /><span className="truncate">{GENERATING_STEPS[stepIdx]}</span></>
                : <><Sparkles size={14} /><span>Generate</span></>
              }
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5 flex items-start gap-2">
              <X size={13} className="text-red-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-200">{error}</p>
            </div>
          )}

          {/* Example chips */}
          {!generating && (
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setPrompt(ex); setError(""); }}
                  className="text-[10px] text-violet-200 bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 rounded-full transition-colors text-left leading-relaxed max-w-xs truncate"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, "success" | "failed">>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((data) => setWorkflows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setCreating(true);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled Scenario" }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.id) router.push(`/workflows/${data.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scenario?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, is_active: active } : w)));
    await fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    const res = await fetch(`/api/execute/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _trigger: "manual" }),
    });
    const data = await res.json();
    setRunningId(null);
    setRunResults((prev) => ({ ...prev, [id]: data.status === "success" ? "success" : "failed" }));
    setTimeout(() => setRunResults((prev) => { const n = { ...prev }; delete n[id]; return n; }), 3000);
  };

  const active = workflows.filter((w) => w.is_active).length;

  return (
    <AppShell>
      <PageHeader
        title="Scenarios"
        subtitle={`${workflows.length} scenario${workflows.length !== 1 ? "s" : ""}${active ? ` · ${active} active` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/templates")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <LayoutTemplate size={14} /> Templates
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create scenario
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {/* AI Prompt Bar */}
        <AIPromptBar onCreated={(id) => router.push(`/workflows/${id}`)} />

        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scenarios…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse h-40" />
            ))}
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="text-center py-16 text-gray-400 text-sm">No scenarios match "{search}"</div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <WorkflowIcon size={28} className="text-violet-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-700 mb-1">No scenarios yet</h2>
            <p className="text-sm text-gray-400 mb-6">
              Create a scenario or start from a template
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => router.push("/templates")}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <LayoutTemplate size={14} /> Browse templates
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
              >
                <Plus size={14} /> Create scenario
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onDelete={handleDelete}
                onRun={handleRun}
                onToggleActive={handleToggleActive}
                isRunning={runningId === wf.id}
                runStatus={runResults[wf.id]}
              />
            ))}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/50 transition-all text-gray-400 hover:text-violet-500 min-h-[160px]"
            >
              <Plus size={22} />
              <span className="text-xs font-medium">New scenario</span>
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
