"use client";

import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, AlertCircle, Loader2, Power, Clock } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/apikeys")
      .then(r => r.json())
      .then(d => { setKeys(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/apikeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error); return; }
    setNewKey(data.raw_key);
    setNewName("");
    setShowForm(false);
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this API key? Any integrations using it will stop working.")) return;
    await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
    setKeys(k => k.filter(x => x.id !== id));
  };

  const toggle = async (id: string, is_active: boolean) => {
    await fetch(`/api/apikeys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    setKeys(k => k.map(x => x.id === id ? { ...x, is_active } : x));
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <PageHeader
        title="API Keys"
        subtitle="Use API keys to integrate e-sign and workflows into your own applications"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> New API Key
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6 max-w-3xl">

        {/* Newly created key — show once */}
        {newKey && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Copy your API key now — it won&apos;t be shown again</p>
                <p className="text-xs text-amber-600 mt-0.5">Store it securely. If you lose it, you&apos;ll need to create a new one.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white border border-amber-200 rounded-lg px-3 py-2 text-amber-900 break-all">
                {newKey}
              </code>
              <button
                onClick={copyKey}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex-shrink-0 ${
                  copied ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
                }`}
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-amber-500 hover:text-amber-700">
              I&apos;ve saved it, dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="mb-6 bg-white border border-violet-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-800 mb-3">New API Key</p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && create()}
                placeholder="e.g. My CRM integration"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
              />
              <button
                onClick={create}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : "Create"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-violet-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Key size={24} className="text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No API keys yet</p>
            <p className="text-xs text-gray-400 mb-4">Create a key to integrate e-sign into your own application</p>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700">
              Create first key
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {keys.map((k, i) => (
              <div key={k.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${k.is_active ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-400"}`}>
                  <Key size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">{k.name}</p>
                    {!k.is_active && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Disabled</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-gray-400 font-mono">{k.key_prefix}••••••••••••••••</code>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : "Never used"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggle(k.id, !k.is_active)}
                    className={`p-1.5 rounded-lg transition-colors ${k.is_active ? "text-gray-400 hover:text-amber-500 hover:bg-amber-50" : "text-gray-400 hover:text-green-500 hover:bg-green-50"}`}
                    title={k.is_active ? "Disable key" : "Enable key"}
                  >
                    <Power size={13} />
                  </button>
                  <button
                    onClick={() => revoke(k.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Usage docs */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">How to use the API</p>
          <div className="space-y-3 text-xs text-gray-600">
            <div>
              <p className="font-medium text-gray-700 mb-1">1. Send a document for signing (dynamic signers)</p>
              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">{`POST /api/v1/esign/send
Authorization: Bearer sk_live_your_key

{
  "document_id": "your-doc-id",
  "signers": [
    { "email": "alice@company.com", "name": "Alice", "order": 1 },
    { "email": "bob@company.com",   "name": "Bob",   "order": 2 }
  ],
  "mode": "sequential",
  "callback_url": "https://yourapp.com/webhooks/esign"
}`}</pre>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">2. For template documents (role-based fields)</p>
              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">{`// Fields in document assigned to "Signer 1", "Signer 2"
{
  "document_id": "template-doc-id",
  "signers": [
    { "email": "customer@acme.com", "name": "Customer", "role": "Signer 1" },
    { "email": "legal@acme.com",    "name": "Legal",    "role": "Signer 2" }
  ]
}`}</pre>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">3. For per-individual documents (each person signs own copy)</p>
              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">{`// Call once per person — each gets their own session
POST /api/v1/esign/send
{ "document_id": "onboarding-form-id",
  "signers": [{ "email": "newemployee@co.com", "name": "John" }] }
// Repeat for each individual`}</pre>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">4. Check signing status</p>
              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">{`GET /api/v1/esign/sessions/{session_id}
Authorization: Bearer sk_live_your_key`}</pre>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">5. Webhook payload (sent to callback_url after each signing)</p>
              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">{`{
  "event": "signer.signed" | "session.completed",
  "session_id": "...",
  "signer": { "email": "alice@co.com", "order": 1, "signed_at": "..." },
  "session_status": "in_progress" | "completed"
}`}</pre>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
