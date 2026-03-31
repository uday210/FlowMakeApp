"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Plus, Search, Zap, PlayCircle, PauseCircle, Trash2, Loader2, Clock, Sparkles, AlertCircle } from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EXAMPLE_PROMPTS = [
  "Webhook → save to table → send email",
  "Daily report from API → Slack notification",
  "Form submission → CRM + confirmation email",
  "New lead → AI qualify → notify sales",
];

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    fetch("/api/workflows")
      .then(r => r.json())
      .then(d => setWorkflows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Scenario", nodes: [], edges: [] }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/workflows/${id}`);
    } else {
      const json = await res.json().catch(() => ({}));
      setCreateError(json.error ?? "Failed to create scenario");
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setAiError("");
    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      router.push(`/workflows/${data.id}`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  };

  const toggleActive = async (w: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/workflows/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !w.is_active }),
    });
    setWorkflows(prev => prev.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleDelete = async (w: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${w.name}"?`)) return;
    await fetch(`/api/workflows/${w.id}`, { method: "DELETE" });
    setWorkflows(prev => prev.filter(x => x.id !== w.id));
  };

  return (
    <AppShell>
      <PageHeader
        title="Scenarios"
        subtitle="Manage your automation workflows"
        action={
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              New Scenario
            </button>
            {createError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium max-w-xs text-right">
                <AlertCircle size={12} className="flex-shrink-0" /> {createError}
              </p>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Build with AI banner */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-violet-200" />
            <h2 className="text-sm font-bold">Build with AI</h2>
          </div>
          <p className="text-xs text-violet-200 mb-4">
            Describe your automation in plain English and AI will generate the workflow for you — nodes, connections, and logic.
          </p>
          <div className="flex gap-2 mb-3">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
              }}
              placeholder="e.g. When a webhook is received, save the data to my table and send a Slack notification..."
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

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search scenarios..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
          />
        </div>

        {/* Scenarios grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Zap size={28} className="text-gray-200" />
            <p className="font-medium text-gray-500">{search ? "No scenarios match your search" : "No scenarios yet — create one above"}</p>
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-4">
              Your Scenarios
              <span className="ml-2 text-xs font-medium text-gray-400">({filtered.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(w => (
                <div
                  key={w.id}
                  onClick={() => router.push(`/workflows/${w.id}`)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed22, #ec489922)" }}>
                      <Zap size={17} className="text-violet-600" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => toggleActive(w, e)}
                        title={w.is_active ? "Deactivate" : "Activate"}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {w.is_active
                          ? <PauseCircle size={15} className="text-amber-500" />
                          : <PlayCircle size={15} className="text-green-500" />
                        }
                      </button>
                      <button
                        onClick={e => handleDelete(w, e)}
                        title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{w.name}</h3>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      w.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${w.is_active ? "bg-green-400" : "bg-gray-300"}`} />
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(w.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
