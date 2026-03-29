"use client";

import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Link2,
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Zap,
  Mail,
  MessageSquare,
  Globe,
  Database,
  Bot,
  Cloud,
  ShoppingCart,
  GitBranch,
  FileText,
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  created_at: string;
}

const SERVICE_TYPES = [
  { value: "openai", label: "OpenAI", icon: Bot, color: "bg-green-100 text-green-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "anthropic", label: "Anthropic", icon: Bot, color: "bg-amber-100 text-amber-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "gmail", label: "Gmail / SMTP", icon: Mail, color: "bg-red-100 text-red-500", fields: [{ key: "email", label: "Email", type: "text" }, { key: "app_password", label: "App Password", type: "password" }] },
  { value: "slack", label: "Slack", icon: MessageSquare, color: "bg-yellow-100 text-yellow-600", fields: [{ key: "bot_token", label: "Bot Token", type: "password" }, { key: "channel", label: "Default Channel", type: "text" }] },
  { value: "discord", label: "Discord", icon: MessageSquare, color: "bg-indigo-100 text-indigo-600", fields: [{ key: "webhook_url", label: "Webhook URL", type: "text" }] },
  { value: "airtable", label: "Airtable", icon: Database, color: "bg-cyan-100 text-cyan-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "base_id", label: "Base ID", type: "text" }] },
  { value: "notion", label: "Notion", icon: FileText, color: "bg-gray-100 text-gray-700", fields: [{ key: "token", label: "Integration Token", type: "password" }] },
  { value: "github", label: "GitHub", icon: GitBranch, color: "bg-gray-100 text-gray-800", fields: [{ key: "token", label: "Personal Access Token", type: "password" }, { key: "owner", label: "Owner / Org", type: "text" }] },
  { value: "stripe", label: "Stripe", icon: ShoppingCart, color: "bg-violet-100 text-violet-600", fields: [{ key: "secret_key", label: "Secret Key", type: "password" }, { key: "webhook_secret", label: "Webhook Secret", type: "password" }] },
  { value: "aws_s3", label: "AWS S3", icon: Cloud, color: "bg-orange-100 text-orange-500", fields: [{ key: "access_key_id", label: "Access Key ID", type: "text" }, { key: "secret_access_key", label: "Secret Access Key", type: "password" }, { key: "region", label: "Region", type: "text" }, { key: "bucket", label: "Bucket", type: "text" }] },
  { value: "webhook", label: "HTTP / Webhook", icon: Globe, color: "bg-blue-100 text-blue-600", fields: [{ key: "base_url", label: "Base URL", type: "text" }, { key: "auth_header", label: "Auth Header (optional)", type: "password" }] },
  { value: "custom", label: "Custom", icon: Zap, color: "bg-pink-100 text-pink-600", fields: [{ key: "key", label: "Key / Token", type: "password" }] },
];

function ServiceIcon({ type, size = 16 }: { type: string; size?: number }) {
  const svc = SERVICE_TYPES.find((s) => s.value === type);
  if (!svc) return <Link2 size={size} />;
  const Icon = svc.icon;
  return <Icon size={size} />;
}

function ServiceBadge({ type }: { type: string }) {
  const svc = SERVICE_TYPES.find((s) => s.value === type);
  if (!svc) return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{type}</span>;
  const Icon = svc.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${svc.color}`}>
      <Icon size={10} /> {svc.label}
    </span>
  );
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showing, setShowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", type: "openai", config: {} as Record<string, string> });

  const selectedService = SERVICE_TYPES.find((s) => s.value === form.type) ?? SERVICE_TYPES[0];

  const load = () => {
    setLoading(true);
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => setConnections(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, type: form.type, config: form.config }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      const data = await res.json();
      setSavedId(data.id);
      setTimeout(() => setSavedId(null), 2000);
      setShowing(false);
      setForm({ name: "", type: "openai", config: {} });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Remove this connection?")) return;
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    setConnections((c) => c.filter((x) => x.id !== id));
  };

  const filtered = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByType = filtered.reduce<Record<string, Connection[]>>((acc, c) => {
    (acc[c.type] ??= []).push(c);
    return acc;
  }, {});

  return (
    <AppShell>
      <PageHeader
        title="Connections"
        subtitle="Manage credentials for third-party services used in your scenarios"
        action={
          <button
            onClick={() => setShowing(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> Add connection
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={14} /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <div className="relative max-w-sm mb-6">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
          />
        </div>

        {/* Create form */}
        {showing && (
          <div className="bg-white border border-violet-200 rounded-xl p-5 mb-6 shadow-sm max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">New Connection</h3>
              <button onClick={() => setShowing(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Service</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SERVICE_TYPES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setForm({ ...form, type: s.value, config: {} })}
                        className={`flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-lg border transition-all ${
                          form.type === s.value
                            ? "border-violet-400 bg-violet-50 text-violet-700 font-semibold"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        }`}
                      >
                        <span className={`w-4 h-4 flex items-center justify-center rounded ${s.color}`}>
                          <Icon size={10} />
                        </span>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Connection name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={`My ${selectedService.label}`}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>

              {selectedService.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
                  <input
                    type={field.type}
                    value={form.config[field.key] ?? ""}
                    onChange={(e) => setForm({ ...form, config: { ...form.config, [field.key]: e.target.value } })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Save
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
              <Link2 size={24} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              {search ? `No connections match "${search}"` : "No connections yet"}
            </h2>
            <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
              Add credentials for OpenAI, Slack, Gmail, and other services to use in your workflows
            </p>
            <button
              onClick={() => setShowing(true)}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Add first connection
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByType).map(([type, conns]) => {
              const svc = SERVICE_TYPES.find((s) => s.value === type);
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <ServiceBadge type={type} />
                    <span className="text-xs text-gray-400">{conns.length} connection{conns.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {conns.map((conn, i) => (
                      <div
                        key={conn.id}
                        className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group ${i > 0 ? "border-t border-gray-100" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${svc?.color ?? "bg-gray-100 text-gray-600"}`}>
                          <ServiceIcon type={type} size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{conn.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Added {new Date(conn.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        {savedId === conn.id && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} /> Saved
                          </span>
                        )}
                        <button
                          onClick={() => del(conn.id)}
                          className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
