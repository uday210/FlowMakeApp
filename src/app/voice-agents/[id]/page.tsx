"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  ArrowLeft, Phone, Save, Loader2, AlertCircle, Check,
  PhoneCall, PhoneOff, Clock, ChevronDown, ChevronUp,
  Mic, Copy, RefreshCw, X, Plus, Trash2, Wrench,
} from "lucide-react";

type AgentTool = {
  type: "query_table" | "insert_row" | "trigger_workflow";
  table_id?: string;
  workflow_id?: string;
  description: string;
};

type VoiceAgent = {
  id: string; org_id: string; name: string; description: string;
  system_prompt: string; greeting: string; voice: string; language: string;
  llm_provider: string; llm_model: string; llm_api_key: string;
  twilio_account_sid: string; twilio_auth_token: string; twilio_phone_number: string;
  max_turns: number; is_active: boolean; created_at: string;
  tools: AgentTool[];
};

type VoiceCall = {
  id: string; call_sid: string; direction: string; from_number: string;
  to_number: string; status: string; transcript: { role: string; text: string; ts: string }[];
  duration_seconds: number | null; started_at: string; ended_at: string | null;
};

const VOICES = [
  { value: "Polly.Joanna",   label: "Joanna (US Female)" },
  { value: "Polly.Matthew",  label: "Matthew (US Male)" },
  { value: "Polly.Amy",      label: "Amy (UK Female)" },
  { value: "Polly.Brian",    label: "Brian (UK Male)" },
  { value: "Polly.Emma",     label: "Emma (UK Female)" },
  { value: "Polly.Ivy",      label: "Ivy (US Female, child)" },
  { value: "Polly.Kendra",   label: "Kendra (US Female)" },
  { value: "Polly.Kimberly", label: "Kimberly (US Female)" },
  { value: "Polly.Salli",    label: "Salli (US Female)" },
  { value: "Polly.Joey",     label: "Joey (US Male)" },
  { value: "Polly.Justin",   label: "Justin (US Male)" },
  { value: "Google.en-US-Neural2-F", label: "Google Neural (US Female)" },
  { value: "Google.en-US-Neural2-D", label: "Google Neural (US Male)" },
];

const LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (AU)" },
  { value: "es-ES", label: "Spanish (ES)" },
  { value: "es-MX", label: "Spanish (MX)" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese (BR)" },
  { value: "ja-JP", label: "Japanese" },
];

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    "completed":  "bg-green-50 text-green-600 border-green-100",
    "in-progress":"bg-blue-50 text-blue-600 border-blue-100",
    "failed":     "bg-red-50 text-red-500 border-red-100",
    "busy":       "bg-yellow-50 text-yellow-600 border-yellow-100",
    "no-answer":  "bg-gray-100 text-gray-500 border-gray-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
}

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Call row ─────────────────────────────────────────────────────────────────

