"use client";

import { useState, useEffect, useCallback } from "react";
import type { Connection } from "@/lib/types";
import { CONNECTION_DEFINITIONS, CONNECTION_DEF_MAP } from "@/lib/connectionDefinitions";
import { X, Plus, Trash2, Pencil } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function ConnectionsManager({ onClose }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Form state
  const [form, setForm] = useState<{ name: string; type: string; config: Record<string, string> }>({
    name: "", type: "", config: {},
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/connections");
    const data = await res.json();
    setConnections(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm({ name: "", type: CONNECTION_DEFINITIONS[0].type, config: {} });
  };

  const startEdit = (conn: Connection) => {
    setEditingId(conn.id);
    setCreating(false);
    const cfg: Record<string, string> = {};
    for (const [k, v] of Object.entries(conn.config)) cfg[k] = String(v);
    setForm({ name: conn.name, type: conn.type, config: cfg });
  };

  const handleTypeChange = (type: string) => {
    setForm({ name: form.name, type, config: {} });
  };

  const handleSave = async () => {
    if (!form.name || !form.type) return;
    setSaving(true);
    const body = { name: form.name, type: form.type, config: form.config };
    if (editingId) {
      await fetch(`/api/connections/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setCreating(false);
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this connection? Any workflows using it will need to be updated.")) return;
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const selectedDef = CONNECTION_DEF_MAP[form.type];
  const isFormOpen = creating || editingId !== null;

  // Group connections by type
  const grouped = connections.reduce<Record<string, Connection[]>>((acc, c) => {
    (acc[c.type] ??= []).push(c);
    return acc;
  }, {});

  const base = "w-full text-xs rounded-lg border border-gray-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700";

  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Connections</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Reusable credentials for integrations</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Form */}
        {isFormOpen && (
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {editingId ? "Edit Connection" : "New Connection"}
            </p>
            <div>
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Name</label>
              <input className={base} placeholder="e.g. My Salesforce Prod" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Type</label>
              <select className={base} value={form.type} onChange={(e) => handleTypeChange(e.target.value)}
                disabled={!!editingId}>
                {[...CONNECTION_DEFINITIONS].sort((a, b) => a.label.localeCompare(b.label)).map((d) => (
                  <option key={d.type} value={d.type}>{d.label}</option>
                ))}
              </select>
            </div>
            {selectedDef?.fields.map((f) => (
              <div key={f.key}>
                <label className="text-[10px] font-medium text-gray-500 block mb-1">
                  {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {f.type === "select" ? (
                  <select className={base} value={form.config[f.key] ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, config: { ...prev.config, [f.key]: e.target.value } }))}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input className={base} type={f.type === "password" ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={form.config[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, config: { ...prev.config, [f.key]: e.target.value } }))} />
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${saved ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                {saved ? "✓ Saved" : saving ? "Saving..." : "Save Connection"}
              </button>
              <button onClick={() => { setCreating(false); setEditingId(null); }}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Connection list */}
        <div className="p-3 space-y-2">
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-6">Loading...</p>
          ) : connections.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No connections yet. Create one to reuse credentials across nodes.</p>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => {
              const la = CONNECTION_DEF_MAP[a]?.label ?? a;
              const lb = CONNECTION_DEF_MAP[b]?.label ?? b;
              return la.localeCompare(lb);
            }).map(([type, conns]) => {
              const def = CONNECTION_DEF_MAP[type];
              return (
                <div key={type}>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">{def?.label ?? type}</p>
                  {[...conns].sort((a, b) => a.name.localeCompare(b.name)).map((conn) => (
                    <div key={conn.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:border-blue-200 transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{conn.name}</span>
                      <button onClick={() => startEdit(conn)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-all">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => handleDelete(conn.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        <button onClick={startCreate} disabled={isFormOpen}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50">
          <Plus size={13} /> New Connection
        </button>
      </div>
    </aside>
  );
}
