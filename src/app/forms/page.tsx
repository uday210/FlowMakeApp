"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plus, FileText, Loader2, Trash2, MoreHorizontal,
  X, Check, AlertCircle, Globe, Lock, BarChart2, ExternalLink,
} from "lucide-react";

type Form = {
  id: string;
  name: string;
  description: string;
  is_published: boolean;
  response_count: number;
  created_at: string;
  updated_at: string;
};

const ACCENT_COLORS = [
  { bar: "bg-indigo-500", icon: "bg-indigo-50 border-indigo-100 text-indigo-600" },
  { bar: "bg-violet-500", icon: "bg-violet-50 border-violet-100 text-violet-600" },
  { bar: "bg-emerald-500", icon: "bg-emerald-50 border-emerald-100 text-emerald-600" },
  { bar: "bg-blue-500",   icon: "bg-blue-50 border-blue-100 text-blue-600" },
  { bar: "bg-pink-500",   icon: "bg-pink-50 border-pink-100 text-pink-600" },
  { bar: "bg-orange-500", icon: "bg-orange-50 border-orange-100 text-orange-600" },
];

function CreateModal({ onSave, onClose }: {
  onSave: (data: { name: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
          <h2 className="text-sm font-bold text-gray-900">New Form</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Form name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Contact Us, Job Application, Feedback"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What is this form for?"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Create form
          </button>
        </div>
      </div>
    </div>
  );
}

function FormCard({ form, index, onDelete, onOpen }: {
  form: Form; index: number; onDelete: () => void; onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all group flex flex-col">
      <div className={`h-1 w-full ${accent.bar}`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${accent.icon}`}>
            <FileText size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{form.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{form.description || <span className="italic">No description</span>}</p>
          </div>
          <div className="relative flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 transition-all">
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 w-44 z-20">
                  <a href={`${origin}/form/${form.id}`} target="_blank" rel="noreferrer"
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50">
                    <ExternalLink size={12} /> Open form
                  </a>
                  <button onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 mb-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${form.is_published ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
              {form.is_published ? <><Globe size={10} /> Published</> : <><Lock size={10} /> Draft</>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <BarChart2 size={11} className="text-gray-400" />
            <span>{form.response_count} response{form.response_count !== 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3.5 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {new Date(form.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button onClick={onOpen} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            Edit →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/forms")
      .then(r => r.json())
      .then(d => setForms(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { name: string; description: string }) => {
    const res = await fetch("/api/forms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create");
    setShowCreate(false);
    router.push(`/forms/${json.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this form and all its responses? This cannot be undone.")) return;
    await fetch(`/api/forms/${id}`, { method: "DELETE" });
    setForms(prev => prev.filter(f => f.id !== id));
  };

  return (
    <AppShell>
      <PageHeader
        title="Forms"
        subtitle="Typeform-style conversational forms that trigger your workflows"
        action={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={14} /> New form
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
                  <div className="flex gap-3"><div className="w-10 h-10 bg-gray-100 rounded-xl" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 bg-gray-100 rounded w-2/3" /><div className="h-2.5 bg-gray-100 rounded w-1/2" /></div></div>
                </div>
              </div>
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 border border-indigo-100 shadow-sm">
              <FileText size={28} className="text-indigo-500" />
            </div>
            <h2 className="text-base font-bold text-gray-800 mb-2">No forms yet</h2>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">Create beautiful conversational forms that collect data and trigger your automations.</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-6 flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus size={14} /> Create your first form
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 font-medium mb-5">{forms.length} form{forms.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map((form, i) => (
                <FormCard key={form.id} form={form} index={i}
                  onDelete={() => handleDelete(form.id)}
                  onOpen={() => router.push(`/forms/${form.id}`)} />
              ))}
              <button onClick={() => setShowCreate(true)}
                className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2.5 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-gray-400 hover:text-indigo-500 min-h-[180px] group">
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-indigo-300 flex items-center justify-center transition-colors">
                  <Plus size={18} />
                </div>
                <span className="text-xs font-semibold">New form</span>
              </button>
            </div>
          </>
        )}
      </main>

      {showCreate && <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </AppShell>
  );
}
