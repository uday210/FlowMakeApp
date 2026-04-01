"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plug, Plus, Trash2, Copy, CheckCheck, Search, Loader2, X,
  ExternalLink, Key, RefreshCw, Server, Wrench, ChevronDown,
  ChevronUp, ToggleLeft, ToggleRight, Link2, AlertCircle,
  CheckCircle2, Settings, Zap, ShieldCheck, ShieldOff, Eye, EyeOff, RotateCcw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface McpServer {
  id: string;
  name: string;
  description?: string;
  type: "external" | "hosted";
  url?: string;
  auth_key?: string;
  slug?: string;
  status: "unknown" | "connected" | "error" | "active";
  transport: "sse" | "http";
  enabled: boolean;
  tools_cache?: ExternalTool[];
  last_discovered_at?: string;
  created_at: string;
}

interface ExternalTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface McpTool {
  id: string;
  server_id: string;
  name: string;
  display_name?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  workflow_id?: string;
  enabled: boolean;
  created_at: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface InputParam {
  key: string;
  type: string;
  description: string;
  required: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: McpServer["status"] }) {
  if (status === "connected" || status === "active")
    return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />;
  if (status === "error")
    return <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />;
}

function buildInputSchema(params: InputParam[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    if (!p.key.trim()) continue;
    properties[p.key] = { type: p.type, description: p.description };
    if (p.required) required.push(p.key);
  }
  return { type: "object", properties, required };
}

// ── Create Server Modal ───────────────────────────────────────────────────────

function CreateServerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: McpServer) => void;
}) {
  const [tab, setTab] = useState<"external" | "hosted">("hosted");
  const [form, setForm] = useState({
    name: "", url: "", auth_key: "", description: "", slug: "", transport: "sse",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.name) { setError("Name is required"); return; }
    if (tab === "external" && !form.url) { setError("Server URL is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/mcp-toolboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, type: tab }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to create"); return; }
    onCreated(data as McpServer);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">New MCP Server</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(["hosted", "external"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                tab === t ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t === "hosted" ? "Build My Own Server" : "Connect External Server"}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 space-y-3">
          {tab === "hosted" && (
            <p className="text-[11px] text-violet-600 bg-violet-50 rounded-lg px-3 py-2">
              Create your own MCP server. Add scenarios as tools — external AI tools like Cline can call them.
            </p>
          )}
          {tab === "external" && (
            <p className="text-[11px] text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              Connect to an existing MCP server. We&apos;ll discover its tools automatically.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tab === "hosted" ? "CRM Automations" : "Brave Search"}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
            </div>

            {tab === "external" ? (
              <>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Server URL *</label>
                  <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://mcp.example.com/sse"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Auth Key (optional)</label>
                  <input type="password" value={form.auth_key} onChange={(e) => setForm({ ...form, auth_key: e.target.value })}
                    placeholder="Bearer token"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Endpoint Slug</label>
                  <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    placeholder="auto-generated"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Transport</label>
                  <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 bg-white">
                    <option value="sse">SSE</option>
                    <option value="http">Streamable HTTP</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this server do?"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {tab === "hosted" ? "Create Server" : "Connect Server"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Tool Panel ────────────────────────────────────────────────────────────

function AddToolPanel({
  serverId,
  workflows,
  onClose,
  onAdded,
}: {
  serverId: string;
  workflows: Workflow[];
  onClose: () => void;
  onAdded: (t: McpTool) => void;
}) {
  const [form, setForm] = useState({
    name: "", display_name: "", description: "", workflow_id: "",
  });
  const [params, setParams] = useState<InputParam[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addParam = () => setParams([...params, { key: "", type: "string", description: "", required: false }]);
  const updateParam = (i: number, patch: Partial<InputParam>) =>
    setParams(params.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const removeParam = (i: number) => setParams(params.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.name) { setError("Tool name required"); return; }
    if (!form.workflow_id) { setError("Select a scenario"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/mcp-toolboxes/${serverId}/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        display_name: form.display_name || form.name,
        description: form.description,
        workflow_id: form.workflow_id,
        input_schema: buildInputSchema(params),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    onAdded(data as McpTool);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">Add Tool to Server</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tool Name * <span className="text-gray-400">(machine-readable)</span></label>
              <input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                placeholder="create_invoice"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Display Name</label>
              <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Create Invoice"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Creates a new invoice for a customer"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Linked Scenario *</label>
              <select value={form.workflow_id} onChange={(e) => setForm({ ...form, workflow_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 bg-white">
                <option value="">Select a scenario…</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}{!w.is_active ? " (inactive)" : ""}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">When this tool is called, the linked scenario executes with the tool arguments as trigger data.</p>
            </div>
          </div>

          {/* Input Parameters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Input Parameters</label>
              <button onClick={addParam}
                className="text-[11px] text-violet-600 hover:text-violet-700 flex items-center gap-1">
                <Plus size={11} /> Add parameter
              </button>
            </div>
            {params.length === 0 && (
              <p className="text-[11px] text-gray-400 py-2">No parameters defined — scenario will receive an empty object.</p>
            )}
            <div className="space-y-2">
              {params.map((p, i) => (
                <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2">
                  <input value={p.key} onChange={(e) => updateParam(i, { key: e.target.value })}
                    placeholder="param_name" className="w-28 px-2 py-1.5 text-xs border border-gray-200 rounded font-mono focus:outline-none focus:border-violet-400" />
                  <select value={p.type} onChange={(e) => updateParam(i, { type: e.target.value })}
                    className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-violet-400">
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="array">array</option>
                    <option value="object">object</option>
                  </select>
                  <input value={p.description} onChange={(e) => updateParam(i, { description: e.target.value })}
                    placeholder="Description" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-violet-400" />
                  <label className="flex items-center gap-1 text-[11px] text-gray-500 mt-1.5 flex-shrink-0">
                    <input type="checkbox" checked={p.required} onChange={(e) => updateParam(i, { required: e.target.checked })} className="rounded" />
                    req
                  </label>
                  <button onClick={() => removeParam(i)} className="text-gray-300 hover:text-red-400 mt-1 flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 pb-5 sticky bottom-0 bg-white pt-2 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />} Add Tool
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Server Card ───────────────────────────────────────────────────────────────

function ServerCard({
  server,
  workflows,
  onUpdate,
  onDelete,
}: {
  server: McpServer;
  workflows: Workflow[];
  onUpdate: (s: McpServer) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAddTool, setShowAddTool] = useState(false);
  const [togglingTool, setTogglingTool] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const loadTools = useCallback(async () => {
    if (server.type !== "hosted") return;
    setLoadingTools(true);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}/tools`);
    const data = await res.json();
    setTools(Array.isArray(data) ? data : []);
    setLoadingTools(false);
  }, [server.id, server.type]);

  useEffect(() => {
    if (expanded && server.type === "hosted") loadTools();
  }, [expanded, loadTools, server.type]);

  const discover = async () => {
    setDiscovering(true);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}/discover`, { method: "POST" });
    const data = await res.json();
    setDiscovering(false);
    onUpdate({ ...server, status: data.status, tools_cache: data.tools, last_discovered_at: new Date().toISOString() });
  };

  const toggleServer = async () => {
    const res = await fetch(`/api/mcp-toolboxes/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !server.enabled }),
    });
    const data = await res.json();
    onUpdate(data as McpServer);
  };

  const toggleTool = async (tool: McpTool) => {
    setTogglingTool(tool.id);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}/tools/${tool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !tool.enabled }),
    });
    const data = await res.json();
    setTools((prev) => prev.map((t) => t.id === tool.id ? data : t));
    setTogglingTool(null);
  };

  const generateKey = async () => {
    setSavingKey(true);
    const key = "mcp_" + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const res = await fetch(`/api/mcp-toolboxes/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_key: key }),
    });
    const data = await res.json();
    setSavingKey(false);
    setShowKey(true);
    onUpdate(data as McpServer);
  };

  const removeKey = async () => {
    if (!confirm("Remove the API key? The server will become publicly accessible.")) return;
    setSavingKey(true);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_key: null }),
    });
    const data = await res.json();
    setSavingKey(false);
    onUpdate(data as McpServer);
  };

  const deleteTool = async (toolId: string) => {
    if (!confirm("Remove this tool?")) return;
    await fetch(`/api/mcp-toolboxes/${server.id}/tools/${toolId}`, { method: "DELETE" });
    setTools((prev) => prev.filter((t) => t.id !== toolId));
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const isHosted = server.type === "hosted";
  const externalTools: ExternalTool[] = server.tools_cache ?? [];

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sseUrl = `${origin}/api/mcp/hosted/${server.slug}/sse`;
  const httpUrl = `${origin}/api/mcp/hosted/${server.slug}`;

  const workflowName = (id?: string) => workflows.find((w) => w.id === id)?.name ?? "Unknown";

  return (
    <>
      <div className={`bg-white border rounded-xl transition-all ${server.enabled ? "border-gray-200 hover:border-violet-200" : "border-gray-100 opacity-60"}`}>
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isHosted ? "bg-violet-100" : "bg-blue-50"}`}>
                {isHosted ? <Server size={16} className="text-violet-600" /> : <Plug size={16} className="text-blue-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={server.status} />
                  <span className="text-sm font-semibold text-gray-800 truncate">{server.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isHosted ? "bg-violet-100 text-violet-700" : "bg-blue-50 text-blue-600"}`}>
                    {isHosted ? "hosted" : "external"}
                  </span>
                </div>
                {server.description && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{server.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {/* Enable/disable toggle */}
              <button onClick={toggleServer} title={server.enabled ? "Disable" : "Enable"}
                className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                {server.enabled ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
              </button>
              {/* Expand/collapse */}
              <button onClick={() => setExpanded((e) => !e)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {/* Delete */}
              <button onClick={() => onDelete(server.id)}
                className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Endpoint URLs for hosted servers */}
          {isHosted && server.slug && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <Zap size={10} className="text-violet-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-500 flex-shrink-0">SSE</span>
                <span className="text-[11px] font-mono text-gray-600 truncate flex-1">{sseUrl}</span>
                <button onClick={() => copy(sseUrl, "sse-" + server.id)} className="text-gray-400 hover:text-violet-600 flex-shrink-0">
                  {copied === "sse-" + server.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <ExternalLink size={10} className="text-blue-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-500 flex-shrink-0">HTTP</span>
                <span className="text-[11px] font-mono text-gray-600 truncate flex-1">{httpUrl}</span>
                <button onClick={() => copy(httpUrl, "http-" + server.id)} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                  {copied === "http-" + server.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          )}

          {/* External server URL */}
          {!isHosted && server.url && (
            <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <ExternalLink size={10} className="text-gray-400 flex-shrink-0" />
              <span className="text-[11px] font-mono text-gray-600 truncate flex-1">{server.url}</span>
              <button onClick={() => copy(server.url!, "url-" + server.id)} className="text-gray-400 hover:text-violet-600 flex-shrink-0">
                {copied === "url-" + server.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
              </button>
            </div>
          )}

          {/* Auth key section (hosted servers only) */}
          {isHosted && (
            <div className="mt-2">
              {server.auth_key ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={11} className="text-green-600" />
                      <span className="text-[11px] font-medium text-green-700">Auth key enabled</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowKey((v) => !v)} className="p-1 text-green-600 hover:text-green-700" title={showKey ? "Hide key" : "Show key"}>
                        {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <button onClick={() => copy(server.auth_key!, "authkey-" + server.id)} className="p-1 text-green-600 hover:text-green-700" title="Copy key">
                        {copied === "authkey-" + server.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                      </button>
                      <button onClick={generateKey} disabled={savingKey} className="p-1 text-green-600 hover:text-green-700" title="Regenerate key">
                        {savingKey ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                      </button>
                      <button onClick={removeKey} disabled={savingKey} className="p-1 text-red-400 hover:text-red-500" title="Remove key">
                        <ShieldOff size={11} />
                      </button>
                    </div>
                  </div>
                  {showKey && (
                    <code className="text-[10px] font-mono text-green-800 bg-green-100 px-2 py-1 rounded block truncate">
                      {server.auth_key}
                    </code>
                  )}
                  <p className="text-[10px] text-green-600 mt-1">Add as <code className="bg-green-100 px-1 rounded">Authorization: Bearer &lt;key&gt;</code> header</p>
                </div>
              ) : (
                <button onClick={generateKey} disabled={savingKey}
                  className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg border border-dashed border-gray-200 hover:border-violet-200 transition-colors w-full justify-center">
                  {savingKey ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                  Add API key authentication
                </button>
              )}
            </div>
          )}
          {/* External server auth badge */}
          {!isHosted && server.auth_key && (
            <div className="mt-1.5 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-1.5">
              <Key size={10} className="text-amber-500 flex-shrink-0" />
              <span className="text-[11px] text-amber-700">Auth key configured</span>
            </div>
          )}

          {/* Footer: tool count + actions */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {isHosted
                ? `${tools.length > 0 ? tools.length : "No"} tool${tools.length !== 1 ? "s" : ""}`
                : externalTools.length > 0
                  ? `${externalTools.length} tool${externalTools.length !== 1 ? "s" : ""} discovered`
                  : "Not discovered yet"}
            </span>
            <div className="flex items-center gap-1">
              {!isHosted && (
                <button onClick={discover} disabled={discovering}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
                  {discovering ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {discovering ? "Connecting…" : "Discover Tools"}
                </button>
              )}
              {isHosted && (
                <button onClick={() => setShowAddTool(true)}
                  className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-700 px-2 py-1 hover:bg-violet-50 rounded-lg transition-colors">
                  <Plus size={11} /> Add Tool
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded tools panel */}
        {expanded && (
          <div className="border-t border-gray-100 px-4 pb-4">
            {isHosted ? (
              <>
                {loadingTools ? (
                  <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
                ) : tools.length === 0 ? (
                  <div className="py-6 text-center">
                    <Wrench size={20} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-400">No tools yet. Add a scenario as a tool.</p>
                    <button onClick={() => setShowAddTool(true)}
                      className="mt-2 text-[11px] text-violet-600 hover:text-violet-700 flex items-center gap-1 mx-auto">
                      <Plus size={11} /> Add first tool
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {tools.map((tool) => (
                      <div key={tool.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${tool.enabled ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-50"}`}>
                        <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Wrench size={12} className="text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-800 font-mono">{tool.name}</span>
                            {!tool.enabled && <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 rounded">disabled</span>}
                          </div>
                          {tool.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{tool.description}</p>}
                          <div className="flex items-center gap-1 mt-1">
                            <Link2 size={10} className="text-violet-400" />
                            <span className="text-[10px] text-violet-600">{tool.workflow_id ? workflowName(tool.workflow_id) : "No scenario linked"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => toggleTool(tool)} disabled={togglingTool === tool.id}
                            className="p-1 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded transition-colors" title={tool.enabled ? "Disable" : "Enable"}>
                            {togglingTool === tool.id ? <Loader2 size={12} className="animate-spin" /> : tool.enabled ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                          </button>
                          <button onClick={() => deleteTool(tool.id)}
                            className="p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowAddTool(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-violet-600 hover:bg-violet-50 rounded-lg border border-dashed border-violet-200 transition-colors">
                      <Plus size={11} /> Add another tool
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* External server discovered tools */
              <div className="mt-3 space-y-2">
                {externalTools.length === 0 ? (
                  <div className="py-4 text-center">
                    <AlertCircle size={16} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-400">Click &quot;Discover Tools&quot; to load available tools.</p>
                  </div>
                ) : externalTools.map((tool, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Settings size={12} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-gray-800 font-mono">{tool.name}</span>
                      {tool.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{tool.description}</p>}
                    </div>
                    <CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                  </div>
                ))}
                {server.last_discovered_at && (
                  <p className="text-[10px] text-gray-400 text-right">Last discovered {new Date(server.last_discovered_at).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddTool && (
        <AddToolPanel
          serverId={server.id}
          workflows={workflows}
          onClose={() => setShowAddTool(false)}
          onAdded={(t) => {
            setTools((prev) => [...prev, t]);
            setShowAddTool(false);
            setExpanded(true);
          }}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MCPToolboxesPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "hosted" | "external">("all");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/mcp-toolboxes").then((r) => r.json()),
      fetch("/api/workflows").then((r) => r.json()),
    ]).then(([tb, wf]) => {
      setServers(Array.isArray(tb) ? tb : []);
      setWorkflows(Array.isArray(wf) ? wf : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this MCP server?")) return;
    await fetch(`/api/mcp-toolboxes/${id}`, { method: "DELETE" });
    setServers((s) => s.filter((x) => x.id !== id));
  };

  const filtered = servers.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || s.type === filter;
    return matchSearch && matchFilter;
  });

  const hosted = filtered.filter((s) => s.type === "hosted");
  const external = filtered.filter((s) => s.type === "external");

  return (
    <>
      <AppShell>
        <PageHeader
          title="MCP Toolbox"
          subtitle="Build your own MCP servers with scenarios as tools, or connect external MCP servers"
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              <Plus size={14} /> New Server
            </button>
          }
        />

        <main className="flex-1 overflow-auto px-8 py-6">
          {/* Search + filter bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative max-w-sm flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search servers…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["all", "hosted", "external"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === f ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {f === "all" ? "All" : f === "hosted" ? "My Servers" : "External"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-violet-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Server size={24} className="text-violet-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">
                {search ? `No servers match "${search}"` : "No MCP servers yet"}
              </h2>
              <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
                Build your own MCP server with scenarios as tools, or connect an external MCP server
              </p>
              <button onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                Create first server
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Hosted servers section */}
              {(filter === "all" || filter === "hosted") && hosted.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Server size={14} className="text-violet-600" />
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">My MCP Servers</h3>
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{hosted.length}</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {hosted.map((s) => (
                      <ServerCard key={s.id} server={s} workflows={workflows}
                        onUpdate={(u) => setServers((prev) => prev.map((x) => x.id === u.id ? u : x))}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              )}

              {/* External servers section */}
              {(filter === "all" || filter === "external") && external.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Plug size={14} className="text-blue-500" />
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">External Servers</h3>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{external.length}</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {external.map((s) => (
                      <ServerCard key={s.id} server={s} workflows={workflows}
                        onUpdate={(u) => setServers((prev) => prev.map((x) => x.id === u.id ? u : x))}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </AppShell>

      {showCreate && (
        <CreateServerModal
          onClose={() => setShowCreate(false)}
          onCreated={(s) => {
            setServers((prev) => [s, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}
