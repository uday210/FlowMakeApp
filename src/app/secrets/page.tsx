"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Trash2, Plus, KeyRound, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Search } from "lucide-react";

interface Secret {
  id: string;
  name: string;
  created_at: string;
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showing, setShowing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSecrets = useCallback(async () => {
    try {
      const res = await fetch("/api/secrets");
      if (!res.ok) throw new Error("Failed to load secrets");
      const data = await res.json();
      setSecrets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSecrets(); }, [fetchSecrets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newValue.trim()) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), value: newValue.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      setNewName("");
      setNewValue("");
      setShowing(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      await fetchSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save secret");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this secret?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/secrets?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      setSecrets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete secret");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = secrets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        title="Secrets"
        subtitle="Store API keys and sensitive values — reference with {{secret.NAME}} in any workflow"
        action={
          <button
            onClick={() => setShowing(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> Add secret
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <div className="relative max-w-sm mb-6">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search secrets…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
          />
        </div>

        {/* Add form */}
        {showing && (
          <div className="bg-white border border-violet-200 rounded-xl p-5 mb-6 shadow-sm max-w-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">New Secret</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Secret Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. OPENAI_API_KEY"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Secret Value</label>
                <div className="relative">
                  <input
                    type={showValue ? "text" : "password"}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Enter secret value"
                    className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !newName.trim() || !newValue.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {saving ? "Saving…" : "Add Secret"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowing(false); setNewName(""); setNewValue(""); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle size={12} /> Saved
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <KeyRound size={24} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              {search ? `No secrets match "${search}"` : "No secrets stored yet"}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Store API keys and credentials to use in your workflows
            </p>
            <button
              onClick={() => setShowing(true)}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Add first secret
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-2xl">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {filtered.length} secret{filtered.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-gray-400">Values are write-only — never displayed</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {filtered.map((secret) => (
                <li key={secret.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <KeyRound size={14} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium text-gray-800 truncate">{secret.name}</p>
                    <p className="text-xs text-gray-400 font-mono tracking-widest mt-0.5">••••••••••••</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 flex-shrink-0 font-mono bg-gray-50 px-2 py-0.5 rounded">
                      {`{{secret.${secret.name}}}`}
                    </span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {new Date(secret.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => handleDelete(secret.id)}
                      disabled={deletingId === secret.id}
                      className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    >
                      {deletingId === secret.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </AppShell>
  );
}
