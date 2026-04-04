"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plus, Phone, Loader2, Trash2, MoreHorizontal,
  X, Check, AlertCircle, Mic, PhoneCall, PhoneOff,
} from "lucide-react";

type VoiceAgent = {
  id: string;
  name: string;
  description: string;
  voice: string;
  llm_model: string;
  twilio_phone_number: string;
  is_active: boolean;
  created_at: string;
};

const ACCENT_COLORS = [
  { bar: "bg-violet-500", icon: "bg-violet-50 border-violet-100 text-violet-600" },
  { bar: "bg-blue-500",   icon: "bg-blue-50 border-blue-100 text-blue-600" },
  { bar: "bg-emerald-500",icon: "bg-emerald-50 border-emerald-100 text-emerald-600" },
  { bar: "bg-orange-500", icon: "bg-orange-50 border-orange-100 text-orange-600" },
  { bar: "bg-pink-500",   icon: "bg-pink-50 border-pink-100 text-pink-600" },
  { bar: "bg-teal-500",   icon: "bg-teal-50 border-teal-100 text-teal-600" },
];

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onSave, onClose }: {
  onSave: (data: { name: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try { await onSave({ name: name.trim(), description: description.trim() }); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">New Voice Agent</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Agent name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Support Agent, Sales Bot"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Create agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, index, onDelete, onOpen }: {
  agent: VoiceAgent;
  index: number;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const hasPhone = !!agent.twilio_phone_number;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all group flex flex-col">
      <div className={`h-1 w-full ${accent.bar}`} />
      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${accent.icon}`}>
            <Phone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{agent.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
              {agent.description || <span className="italic">No description</span>}
            </p>
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 transition-all"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 w-40 z-20">
                  <button onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-2 flex-1 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mic size={12} className="text-gray-400 flex-shrink-0" />
            <span>{agent.voice}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <PhoneCall size={12} className={`flex-shrink-0 ${hasPhone ? "text-green-500" : "text-gray-300"}`} />
            {hasPhone
              ? <span className="font-mono text-green-700">{agent.twilio_phone_number}</span>
              : <span className="text-gray-300 italic">No phone number</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${agent.is_active ? "bg-green-50 text-green-600 border border-green-100" : "bg-gray-100 text-gray-400 border border-gray-200"}`}>
              {agent.is_active ? <><PhoneCall size={10} /> Active</> : <><PhoneOff size={10} /> Inactive</>}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {new Date(agent.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button onClick={onOpen}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
            Configure →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VoiceAgentsPage() {
  const router = useRouter();
  const [agents, setAgents]     = useState<VoiceAgent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/voice-agents")
      .then(r => r.json())
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { name: string; description: string }) => {
    const res = await fetch("/api/voice-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create");
    setShowCreate(false);
    router.push(`/voice-agents/${json.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this voice agent? This cannot be undone.")) return;
    await fetch(`/api/voice-agents/${id}`, { method: "DELETE" });
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  return (
    <AppShell>
      <PageHeader
        title="Voice Agents"
        subtitle="AI agents that answer and make phone calls using your Twilio number"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus size={14} /> New agent
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-5 border border-violet-100 shadow-sm">
              <Phone size={28} className="text-violet-500" />
            </div>
            <h2 className="text-base font-bold text-gray-800 mb-2">No voice agents yet</h2>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              Create a voice agent, connect your Twilio number, and let AI handle your calls — inbound or outbound.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Plus size={14} /> Create your first voice agent
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 font-medium mb-5">{agents.length} agent{agents.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent, i) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={i}
                  onDelete={() => handleDelete(agent.id)}
                  onOpen={() => router.push(`/voice-agents/${agent.id}`)}
                />
              ))}
              <button
                onClick={() => setShowCreate(true)}
                className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2.5 hover:border-violet-300 hover:bg-violet-50/40 transition-all text-gray-400 hover:text-violet-500 min-h-[180px] group"
              >
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-violet-300 flex items-center justify-center transition-colors">
                  <Plus size={18} />
                </div>
                <span className="text-xs font-semibold">New agent</span>
              </button>
            </div>
          </>
        )}
      </main>

      {showCreate && (
        <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </AppShell>
  );
}
