"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plug, Plus, Trash2, Copy, CheckCheck, Search, Loader2, X,
  ExternalLink, Key, RefreshCw, Server, Wrench, ChevronDown,
  ChevronUp, ToggleLeft, ToggleRight, Link2, AlertCircle,
  CheckCircle2, Settings, Zap, ShieldCheck, ShieldOff, Eye, EyeOff, RotateCcw,
  History, Clock, XCircle, ChevronRight,
  BarChart2, Bell, Code2, Download, Play, Pencil, FlaskConical,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface McpServer {
  id: string;
  name: string;
  description?: string;
  type: "external" | "hosted";
  url?: string;
  auth_key?: string;
  auth_header_name?: string;
  slug?: string;
  status: "unknown" | "connected" | "error" | "active";
  transport: "sse" | "http" | "both";
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

interface ToolExecution {
  id: string;
  tool_name: string;
  input_data: Record<string, unknown>;
  output_text: string | null;
  status: "success" | "error";
  error_message: string | null;
  duration_ms: number | null;
  transport: string | null;
  created_at: string;
}

interface InputParam {
  key: string;
  type: string;
  description: string;
  required: boolean;
}

// Analytics types
interface AnalyticsData {
  total_calls: number;
  error_rate: number;
  avg_duration_ms: number;
  calls_by_tool: Record<string, number>;
  calls_by_day: { date: string; calls: number }[];
}

// Alerts types
interface McpAlert {
  id: string;
  error_threshold: number;
  window_minutes: number;
  slack_webhook?: string;
  email?: string;
  enabled: boolean;
  created_at: string;
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status, enabled }: { status: McpServer["status"]; enabled: boolean }) {
  if (!enabled) return <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />;
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


// ── SDK Modal ─────────────────────────────────────────────────────────────────

function SdkModal({ server, onClose }: { server: McpServer; onClose: () => void }) {
  const transport = server.transport; // "sse" | "http" | "both"
  const defaultTransport = transport === "http" ? "http" : "sse";
  const [mode, setMode] = useState<"code" | "config">("code");
  const [lang, setLang] = useState<"python" | "javascript">("javascript");
  const [activeTransport, setActiveTransport] = useState<"sse" | "http">(defaultTransport);
  const [configClient, setConfigClient] = useState<"cline" | "claude">("cline");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://yourapp.com";
  const slug = server.slug ?? "your-server-slug";
  const httpUrl = `${origin}/api/mcp/hosted/${slug}`;
  const sseUrl  = `${origin}/api/mcp/hosted/${slug}/sse`;
  const hasAuth = !!server.auth_key;
  const apiKey  = server.auth_key ?? "YOUR_API_KEY";

  // ── JavaScript (Node.js) snippets ──────────────────────────────────────────
  const jsAuthLine = hasAuth
    ? `\n  headers: { Authorization: "Bearer YOUR_API_KEY" },`
    : "";

  const jsSse = `// Run in Node.js — not browser code
// npm install @modelcontextprotocol/sdk

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("${sseUrl}"),
  {${jsAuthLine}
  }
);

const client = new Client({ name: "my-client", version: "1.0.0" });
await client.connect(transport);

// List available tools
const { tools } = await client.listTools();
console.log(tools.map(t => t.name));

// Call a tool
const result = await client.callTool({
  name: "your_tool_name",
  arguments: { param1: "value1" },
});
console.log(result);`;

  const jsHttp = `// Run in Node.js — not browser code
// npm install @modelcontextprotocol/sdk

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("${httpUrl}"),
  {${jsAuthLine}
  }
);

const client = new Client({ name: "my-client", version: "1.0.0" });
await client.connect(transport);

// List available tools
const { tools } = await client.listTools();
console.log(tools.map(t => t.name));

// Call a tool
const result = await client.callTool({
  name: "your_tool_name",
  arguments: { param1: "value1" },
});
console.log(result);`;

  // ── Python snippets ────────────────────────────────────────────────────────
  const pyAuthKw = hasAuth
    ? `,\n        headers={"Authorization": "Bearer YOUR_API_KEY"}`
    : "";

  const pySse = `# pip install mcp
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    async with sse_client(
        "${sseUrl}"${pyAuthKw}
    ) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List available tools
            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            # Call a tool
            result = await session.call_tool(
                "your_tool_name",
                {"param1": "value1"}
            )
            print(result)

# Google Colab / Jupyter: run this cell as-is (event loop already running)
await main()

# Standard Python script: replace the line above with:
# asyncio.run(main())`;

  const pyHttp = `# pip install mcp
import asyncio
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client(
        "${httpUrl}"${pyAuthKw}
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List available tools
            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            # Call a tool
            result = await session.call_tool(
                "your_tool_name",
                {"param1": "value1"}
            )
            print(result)

# Google Colab / Jupyter: run this cell as-is (event loop already running)
await main()

# Standard Python script: replace the line above with:
# asyncio.run(main())`;

  const snippet = lang === "javascript"
    ? (activeTransport === "sse" ? jsSse : jsHttp)
    : (activeTransport === "sse" ? pySse : pyHttp);

  // ── Config JSON snippets ───────────────────────────────────────────────────
  const toolNames = (server.tools_cache ?? []).map(t => t.name);

  const clineConfig = (tr: "sse" | "http") => {
    const url = tr === "sse" ? sseUrl : httpUrl;
    const obj: Record<string, unknown> = {
      type: tr === "sse" ? "sse" : "streamable-http",
      url,
      ...(hasAuth ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
      disabled: false,
      timeout: 60,
      ...(toolNames.length > 0 ? { autoApprove: toolNames } : {}),
    };
    return JSON.stringify({ [slug]: obj }, null, 2);
  };

  const claudeConfig = (tr: "sse" | "http") => {
    const url = tr === "sse" ? sseUrl : httpUrl;
    const inner: Record<string, unknown> = {
      url,
      ...(hasAuth ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
    };
    return JSON.stringify({ mcpServers: { [slug]: inner } }, null, 2);
  };

  const configSnippet = configClient === "cline"
    ? clineConfig(activeTransport)
    : claudeConfig(activeTransport);

  const activeSnippet = mode === "code" ? snippet : configSnippet;

  const copy = async () => {
    await navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-800">Connect — {server.name}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>

        {/* Mode tabs: Code | Config */}
        <div className="px-6 pt-4 pb-0 flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(["code", "config"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === m ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {m === "code" ? "SDK Code" : "Client Config"}
              </button>
            ))}
          </div>

          {/* Transport selector (when both available) */}
          {transport === "both" && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["sse", "http"] as const).map((tr) => (
                <button key={tr} onClick={() => setActiveTransport(tr)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTransport === tr ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {tr === "sse" ? "SSE" : "HTTP"}
                  {tr === "http" && <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${activeTransport === tr ? "bg-white/20 text-white" : "bg-green-100 text-green-600"}`}>recommended</span>}
                </button>
              ))}
            </div>
          )}

          {/* Language (code mode) / Client (config mode) */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
            {mode === "code" ? (
              (["javascript", "python"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${lang === l ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {l === "javascript" ? "JS" : "Python"}
                </button>
              ))
            ) : (
              (["cline", "claude"] as const).map((c) => (
                <button key={c} onClick={() => setConfigClient(c)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${configClient === c ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {c === "cline" ? "Cline / VS Code" : "Claude Desktop"}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Contextual callout */}
        <div className="mx-6 mt-3 space-y-2">
          {activeTransport === "sse" && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>SSE requires a persistent connection.</strong> It may drop on serverless or multi-instance deployments. <button onClick={() => setActiveTransport("http")} className="underline font-semibold hover:text-amber-900">Switch to HTTP</button> — it&apos;s stateless, more reliable, and what the MCP spec recommends going forward.
              </p>
            </div>
          )}
          {mode === "code" && lang === "javascript" && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">Runs in <strong>Node.js</strong> — not the browser.</p>
            </div>
          )}
          {mode === "config" && configClient === "cline" && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-600">Paste inside the <code className="bg-blue-100 px-1 rounded font-mono">mcpServers</code> object in your Cline MCP settings JSON.</p>
            </div>
          )}
          {mode === "config" && configClient === "claude" && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-purple-400 flex-shrink-0" />
              <p className="text-xs text-purple-600">Paste into <code className="bg-purple-100 px-1 rounded font-mono">claude_desktop_config.json</code> (merging with any existing <code className="bg-purple-100 px-1 rounded font-mono">mcpServers</code>).</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="relative mt-3">
            <pre className="text-xs font-mono bg-gray-950 text-gray-100 rounded-xl p-4 overflow-x-auto whitespace-pre leading-relaxed">
              {activeSnippet}
            </pre>
            <button onClick={copy}
              className="absolute top-3 right-3 flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-lg transition-colors">
              {copied ? <CheckCheck size={10} className="text-green-400" /> : <Copy size={10} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="mt-3 bg-violet-50 rounded-lg px-3 py-2 space-y-1">
            <p className="text-xs text-violet-700"><strong>SSE:</strong>{" "}
              <code className="bg-violet-100 px-1 rounded font-mono text-[10px]">{sseUrl}</code>
            </p>
            <p className="text-xs text-violet-700"><strong>HTTP:</strong>{" "}
              <code className="bg-violet-100 px-1 rounded font-mono text-[10px]">{httpUrl}</code>
            </p>
            {hasAuth ? (
              <p className="text-xs text-violet-600">Auth key shown above is your actual key — keep it secret.</p>
            ) : (
              <p className="text-xs text-gray-400">No auth key — server is public. Add one in settings for security.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OpenAPI Importer Modal ────────────────────────────────────────────────────

function OpenApiImporterModal({
  serverId,
  onClose,
  onImported,
}: {
  serverId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [spec, setSpec] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ tools: string[] } | null>(null);
  const [error, setError] = useState("");

  const doImport = async () => {
    if (!spec.trim()) { setError("Paste an OpenAPI/Swagger JSON spec first"); return; }
    setImporting(true); setError(""); setResult(null);
    try {
      const res = await fetch(`/api/mcp-toolboxes/${serverId}/import-openapi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Import failed"); setImporting(false); return; }
      setResult({ tools: data.tools ?? [] });
      setImporting(false);
    } catch {
      setError("Network error");
      setImporting(false);
    }
  };

  const handleDone = () => {
    if (result) onImported();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-800">Import from OpenAPI</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle2 size={14} />
                <span className="text-sm font-medium">Imported {result.tools.length} tool{result.tools.length !== 1 ? "s" : ""}</span>
              </div>
              {result.tools.length > 0 && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 font-mono">
                  {result.tools.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">OpenAPI / Swagger JSON Spec</label>
                <textarea
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  placeholder={'{\n  "openapi": "3.0.0",\n  "info": { "title": "My API", "version": "1.0.0" },\n  "paths": { ... }\n}'}
                  rows={14}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 resize-none leading-relaxed"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5 border-t border-gray-100 pt-3">
          {result ? (
            <button onClick={handleDone}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors">
              Done
            </button>
          ) : (
            <button onClick={doImport} disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {importing ? "Importing…" : "Import"}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Create Server Modal ───────────────────────────────────────────────────────

function CreateServerModal({
  onClose,
  onCreated,
  initialType = "hosted",
  initialUrl = "",
}: {
  onClose: () => void;
  onCreated: (s: McpServer) => void;
  initialType?: "hosted" | "external";
  initialUrl?: string;
}) {
  const [tab, setTab] = useState<"external" | "hosted">(initialType);
  const [form, setForm] = useState({
    name: "", url: initialUrl, auth_key: "", auth_header_name: "Authorization", description: "", slug: "", transport: "sse",
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
            <p className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2">
              Create your own MCP server. Add scenarios as tools — external AI tools like Cline can call them.
            </p>
          )}
          {tab === "external" && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
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
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Header Name <span className="font-normal text-gray-400">(optional)</span></label>
                  <input value={form.auth_header_name} onChange={(e) => setForm({ ...form, auth_header_name: e.target.value })}
                    placeholder="Authorization"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Header Value <span className="font-normal text-gray-400">(optional)</span></label>
                  <input type="password" value={form.auth_key} onChange={(e) => setForm({ ...form, auth_key: e.target.value })}
                    placeholder="Bearer your-token"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
                </div>
                <p className="col-span-2 text-[11px] text-gray-400">Paste the full value as-is, e.g. <span className="font-mono">Bearer abc123</span></p>
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

// ── Edit Server Modal ─────────────────────────────────────────────────────────

function EditServerModal({
  server,
  onClose,
  onUpdated,
}: {
  server: McpServer;
  onClose: () => void;
  onUpdated: (s: McpServer) => void;
}) {
  const isHosted = server.type === "hosted";
  const [form, setForm] = useState({
    name: server.name ?? "",
    description: server.description ?? "",
    url: server.url ?? "",
    auth_key: server.auth_key ?? "",
    auth_header_name: server.auth_header_name ?? "Authorization",
    slug: server.slug ?? "",
    transport: server.transport ?? "sse",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.name) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description,
    };
    if (!isHosted) {
      body.url = form.url;
      if (form.auth_key) body.auth_key = form.auth_key;
      body.auth_header_name = form.auth_header_name || "Authorization";
    } else {
      body.slug = form.slug;
      body.transport = form.transport;
    }
    const res = await fetch(`/api/mcp-toolboxes/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to update"); return; }
    onUpdated(data as McpServer);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Edit Server</h2>
            <p className="text-xs text-gray-400 mt-0.5">{isHosted ? "Hosted" : "External"} · {server.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this server do?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
          </div>

          {!isHosted && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Server URL *</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://mcp.example.com/sse"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Header Name</label>
                  <input value={form.auth_header_name} onChange={(e) => setForm({ ...form, auth_header_name: e.target.value })}
                    placeholder="Authorization"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Header Value</label>
                  <input type="password" value={form.auth_key} onChange={(e) => setForm({ ...form, auth_key: e.target.value })}
                    placeholder="Bearer your-token"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">Paste the full value as-is, e.g. <span className="font-mono">Bearer abc123</span></p>
            </>
          )}

          {isHosted && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Slug</label>
                <input value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Transport</label>
                <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as "sse" | "http" })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 bg-white">
                  <option value="sse">SSE</option>
                  <option value="http">Streamable HTTP</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Settings size={13} />}
            Save Changes
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
                <option value="">Select an active scenario…</option>
                {workflows.filter((w) => w.is_active).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {workflows.filter((w) => w.is_active).length === 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> No active scenarios found. Activate a scenario first, then link it here.
                </p>
              )}
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs text-blue-700 font-medium">How scenarios work as MCP tools</p>
                <p className="text-xs text-blue-600">When an AI calls this tool, your scenario runs directly — no webhook needed. The tool arguments are passed as the trigger input, and the last node&apos;s output is returned to the AI.</p>
                <p className="text-xs text-blue-500">Tip: use an HTTP Request, AI, or any action node — no trigger node required. Just make sure the scenario is <strong>active</strong>.</p>
              </div>
            </div>
          </div>

          {/* Input Parameters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Input Parameters</label>
              <button onClick={addParam}
                className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                <Plus size={11} /> Add parameter
              </button>
            </div>
            {params.length === 0 && (
              <p className="text-xs text-gray-400 py-2">No parameters defined — scenario will receive an empty object.</p>
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
                  <label className="flex items-center gap-1 text-xs text-gray-500 mt-1.5 flex-shrink-0">
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

// ── Execution Row ─────────────────────────────────────────────────────────────

function ExecutionRow({ exec }: { exec: ToolExecution }) {
  const [open, setOpen] = useState(false);
  const isSuccess = exec.status === "success";

  return (
    <div className={`rounded-xl border text-xs transition-colors ${isSuccess ? "border-gray-100 bg-gray-50" : "border-red-100 bg-red-50"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        {isSuccess
          ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
          : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
        <span className="font-mono font-semibold text-gray-800 flex-shrink-0">{exec.tool_name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${isSuccess ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
          {exec.status}
        </span>
        {exec.transport && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 flex-shrink-0">{exec.transport}</span>
        )}
        <span className="flex items-center gap-1 text-gray-400 flex-shrink-0">
          <Clock size={10} />{exec.duration_ms != null ? `${exec.duration_ms}ms` : "—"}
        </span>
        <span className="text-gray-400 flex-1 text-right truncate">
          {new Date(exec.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </span>
        <ChevronRight size={12} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 pb-3 space-y-2 pt-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Input</p>
            <pre className="text-xs bg-white border border-gray-100 rounded-lg p-2 overflow-x-auto text-gray-700 max-h-32">
              {JSON.stringify(exec.input_data, null, 2)}
            </pre>
          </div>
          {isSuccess && exec.output_text && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Output</p>
              <pre className="text-xs bg-white border border-gray-100 rounded-lg p-2 overflow-x-auto text-gray-700 max-h-40 whitespace-pre-wrap">
                {exec.output_text}
              </pre>
            </div>
          )}
          {!isSuccess && exec.error_message && (
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Error</p>
              <pre className="text-xs bg-white border border-red-100 rounded-lg p-2 overflow-x-auto text-red-600 max-h-32 whitespace-pre-wrap">
                {exec.error_message}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab Content ─────────────────────────────────────────────────────

function AnalyticsTabContent({ serverId }: { serverId: string }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async (d: number) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/mcp-toolboxes/${serverId}/analytics?days=${d}`);
      if (!res.ok) { setError("Failed to load analytics"); setLoading(false); return; }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }, [serverId]);

  useEffect(() => { fetchAnalytics(days); }, [fetchAnalytics, days]);

  const maxToolCalls = data ? Math.max(...Object.values(data.calls_by_tool), 1) : 1;
  const maxDayCalls = data ? Math.max(...data.calls_by_day.map((d) => d.calls), 1) : 1;

  return (
    <div className="mt-3 space-y-4">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">Call Analytics</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${days === d ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
      ) : error ? (
        <div className="py-6 text-center">
          <AlertCircle size={16} className="text-red-300 mx-auto mb-2" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-violet-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Total Calls</p>
              <p className="text-lg font-bold text-violet-700 mt-0.5">{data.total_calls.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xs text-red-400 font-medium uppercase tracking-wide">Error Rate</p>
              <p className="text-lg font-bold text-red-500 mt-0.5">{(data.error_rate * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-indigo-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xs text-indigo-400 font-medium uppercase tracking-wide">Avg Duration</p>
              <p className="text-lg font-bold text-indigo-600 mt-0.5">{Math.round(data.avg_duration_ms)}ms</p>
            </div>
          </div>

          {/* Calls by Tool */}
          {Object.keys(data.calls_by_tool).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Calls by Tool</p>
              <div className="space-y-1.5">
                {Object.entries(data.calls_by_tool)
                  .sort(([, a], [, b]) => b - a)
                  .map(([toolName, count]) => (
                    <div key={toolName} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-600 w-28 flex-shrink-0 truncate">{toolName}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-violet-400 rounded-full h-2 transition-all"
                          style={{ width: `${Math.max(2, (count / maxToolCalls) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Last N days trend */}
          {data.calls_by_day.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Last {days} Days Trend</p>
              <div className="space-y-1.5">
                {data.calls_by_day.map((entry) => (
                  <div key={entry.date} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                      {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-400 rounded-full h-2 transition-all"
                        style={{ width: `${Math.max(entry.calls > 0 ? 2 : 0, (entry.calls / maxDayCalls) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{entry.calls}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ── Alerts Tab Content ────────────────────────────────────────────────────────

function AlertsTabContent({ serverId }: { serverId: string }) {
  const [alerts, setAlerts] = useState<McpAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    error_threshold_pct: 10,
    window_minutes: 15,
    slack_webhook: "",
    email: "",
    enabled: true,
  });

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/mcp-toolboxes/${serverId}/alerts`);
    const data = await res.json();
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [serverId]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const saveAlert = async () => {
    if (!form.slack_webhook && !form.email) {
      setError("Provide at least a Slack webhook URL or email address");
      return;
    }
    setSaving(true); setError("");
    const res = await fetch(`/api/mcp-toolboxes/${serverId}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_threshold: form.error_threshold_pct / 100,
        window_minutes: form.window_minutes,
        slack_webhook: form.slack_webhook || undefined,
        email: form.email || undefined,
        enabled: form.enabled,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    setAlerts((prev) => [...prev, data as McpAlert]);
    setShowForm(false);
    setForm({ error_threshold_pct: 10, window_minutes: 15, slack_webhook: "", email: "", enabled: true });
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm("Delete this alert?")) return;
    setDeletingId(alertId);
    await fetch(`/api/mcp-toolboxes/${serverId}/alerts?alert_id=${alertId}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setDeletingId(null);
  };

  return (
    <div className="mt-3 space-y-3">
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
      ) : (
        <>
          {alerts.length === 0 && !showForm && (
            <div className="py-4 text-center">
              <Bell size={18} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No alerts configured. Add one to get notified on errors.</p>
            </div>
          )}

          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-start justify-between bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Bell size={11} className="text-amber-500" />
                  <span className="text-xs font-medium text-gray-700">
                    Error &gt; {(alert.error_threshold * 100).toFixed(0)}% in {alert.window_minutes}m window
                  </span>
                  {!alert.enabled && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-1.5 rounded">disabled</span>
                  )}
                </div>
                <div className="flex items-center gap-3 pl-4">
                  {alert.slack_webhook && (
                    <span className="text-xs text-gray-500">Slack: configured</span>
                  )}
                  {alert.email && (
                    <span className="text-xs text-gray-500">Email: {alert.email}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteAlert(alert.id)}
                disabled={deletingId === alert.id}
                className="p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-colors flex-shrink-0"
              >
                {deletingId === alert.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          ))}

          {showForm ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-700">New Alert</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Error Threshold %</label>
                  <input
                    type="number" min={1} max={100}
                    value={form.error_threshold_pct}
                    onChange={(e) => setForm({ ...form, error_threshold_pct: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Window (minutes)</label>
                  <select
                    value={form.window_minutes}
                    onChange={(e) => setForm({ ...form, window_minutes: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-400"
                  >
                    <option value={5}>5</option>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Slack Webhook URL</label>
                <input
                  type="text"
                  value={form.slack_webhook}
                  onChange={(e) => setForm({ ...form, slack_webhook: e.target.value })}
                  placeholder="https://hooks.slack.com/services/…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  className="text-gray-400 hover:text-violet-600 transition-colors"
                >
                  {form.enabled ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                </button>
                <span className="text-xs text-gray-600">{form.enabled ? "Enabled" : "Disabled"}</span>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button onClick={saveAlert} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Save Alert
                </button>
                <button onClick={() => { setShowForm(false); setError(""); }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-violet-600 hover:bg-violet-50 rounded-lg border border-dashed border-violet-200 transition-colors"
            >
              <Plus size={11} /> Add Alert
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Tool Playground Modal ─────────────────────────────────────────────────────

interface PlaygroundTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

function ToolPlaygroundModal({
  tool,
  serverId,
  serverType,
  onClose,
}: {
  tool: PlaygroundTool;
  serverId: string;
  serverType: "hosted" | "external";
  onClose: () => void;
}) {
  const schema = tool.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] } | null;
  const properties = schema?.properties ?? {};
  const paramKeys = Object.keys(properties);

  const [args, setArgs] = useState<Record<string, string>>(
    Object.fromEntries(paramKeys.map((k) => [k, ""]))
  );
  const [jsonMode, setJsonMode] = useState(paramKeys.length === 0);
  const [rawJson, setRawJson] = useState("{}");
  const [jsonError, setJsonError] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ output?: string; error?: string; duration_ms?: number } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setJsonError("");
    try {
      let finalArgs: Record<string, unknown> = {};

      if (jsonMode) {
        try { finalArgs = JSON.parse(rawJson); } catch {
          setJsonError("Invalid JSON");
          setRunning(false);
          return;
        }
      } else {
        for (const [k, v] of Object.entries(args)) {
          const t = properties[k]?.type;
          if (t === "number") finalArgs[k] = v === "" ? undefined : Number(v);
          else if (t === "boolean") finalArgs[k] = v === "true";
          else if (v !== "") finalArgs[k] = v;
        }
      }

      const res = await fetch(`/api/mcp-toolboxes/${serverId}/test-tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_name: tool.name, arguments: finalArgs }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error ?? "Request failed" });
      } else {
        const rpc = data.response;
        if (rpc?.result?.content?.[0]?.text != null) {
          setResult({ output: rpc.result.content[0].text, duration_ms: data.duration_ms });
        } else if (rpc?.error) {
          setResult({ error: rpc.error.message, duration_ms: data.duration_ms });
        } else {
          setResult({ output: JSON.stringify(rpc?.result ?? rpc, null, 2), duration_ms: data.duration_ms });
        }
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
    }
    setRunning(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Play size={14} className="text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Tool Playground</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serverType === "hosted" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                  {serverType}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">{tool.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: inputs */}
          <div className="flex-1 px-6 py-4 overflow-y-auto border-r border-gray-100">
            {tool.description && (
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">{tool.description}</p>
            )}

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-700">Input Arguments</p>
              {paramKeys.length > 0 && (
                <button
                  onClick={() => setJsonMode(!jsonMode)}
                  className="text-xs text-violet-600 hover:text-violet-700 px-2 py-0.5 rounded border border-violet-200 hover:bg-violet-50 transition-colors"
                >
                  {jsonMode ? "Form view" : "JSON view"}
                </button>
              )}
            </div>

            {jsonMode ? (
              <div>
                <textarea
                  value={rawJson}
                  onChange={(e) => { setRawJson(e.target.value); setJsonError(""); }}
                  rows={8}
                  placeholder='{"key": "value"}'
                  className={`w-full px-3 py-2.5 text-xs font-mono border rounded-xl focus:outline-none resize-none ${jsonError ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-violet-400"}`}
                />
                {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
              </div>
            ) : paramKeys.length === 0 ? (
              <div className="py-6 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-400">No arguments required</p>
                <p className="text-xs text-gray-300 mt-0.5">This tool runs without any input</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paramKeys.map((k) => {
                  const prop = properties[k];
                  const isRequired = schema?.required?.includes(k);
                  return (
                    <div key={k} className="group">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-gray-700 font-mono">{k}</span>
                        {prop.type && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{prop.type}</span>
                        )}
                        {isRequired && <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-400 font-medium">required</span>}
                      </div>
                      {prop.description && (
                        <p className="text-xs text-gray-400 mb-1">{prop.description}</p>
                      )}
                      {prop.type === "boolean" ? (
                        <select
                          value={args[k]}
                          onChange={(e) => setArgs({ ...args, [k]: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 bg-white"
                        >
                          <option value="">— select —</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type={prop.type === "number" ? "number" : "text"}
                          value={args[k]}
                          onChange={(e) => setArgs({ ...args, [k]: e.target.value })}
                          placeholder={prop.description ?? `Enter ${k}…`}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 font-mono"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: output */}
          <div className="w-80 flex flex-col px-5 py-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Output</p>
            {running ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100">
                <Loader2 size={20} className="animate-spin text-violet-400" />
                <p className="text-xs text-gray-400">Executing…</p>
              </div>
            ) : result ? (
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${result.error ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                    {result.error ? <XCircle size={10} /> : <CheckCircle2 size={10} />}
                    {result.error ? "Error" : "Success"}
                  </span>
                  {result.duration_ms != null && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} />{result.duration_ms}ms
                    </span>
                  )}
                </div>
                <pre className={`flex-1 text-xs rounded-xl p-3 overflow-auto whitespace-pre-wrap min-h-32 ${result.error ? "bg-red-50 border border-red-100 text-red-700" : "bg-gray-900 text-green-300"}`}>
                  {result.error ?? result.output}
                </pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Play size={16} className="text-gray-300 ml-0.5" />
                </div>
                <p className="text-xs text-gray-400 text-center">Hit Run to see<br />the tool output</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? "Running…" : "Run Tool"}
          </button>
          {result && (
            <button onClick={() => setResult(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Clear output
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-4 py-2 text-sm text-gray-500 hover:bg-gray-200 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MCP Playground (top-level) ────────────────────────────────────────────────

type McpDiscoveredTool = {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
};

function McpPlayground() {
  const [url, setUrl] = useState("");
  // Full header value — passed as-is (e.g. "Bearer abc123")
  const [authHeader, setAuthHeader] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("Authorization");
  const [showAuthFields, setShowAuthFields] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tools, setTools] = useState<McpDiscoveredTool[] | null>(null);
  const [connectError, setConnectError] = useState("");
  const [selectedTool, setSelectedTool] = useState<McpDiscoveredTool | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ output?: unknown; error?: string; duration_ms?: number } | null>(null);

  useEffect(() => { setArgs({}); setResult(null); }, [selectedTool]);

  const buildProxyBody = (extra: object) => ({
    url: url.trim(),
    authHeader: authHeader.trim() || undefined,
    authHeaderName: authHeaderName.trim() || undefined,
    ...extra,
  });

  const connect = async () => {
    if (!url.trim()) return;
    setConnecting(true);
    setConnectError("");
    setTools(null);
    setSelectedTool(null);
    try {
      const res = await fetch("/api/mcp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProxyBody({ action: "list" })),
      });
      const data = await res.json();
      if (data.error) { setConnectError(data.error); return; }
      setTools(data.tools ?? []);
      if (data.tools?.length) setSelectedTool(data.tools[0]);
    } catch {
      setConnectError("Failed to reach server");
    } finally {
      setConnecting(false);
    }
  };

  const runTool = async () => {
    if (!selectedTool) return;
    setRunning(true);
    setResult(null);
    try {
      const parsedArgs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        const propSchema = selectedTool.inputSchema?.properties?.[k];
        if (propSchema?.type === "number" || propSchema?.type === "integer") parsedArgs[k] = Number(v);
        else if (propSchema?.type === "boolean") parsedArgs[k] = v === "true";
        else parsedArgs[k] = v;
      }
      const res = await fetch("/api/mcp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProxyBody({ action: "call", tool: selectedTool.name, args: parsedArgs })),
      });
      const data = await res.json();
      setResult(data.error ? { error: data.error, duration_ms: data.duration_ms } : { output: data.result, duration_ms: data.duration_ms });
    } catch {
      setResult({ error: "Request failed" });
    } finally {
      setRunning(false);
    }
  };

  const props = selectedTool?.inputSchema?.properties ?? {};
  const required = selectedTool?.inputSchema?.required ?? [];

  return (
    <div className="flex gap-6 h-full">
      {/* Left column: connection + tool list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        {/* Connection panel */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center">
              <Plug size={12} className="text-violet-600" />
            </div>
            <span className="text-sm font-semibold text-gray-800">Connect to Server</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">MCP Server URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="https://your-server.com/mcp"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400 font-mono"
            />
          </div>

          {/* Auth section */}
          <div>
            <button
              onClick={() => setShowAuthFields((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Key size={11} />
              Authentication
              <ChevronDown size={11} className={`transition-transform ${showAuthFields ? "rotate-180" : ""}`} />
            </button>
            {showAuthFields && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <div className="w-28 flex-shrink-0">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Header name</label>
                    <input
                      value={authHeaderName}
                      onChange={(e) => setAuthHeaderName(e.target.value)}
                      placeholder="Authorization"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 font-mono"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Header value</label>
                    <input
                      value={authHeader}
                      onChange={(e) => setAuthHeader(e.target.value)}
                      type="password"
                      placeholder="Bearer your-token"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">Paste the full value, e.g. <span className="font-mono">Bearer abc123</span></p>
              </div>
            )}
          </div>

          {connectError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-xs text-red-600 font-medium">Connection failed</p>
              <p className="text-xs text-red-500 mt-0.5 break-words">{connectError}</p>
            </div>
          )}
          <button
            onClick={connect}
            disabled={connecting || !url.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {connecting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {connecting ? "Connecting…" : tools !== null ? "Reconnect" : "Connect & List Tools"}
          </button>
        </div>

        {/* Tool list */}
        {tools !== null && (
          <div className="bg-white rounded-2xl border border-gray-200 flex-1 overflow-auto">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Wrench size={12} className="text-violet-500" />
              <span className="text-xs font-semibold text-gray-700">Tools</span>
              <span className="ml-auto text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-semibold">{tools.length}</span>
            </div>
            {tools.length === 0 ? (
              <p className="px-4 py-6 text-xs text-gray-400 text-center">No tools discovered</p>
            ) : (
              <div className="p-2 space-y-0.5">
                {tools.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTool(t)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedTool?.name === t.name
                        ? "bg-violet-100 text-violet-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="block text-xs font-mono font-medium truncate">{t.name}</span>
                    {t.description && <span className="block text-[11px] text-gray-400 truncate mt-0.5">{t.description}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right column: parameter form + result */}
      <div className="flex-1 min-w-0">
        {!tools ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center">
              <FlaskConical size={28} className="text-violet-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">Enter a server URL and connect</p>
            <p className="text-xs text-gray-400 max-w-xs">Works with any MCP server — your hosted servers, third-party servers, or local dev instances</p>
          </div>
        ) : !selectedTool ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-400">Select a tool from the list</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            {/* Tool header */}
            <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wrench size={14} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 font-mono">{selectedTool.name}</h3>
                {selectedTool.description && <p className="text-xs text-gray-500 mt-0.5">{selectedTool.description}</p>}
              </div>
            </div>

            {/* Parameters */}
            {Object.keys(props).length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parameters</p>
                {Object.entries(props).map(([key, schema]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      {key}
                      {required.includes(key) && <span className="text-red-400 ml-0.5">*</span>}
                      {schema.description && <span className="font-normal text-gray-400 ml-2">{schema.description}</span>}
                      <span className="ml-2 text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{schema.type ?? "any"}</span>
                    </label>
                    {schema.enum ? (
                      <select
                        value={args[key] ?? ""}
                        onChange={(e) => setArgs((a) => ({ ...a, [key]: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                      >
                        <option value="">— select —</option>
                        {schema.enum.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : schema.type === "boolean" ? (
                      <select
                        value={args[key] ?? ""}
                        onChange={(e) => setArgs((a) => ({ ...a, [key]: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                      >
                        <option value="">— select —</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type={schema.type === "number" || schema.type === "integer" ? "number" : "text"}
                        value={args[key] ?? ""}
                        onChange={(e) => setArgs((a) => ({ ...a, [key]: e.target.value }))}
                        placeholder={schema.type ?? "value"}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">This tool takes no parameters.</p>
            )}

            <button
              onClick={runTool}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? "Running…" : "Run Tool"}
            </button>

            {result && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {result.error ? "Error" : "Result"}
                  </p>
                  {result.duration_ms !== undefined && (
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> {result.duration_ms}ms
                    </span>
                  )}
                </div>
                <pre className={`text-xs font-mono p-4 rounded-xl border overflow-auto max-h-80 whitespace-pre-wrap ${result.error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                  {result.error ? `Error: ${result.error}` : JSON.stringify(result.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
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
  const [expanded, setExpanded] = useState(true);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAddTool, setShowAddTool] = useState(false);
  const [togglingTool, setTogglingTool] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [expandedTab, setExpandedTab] = useState<"tools" | "history" | "analytics" | "alerts">("tools");
  const [history, setHistory] = useState<ToolExecution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showSdk, setShowSdk] = useState(false);
  const [showOpenApiImporter, setShowOpenApiImporter] = useState(false);
  const [testingTool, setTestingTool] = useState<PlaygroundTool | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const loadTools = useCallback(async () => {
    if (server.type !== "hosted") return;
    setLoadingTools(true);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}/tools`);
    const data = await res.json();
    setTools(Array.isArray(data) ? data : []);
    setLoadingTools(false);
  }, [server.id, server.type]);

  // Load tools on mount (not just on expand) so count shows correctly
  useEffect(() => {
    if (server.type === "hosted") loadTools();
  }, [loadTools, server.type]);

  const discover = async () => {
    setDiscovering(true);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}/discover`, { method: "POST" });
    const data = await res.json();
    setDiscovering(false);
    onUpdate({ ...server, status: data.status, tools_cache: data.tools, last_discovered_at: new Date().toISOString() });
    if (data.tools?.length > 0) setExpanded(true);
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

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const res = await fetch(`/api/mcp-toolboxes/${server.id}/history?limit=50`);
    const data = await res.json();
    setHistory(Array.isArray(data) ? data : []);
    setLoadingHistory(false);
  }, [server.id]);

  useEffect(() => {
    if (expanded && expandedTab === "history") loadHistory();
  }, [expanded, expandedTab, loadHistory]);

  const clearHistory = async () => {
    if (!confirm("Clear all execution history for this server?")) return;
    setClearingHistory(true);
    await fetch(`/api/mcp-toolboxes/${server.id}/history`, { method: "DELETE" });
    setHistory([]);
    setClearingHistory(false);
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
      <div className={`bg-white rounded-xl overflow-hidden transition-all border-l-4 shadow-sm ${
        server.enabled
          ? isHosted
            ? "border-l-violet-500 border border-violet-100 hover:border-violet-200 hover:shadow-md"
            : "border-l-blue-400 border border-blue-100 hover:border-blue-200 hover:shadow-md"
          : isHosted
            ? "border-l-violet-200 border border-gray-100 opacity-60"
            : "border-l-blue-200 border border-gray-100 opacity-60"
      }`}>
        {/* Colored type header band */}
        <div className={`px-4 py-2 flex items-center gap-2 ${isHosted ? "bg-violet-50" : "bg-blue-50"}`}>
          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${isHosted ? "bg-violet-200" : "bg-blue-200"}`}>
            {isHosted ? <Server size={11} className="text-violet-700" /> : <Plug size={11} className="text-blue-700" />}
          </div>
          <span className={`text-xs font-bold uppercase tracking-widest ${isHosted ? "text-violet-600" : "text-blue-600"}`}>
            {isHosted ? "My MCP Server" : "External MCP Server"}
          </span>
          <div className="flex-1" />
          <StatusDot status={server.status} enabled={server.enabled} />
          <span className={`text-xs font-medium ${server.enabled ? "text-green-600" : "text-gray-400"}`}>
            {server.enabled ? "active" : "disabled"}
          </span>
        </div>

        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">{server.name}</span>
                </div>
                {server.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{server.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              {/* Enable/disable pill toggle */}
              <button
                onClick={toggleServer}
                title={server.enabled ? "Disable server" : "Enable server"}
                className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-200 ${server.enabled ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${server.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              {/* SDK button for hosted servers */}
              {isHosted && server.slug && (
                <button onClick={() => setShowSdk(true)} title="SDK / Config"
                  className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                  <Code2 size={14} />
                </button>
              )}
              {/* Edit */}
              <button onClick={() => setShowEdit(true)} title="Edit server"
                className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                <Pencil size={13} />
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

          {/* Endpoint URLs for hosted servers — respect transport selection */}
          {isHosted && server.slug && (
            <div className="mt-3 space-y-1.5">
              {(server.transport === "sse" || server.transport === "both") && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                  <Zap size={10} className="text-violet-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 flex-shrink-0">SSE</span>
                  <span className="text-xs font-mono text-gray-600 truncate flex-1">{sseUrl}</span>
                  <button onClick={() => copy(sseUrl, "sse-" + server.id)} className="text-gray-400 hover:text-violet-600 flex-shrink-0">
                    {copied === "sse-" + server.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                  </button>
                </div>
              )}
              {(server.transport === "http" || server.transport === "both") && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                  <ExternalLink size={10} className="text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 flex-shrink-0">HTTP</span>
                  <span className="text-xs font-mono text-gray-600 truncate flex-1">{httpUrl}</span>
                  <button onClick={() => copy(httpUrl, "http-" + server.id)} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                    {copied === "http-" + server.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* External server URL */}
          {!isHosted && server.url && (
            <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <ExternalLink size={10} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs font-mono text-gray-600 truncate flex-1">{server.url}</span>
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
                      <span className="text-xs font-medium text-green-700">Auth key enabled</span>
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
                    <code className="text-xs font-mono text-green-800 bg-green-100 px-2 py-1 rounded block truncate">
                      {server.auth_key}
                    </code>
                  )}
                  <p className="text-xs text-green-600 mt-1">Add as <code className="bg-green-100 px-1 rounded">Authorization: Bearer &lt;key&gt;</code> header</p>
                </div>
              ) : (
                <button onClick={generateKey} disabled={savingKey}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg border border-dashed border-gray-200 hover:border-violet-200 transition-colors w-full justify-center">
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
              <span className="text-xs text-amber-700">Auth key configured</span>
            </div>
          )}

          {/* Footer: tool count + actions */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {isHosted
                ? `${tools.length > 0 ? tools.length : "No"} tool${tools.length !== 1 ? "s" : ""}`
                : externalTools.length > 0
                  ? `${externalTools.length} tool${externalTools.length !== 1 ? "s" : ""} discovered`
                  : "Not discovered yet"}
            </span>
            <div className="flex items-center gap-1">
              {!isHosted && (
                <button onClick={discover} disabled={discovering}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
                  {discovering ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {discovering ? "Connecting…" : "Discover Tools"}
                </button>
              )}
              {isHosted && (
                <>
                  <button onClick={() => { setExpanded(true); setShowOpenApiImporter(true); }}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Download size={11} /> Import OpenAPI
                  </button>
                  <button onClick={() => setShowAddTool(true)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2 py-1 hover:bg-violet-50 rounded-lg transition-colors">
                    <Plus size={11} /> Add Tool
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Expanded panel with tabs */}
        {expanded && (
          <div className="border-t border-gray-100">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 flex-wrap">
              <button onClick={() => setExpandedTab("tools")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${expandedTab === "tools" ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"}`}>
                <Wrench size={11} /> Tools {isHosted && tools.length > 0 && `(${tools.length})`}
              </button>
              <button onClick={() => setExpandedTab("history")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${expandedTab === "history" ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"}`}>
                <History size={11} /> History {history.length > 0 && `(${history.length})`}
              </button>
              <button onClick={() => setExpandedTab("analytics")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${expandedTab === "analytics" ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"}`}>
                <BarChart2 size={11} /> Analytics
              </button>
              <button onClick={() => setExpandedTab("alerts")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${expandedTab === "alerts" ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"}`}>
                <Bell size={11} /> Alerts
              </button>
              {expandedTab === "history" && history.length > 0 && (
                <button onClick={clearHistory} disabled={clearingHistory}
                  className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-500 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                  {clearingHistory ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Clear
                </button>
              )}
              {expandedTab === "history" && (
                <button onClick={loadHistory} disabled={loadingHistory}
                  className={`${history.length > 0 ? "" : "ml-auto"} flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 px-2 py-1 hover:bg-violet-50 rounded-lg transition-colors`}>
                  {loadingHistory ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                </button>
              )}
            </div>

            <div className="px-4 pb-4">
              {/* ── Tools tab ── */}
              {expandedTab === "tools" && (
                isHosted ? (
                  <>
                    {loadingTools ? (
                      <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
                    ) : tools.length === 0 ? (
                      <div className="py-6 text-center">
                        <Wrench size={20} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No tools yet. Add a scenario as a tool.</p>
                        <button onClick={() => setShowAddTool(true)}
                          className="mt-2 text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 mx-auto">
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
                                {!tool.enabled && <span className="text-xs text-gray-400 bg-gray-200 px-1.5 rounded">disabled</span>}
                              </div>
                              {tool.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{tool.description}</p>}
                              <div className="flex items-center gap-1 mt-1">
                                <Link2 size={10} className="text-violet-400 flex-shrink-0" />
                                {tool.workflow_id ? (() => {
                                  const wf = workflows.find(w => w.id === tool.workflow_id);
                                  return wf ? (
                                    <span className={`text-xs flex items-center gap-1 ${wf.is_active ? "text-violet-600" : "text-amber-500"}`}>
                                      {wf.name}
                                      {!wf.is_active && <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded">inactive — tool won&apos;t run</span>}
                                    </span>
                                  ) : <span className="text-xs text-gray-400">Scenario deleted</span>;
                                })() : <span className="text-xs text-gray-400">No scenario linked</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setTestingTool({ name: tool.name, description: tool.description, inputSchema: tool.input_schema as Record<string, unknown> | undefined })}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
                                <Play size={10} /> Test
                              </button>
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
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-violet-600 hover:bg-violet-50 rounded-lg border border-dashed border-violet-200 transition-colors">
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
                        <p className="text-xs text-gray-400">Click &quot;Discover Tools&quot; to load available tools.</p>
                      </div>
                    ) : externalTools.map((tool, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Settings size={12} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-gray-800 font-mono">{tool.name}</span>
                          {tool.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tool.description}</p>}
                        </div>
                        <button
                          onClick={() => setTestingTool(tool)}
                          title="Test tool"
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Play size={10} /> Test
                        </button>
                      </div>
                    ))}
                    {server.last_discovered_at && (
                      <p className="text-xs text-gray-400 text-right">Last discovered {new Date(server.last_discovered_at).toLocaleString()}</p>
                    )}
                  </div>
                )
              )}

              {/* ── History tab ── */}
              {expandedTab === "history" && (
                loadingHistory ? (
                  <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
                ) : history.length === 0 ? (
                  <div className="py-8 text-center">
                    <History size={20} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No executions yet. Tool calls will appear here.</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {history.map((exec) => (
                      <ExecutionRow key={exec.id} exec={exec} />
                    ))}
                  </div>
                )
              )}

              {/* ── Analytics tab ── */}
              {expandedTab === "analytics" && (
                <AnalyticsTabContent serverId={server.id} />
              )}

              {/* ── Alerts tab ── */}
              {expandedTab === "alerts" && (
                <AlertsTabContent serverId={server.id} />
              )}

            </div>
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

      {showSdk && (
        <SdkModal server={server} onClose={() => setShowSdk(false)} />
      )}

      {showOpenApiImporter && (
        <OpenApiImporterModal
          serverId={server.id}
          onClose={() => setShowOpenApiImporter(false)}
          onImported={() => {
            loadTools();
            setExpanded(true);
            setExpandedTab("tools");
          }}
        />
      )}

      {testingTool && (
        <ToolPlaygroundModal
          tool={testingTool}
          serverId={server.id}
          serverType={server.type}
          onClose={() => setTestingTool(null)}
        />
      )}

      {showEdit && (
        <EditServerModal
          server={server}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => { onUpdate(updated); setShowEdit(false); }}
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
  const [createType, setCreateType] = useState<"hosted" | "external">("hosted");
  const [createInitialUrl, setCreateInitialUrl] = useState("");
  const [filter, setFilter] = useState<"all" | "hosted" | "external">("all");
  const [pageView, setPageView] = useState<"servers" | "playground">("servers");

  const openCreate = (type: "hosted" | "external" = "hosted", initialUrl = "") => {
    setCreateType(type);
    setCreateInitialUrl(initialUrl);
    setShowCreate(true);
  };

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
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setPageView("servers")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${pageView === "servers" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  <Server size={12} /> Servers
                </button>
                <button onClick={() => setPageView("playground")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${pageView === "playground" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  <FlaskConical size={12} /> Playground
                </button>
              </div>
              {pageView === "servers" && (
                <>
                  <button
                    onClick={() => openCreate("external")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:border-violet-300 hover:text-violet-700 transition-colors"
                  >
                    <Plug size={14} /> Connect External
                  </button>
                  <button
                    onClick={() => openCreate("hosted")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                  >
                    <Plus size={14} /> New Server
                  </button>
                </>
              )}
            </div>
          }
        />

        <main className="flex-1 overflow-auto px-8 py-6">
          {/* Playground view */}
          {pageView === "playground" && (
            <McpPlayground />
          )}

          {/* Servers view */}
          {pageView === "servers" && <>
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
              <div className="flex gap-2 justify-center">
<button onClick={() => openCreate("external")}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:border-violet-300 transition-colors">
                  Connect External
                </button>
                <button onClick={() => openCreate("hosted")}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                  Create My Own
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Hosted servers section */}
              {(filter === "all" || filter === "hosted") && hosted.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-violet-100">
                    <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Server size={15} className="text-violet-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-800">My MCP Servers</h3>
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">{hosted.length}</span>
                      </div>
                      <p className="text-xs text-gray-400">Servers you built — expose your scenarios as MCP tools for Claude, Cline and other AI agents</p>
                    </div>
                    <button onClick={() => openCreate("hosted")}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors flex-shrink-0">
                      <Plus size={11} /> New Server
                    </button>
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
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-blue-100">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Plug size={15} className="text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-800">Connected External Servers</h3>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">{external.length}</span>
                      </div>
                      <p className="text-xs text-gray-400">Third-party MCP servers connected to your workspace — discover and test their tools here</p>
                    </div>
                    <button onClick={() => openCreate("external")}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors flex-shrink-0">
                      <Plug size={11} /> Connect Server
                    </button>
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
          </>}
        </main>
      </AppShell>

      {showCreate && (
        <CreateServerModal
          initialType={createType}
          initialUrl={createInitialUrl}
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