function CallRow({ call }: { call: VoiceCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${call.status === "completed" ? "bg-green-400" : call.status === "in-progress" ? "bg-blue-400 animate-pulse" : "bg-red-400"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">{call.from_number || "Unknown"}</span>
            <span className="text-xs text-gray-400">→</span>
            <span className="text-xs text-gray-600">{call.to_number || "Unknown"}</span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${statusBadge(call.status)}`}>
              {call.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><Clock size={9} />{new Date(call.started_at).toLocaleString()}</span>
            <span className="flex items-center gap-1"><PhoneCall size={9} />{formatDuration(call.duration_seconds)}</span>
            <span>{call.transcript.length} turns</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && call.transcript.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5 bg-gray-50/50">
          {call.transcript.map((t, i) => (
            <div key={i} className={`flex gap-2.5 ${t.role === "assistant" ? "flex-row-reverse" : ""}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${t.role === "assistant" ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-500"}`}>
                {t.role === "assistant" ? "AI" : "U"}
              </div>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-[80%] ${t.role === "assistant" ? "bg-violet-50 text-violet-800" : "bg-white border border-gray-200 text-gray-700"}`}>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      )}
      {expanded && call.transcript.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 italic bg-gray-50/50">
          No transcript recorded
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VoiceAgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [agent, setAgent]   = useState<VoiceAgent | null>(null);
  const [draft, setDraft]   = useState<VoiceAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");

  const [calls, setCalls]   = useState<VoiceCall[]>([]);
  const [callsTotal, setCallsTotal] = useState(0);
  const [callsLoading, setCallsLoading] = useState(true);
  const [tab, setTab]       = useState<"config" | "calls">("config");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch(`/api/voice-agents/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          if (!d.tools) d.tools = [];
          setAgent(d); setDraft(d);
        } else router.push("/voice-agents");
      });
    fetch("/api/tables").then(r => r.json()).then(d => setTables(Array.isArray(d) ? d : []));
    fetch("/api/workflows").then(r => r.json()).then(d => setWorkflows(Array.isArray(d) ? d : []));
  }, [id, router]);

  const loadCalls = useCallback(() => {
    setCallsLoading(true);
    fetch(`/api/voice-agents/${id}/calls?limit=50`)
      .then(r => r.json())
      .then(d => { setCalls(d.calls ?? []); setCallsTotal(d.total ?? 0); })
      .finally(() => setCallsLoading(false));
  }, [id]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const patch = (key: keyof VoiceAgent, value: unknown) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/voice-agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setAgent(json);
      setDraft(json);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/voice/webhook/${id}`
    : `/api/voice/webhook/${id}`;

  const statusUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/voice/status/${id}`
    : `/api/voice/status/${id}`;

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  if (!draft) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-200 bg-white flex-shrink-0">
          <Link href="/voice-agents" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <ArrowLeft size={15} />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-violet-50 border border-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Phone size={14} className="text-violet-600" />
            </div>
            <span className="text-sm font-bold text-gray-900 truncate">{agent?.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${draft.is_active ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
              {draft.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex-1" />
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-6 flex-shrink-0">
          {(["config", "calls"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-semibold capitalize border-b-2 transition-colors ${tab === t ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t === "calls" ? `Call Logs${callsTotal > 0 ? ` (${callsTotal})` : ""}` : "Configuration"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {tab === "config" && (
            <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

              {/* Basic */}
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Basic</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Agent name</label>
                    <input value={draft.name} onChange={e => patch("name", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description</label>
                    <input value={draft.description} onChange={e => patch("description", e.target.value)}
                      placeholder="What does this agent do?"
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={draft.is_active} onChange={e => patch("is_active", e.target.checked)}
                      className="accent-violet-600 w-4 h-4" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Active</span>
                      <p className="text-xs text-gray-400">When inactive, incoming calls will hear "not in service"</p>
                    </div>
                  </label>
                </div>
              </section>

              {/* Personality */}
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Personality</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Greeting</label>
                    <input value={draft.greeting} onChange={e => patch("greeting", e.target.value)}
                      placeholder="Hello! How can I help you today?"
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                    <p className="text-xs text-gray-400 mt-1">First thing the agent says when a call connects.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">System prompt</label>
                    <textarea value={draft.system_prompt} onChange={e => patch("system_prompt", e.target.value)}
                      rows={5} placeholder="You are a helpful voice assistant..."
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none" />
                    <p className="text-xs text-gray-400 mt-1">Keep responses short — this is read aloud on a phone call.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Max conversation turns</label>
                    <input type="number" value={draft.max_turns} onChange={e => patch("max_turns", parseInt(e.target.value))}
                      min={1} max={50}
                      className="w-24 text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400" />
                    <p className="text-xs text-gray-400 mt-1">Agent hangs up after this many user messages.</p>
                  </div>
                </div>
              </section>

              {/* Voice */}
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Voice & Language</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Voice</label>
                    <select value={draft.voice} onChange={e => patch("voice", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 bg-white">
                      {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Language</label>
                    <select value={draft.language} onChange={e => patch("language", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 bg-white">
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* LLM */}
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">AI Model</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Model</label>
                    <select value={draft.llm_model} onChange={e => patch("llm_model", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 bg-white">
                      {OPENAI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">OpenAI API key</label>
                    <input type="password" value={draft.llm_api_key} onChange={e => patch("llm_api_key", e.target.value)}
                      placeholder="sk-..."
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 font-mono" />
                  </div>
                </div>
              </section>

              {/* Twilio */}
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Twilio — Phone number</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Account SID</label>
                    <input value={draft.twilio_account_sid} onChange={e => patch("twilio_account_sid", e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Auth token</label>
                    <input type="password" value={draft.twilio_auth_token} onChange={e => patch("twilio_auth_token", e.target.value)}
                      placeholder="Your Twilio auth token"
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone number</label>
                    <input value={draft.twilio_phone_number} onChange={e => patch("twilio_phone_number", e.target.value)}
                      placeholder="+15551234567"
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 font-mono" />
                  </div>
                </div>
              </section>

              {/* Tools */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tools</h3>
                  <button
                    onClick={() => patch("tools", [...(draft.tools ?? []), { type: "query_table", table_id: tables[0]?.id ?? "", description: "" }])}
                    className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    <Plus size={12} /> Add tool
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">Give your agent the ability to look up data, save info, or trigger automations during a call.</p>

                {(draft.tools ?? []).length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                    <Wrench size={20} className="text-gray-200" />
                    <p className="text-xs font-medium">No tools yet</p>
                    <button
                      onClick={() => patch("tools", [{ type: "query_table", table_id: tables[0]?.id ?? "", description: "" }])}
                      className="text-xs text-violet-600 font-semibold hover:underline"
                    >+ Add your first tool</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(draft.tools ?? []).map((tool, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tool type</label>
                            <select
                              value={tool.type}
                              onChange={e => {
                                const updated = [...(draft.tools ?? [])];
                                updated[i] = { ...updated[i], type: e.target.value as AgentTool["type"], table_id: undefined, workflow_id: undefined };
                                patch("tools", updated);
                              }}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 bg-white"
                            >
                              <option value="query_table">Query Table — look up data</option>
                              <option value="insert_row">Insert Row — save data</option>
                              <option value="trigger_workflow">Trigger Workflow — run automation</option>
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              const updated = (draft.tools ?? []).filter((_, j) => j !== i);
                              patch("tools", updated);
                            }}
                            className="mt-5 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {(tool.type === "query_table" || tool.type === "insert_row") && (
                          <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Table</label>
                            {tables.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No tables found — create one in My Tables first</p>
                            ) : (
                              <select
                                value={tool.table_id ?? ""}
                                onChange={e => {
                                  const updated = [...(draft.tools ?? [])];
                                  updated[i] = { ...updated[i], table_id: e.target.value };
                                  patch("tools", updated);
                                }}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 bg-white"
                              >
                                <option value="">Select a table…</option>
                                {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            )}
                          </div>
                        )}

                        {tool.type === "trigger_workflow" && (
                          <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Workflow</label>
                            {workflows.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No workflows found — create one in Scenarios first</p>
                            ) : (
                              <select
                                value={tool.workflow_id ?? ""}
                                onChange={e => {
                                  const updated = [...(draft.tools ?? [])];
                                  updated[i] = { ...updated[i], workflow_id: e.target.value };
                                  patch("tools", updated);
                                }}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 bg-white"
                              >
                                <option value="">Select a workflow…</option>
                                {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                            Description <span className="font-normal text-gray-400">(tells the AI when to use this tool)</span>
                          </label>
                          <input
                            value={tool.description}
                            onChange={e => {
                              const updated = [...(draft.tools ?? [])];
                              updated[i] = { ...updated[i], description: e.target.value };
                              patch("tools", updated);
                            }}
                            placeholder={
                              tool.type === "query_table" ? "Use this to look up customer info by email or phone number" :
                              tool.type === "insert_row" ? "Use this to save the caller's name and request" :
                              "Use this to send a follow-up email after the call"
                            }
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Webhook URLs */}
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Twilio webhook URLs</h3>
                <p className="text-xs text-gray-400 mb-4">Set these in your Twilio phone number settings.</p>
                <div className="space-y-3">
                  {[
                    { label: "Voice webhook (A call comes in)", url: webhookUrl },
                    { label: "Status callback (Call status updates)", url: statusUrl },
                  ].map(({ label, url }) => (
                    <div key={url}>
                      <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                        <span className="text-xs font-mono text-gray-600 flex-1 truncate">{url}</span>
                        <button onClick={() => copyUrl(url)}
                          className="p-1 text-gray-400 hover:text-violet-600 flex-shrink-0 transition-colors">
                          {copiedUrl ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          )}

          {tab === "calls" && (
            <div className="max-w-3xl mx-auto px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800">
                  {callsTotal > 0 ? `${callsTotal} call${callsTotal !== 1 ? "s" : ""}` : "No calls yet"}
                </h3>
                <button onClick={loadCalls} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                  <RefreshCw size={13} />
                </button>
              </div>

              {callsLoading ? (
                <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
              ) : calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                  <PhoneOff size={32} className="text-gray-200 mb-3" />
                  <p className="text-sm font-medium">No calls yet</p>
                  <p className="text-xs text-gray-300 mt-1">Calls will appear here once someone dials your number</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {calls.map(call => <CallRow key={call.id} call={call} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
