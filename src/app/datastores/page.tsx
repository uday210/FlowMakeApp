"use client";

import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Database,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";

interface DataEntry {
  id: string;
  store: string;
  key: string;
  value: string;
  updated_at: string;
}

export default function DataStoresPage() {
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState("default");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`/api/datastores?store=${encodeURIComponent(store)}`)
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [store]);

  const addEntry = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    await fetch("/api/datastores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store, key: newKey.trim(), value: newVal }),
    });
    setNewKey(""); setNewVal(""); setAdding(false); setSaving(false);
    load();
  };

  const saveEdit = async (key: string) => {
    await fetch("/api/datastores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store, key, value: editVal }),
    });
    setEditing(null);
    load();
  };

  const deleteEntry = async (key: string) => {
    if (!confirm(`Delete key "${key}"?`)) return;
    await fetch(`/api/datastores?store=${encodeURIComponent(store)}&key=${encodeURIComponent(key)}`, { method: "DELETE" });
    setEntries((e) => e.filter((x) => x.key !== key));
  };

  const filtered = entries.filter(
    (e) =>
      e.key.toLowerCase().includes(search.toLowerCase()) ||
      e.value.toLowerCase().includes(search.toLowerCase())
  );

  const totalBytes = entries.reduce((a, e) => a + e.key.length + e.value.length, 0);

  return (
    <AppShell>
      <PageHeader
        title="Data stores"
        subtitle="Persistent key-value storage shared across workflow runs"
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              <Plus size={14} /> Add record
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {/* Store selector + stats */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <Database size={14} className="text-violet-500" />
            <span className="text-xs text-gray-500">Store:</span>
            <input
              value={store}
              onChange={(e) => setStore(e.target.value || "default")}
              className="text-sm font-semibold text-gray-800 outline-none w-28"
            />
          </div>
          <div className="text-xs text-gray-400">
            {entries.length} record{entries.length !== 1 ? "s" : ""} · {(totalBytes / 1024).toFixed(1)} KB / 1.0 MB
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys or values…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4 flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Key</label>
              <input
                autoFocus
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="my_key"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
              />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Value</label>
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="any value or JSON"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                onKeyDown={(e) => e.key === "Enter" && addEntry()}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={addEntry}
                disabled={saving || !newKey.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
              </button>
              <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={13} />
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
              <Database size={24} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              {search ? `No records match "${search}"` : "No records yet"}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Add records manually or use the Data Store node in a workflow
            </p>
            <button onClick={() => setAdding(true)} className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
              Add first record
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Key</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Updated</th>
                  <th className="px-5 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 group">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{e.key}</span>
                    </td>
                    <td className="px-5 py-3">
                      {editing === e.key ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editVal}
                            onChange={(ev) => setEditVal(ev.target.value)}
                            onKeyDown={(ev) => ev.key === "Enter" && saveEdit(e.key)}
                            className="flex-1 px-2 py-1 text-xs border border-violet-400 rounded focus:outline-none"
                          />
                          <button onClick={() => saveEdit(e.key)} className="text-green-600 hover:text-green-700">
                            <Check size={13} />
                          </button>
                          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600 font-mono truncate block max-w-md">{e.value}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(e.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button
                          onClick={() => { setEditing(e.key); setEditVal(e.value); }}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteEntry(e.key)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
