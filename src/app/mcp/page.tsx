"use client";

import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plug,
  Plus,
  Trash2,
  Copy,
  CheckCheck,
  Search,
  Loader2,
  X,
  ExternalLink,
  Key,
} from "lucide-react";

interface MCPToolbox {
  id: string;
  name: string;
  url: string;
  auth_key?: string;
  description?: string;
  created_at: string;
}

export default function MCPToolboxesPage() {
  const [toolboxes, setToolboxes] = useState<MCPToolbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showing, setShowing] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", auth_key: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/mcp-toolboxes")
      .then((r) => r.json())
      .then((d) => setToolboxes(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    await fetch("/api/mcp-toolboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowing(false);
    setForm({ name: "", url: "", auth_key: "", description: "" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Remove this MCP toolbox?")) return;
    await fetch(`/api/mcp-toolboxes?id=${id}`, { method: "DELETE" });
    setToolboxes((t) => t.filter((x) => x.id !== id));
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = toolboxes.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.url.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        title="MCP Toolboxes"
        subtitle="Connect AI agents to external tools via Model Context Protocol servers"
        action={
          <button
            onClick={() => setShowing(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> Create toolbox
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        <div className="relative max-w-sm mb-6">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search toolboxes…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
          />
        </div>

        {/* Create form */}
        {showing && (
          <div className="bg-white border border-violet-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">New MCP Toolbox</h3>
              <button onClick={() => setShowing(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My MCP Server"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Server URL *</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://mcp.example.com/sse"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Auth Key (optional)</label>
                <input
                  type="password"
                  value={form.auth_key}
                  onChange={(e) => setForm({ ...form, auth_key: e.target.value })}
                  placeholder="Bearer token or API key"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What tools does this server expose?"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving || !form.name || !form.url}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
              </button>
              <button onClick={() => setShowing(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plug size={24} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              {search ? `No toolboxes match "${search}"` : "No MCP toolboxes yet"}
            </h2>
            <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
              Connect AI agents to external tools, databases, and APIs via MCP servers
            </p>
            <button
              onClick={() => setShowing(true)}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Add first toolbox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-violet-200 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Plug size={16} className="text-violet-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">{t.name}</h3>
                      {t.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => del(t.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <ExternalLink size={11} className="text-gray-400 flex-shrink-0" />
                    <span className="text-[11px] font-mono text-gray-600 truncate flex-1">{t.url}</span>
                    <button
                      onClick={() => copy(t.url, t.id)}
                      className="text-gray-400 hover:text-violet-600 flex-shrink-0"
                    >
                      {copied === t.id ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                    </button>
                  </div>
                  {t.auth_key && (
                    <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                      <Key size={11} className="text-amber-500 flex-shrink-0" />
                      <span className="text-[11px] text-amber-700 flex-1">Auth key configured</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
                  Added {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
