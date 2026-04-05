"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  FileText, Upload, Trash2, Loader2, BookOpen, Plus,
  LayoutTemplate, Clock, Tag, Zap, AlertTriangle, X,
  Check, RefreshCw, Play, ChevronRight,
} from "lucide-react";

interface DocTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  file_name: string;
  file_size: number;
  detected_fields: { key: string; path: string; kind: string }[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ["general", "contract", "invoice", "hr", "legal", "proposal", "nda", "offer-letter"];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  general:       { label: "General",      color: "text-gray-600",   bg: "bg-gray-100" },
  contract:      { label: "Contract",     color: "text-blue-700",   bg: "bg-blue-100" },
  invoice:       { label: "Invoice",      color: "text-green-700",  bg: "bg-green-100" },
  hr:            { label: "HR",           color: "text-violet-700", bg: "bg-violet-100" },
  legal:         { label: "Legal",        color: "text-red-700",    bg: "bg-red-100" },
  proposal:      { label: "Proposal",     color: "text-amber-700",  bg: "bg-amber-100" },
  nda:           { label: "NDA",          color: "text-orange-700", bg: "bg-orange-100" },
  "offer-letter":{ label: "Offer Letter", color: "text-teal-700",   bg: "bg-teal-100" },
};

const DOC_ACCENT: Record<string, string> = {
  general: "#6366f1", contract: "#3b82f6", invoice: "#22c55e",
  hr: "#8b5cf6", legal: "#ef4444", proposal: "#f59e0b",
  nda: "#f97316", "offer-letter": "#14b8a6",
};

function catMeta(cat: string) {
  return CATEGORY_META[cat] ?? CATEGORY_META.general;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Word-document style SVG icon
function DocIcon({ color = "#6366f1" }: { color?: string }) {
  return (
    <svg viewBox="0 0 32 40" width="32" height="40" fill="none">
      <path d="M2 0h20l10 10v26a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2A2 2 0 0 1 2 0z" fill={color + "18"} />
      <path d="M22 0l10 10H24a2 2 0 0 1-2-2V0z" fill={color + "40"} />
      <path d="M6 18h20M6 23h16M6 13h12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Upload modal ───────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("general");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  function handlePick(picked: File | null) {
    if (!picked) return;
    if (!picked.name.endsWith(".docx")) { setErr("Only .docx files are supported"); return; }
    setFile(picked);
    if (!name) setName(picked.name.replace(".docx", ""));
    setErr("");
  }

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    setErr("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name || file.name.replace(".docx", ""));
    fd.append("description", desc);
    fd.append("category", cat);
    const res = await fetch("/api/doc-templates", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setErr(data.error ?? "Upload failed"); return; }
    onSuccess(data.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <Upload size={14} className="text-violet-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Upload Word Template</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-auto">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handlePick(e.dataTransfer.files[0] ?? null); }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              dragOver ? "border-violet-400 bg-violet-50" :
              file    ? "border-emerald-400 bg-emerald-50" :
                        "border-gray-200 hover:border-violet-300 hover:bg-violet-50/30"
            }`}
          >
            <input ref={fileRef} type="file" accept=".docx" className="hidden"
              onChange={e => handlePick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Check size={18} className="text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-1">
                  <Upload size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Drop your .docx file here</p>
                <p className="text-xs text-gray-400">or click to browse</p>
                <p className="text-xs text-gray-300 mt-1">
                  Use <code className="bg-gray-100 px-1 rounded font-mono">{"{field_name}"}</code> in Word for merge fields
                </p>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Template name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Service Agreement"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Category</label>
              <select value={cat} onChange={e => setCat(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 bg-white capitalize">
                {CATEGORIES.map(c => <option key={c} value={c}>{catMeta(c).label}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Description <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="What is this template for?"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </div>
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertTriangle size={12} /> {err}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={() => window.open("/help#doc-composer", "_blank")}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <BookOpen size={12} /> Template guide
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 font-medium hover:text-gray-700">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={!file || uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Detecting fields…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Template card ──────────────────────────────────────────────────────────────

function TemplateCard({ t, onDelete, onOpen, onGenerate, deleting }: {
  t: DocTemplate;
  onDelete: () => void;
  onOpen: () => void;
  onGenerate: () => void;
  deleting: boolean;
}) {
  const meta = catMeta(t.category);
  const accent = DOC_ACCENT[t.category] ?? "#6366f1";
  const fieldCount = t.detected_fields?.filter(f => f.kind === "field").length ?? 0;
  const loopCount  = t.detected_fields?.filter(f => f.kind === "loop_start").length ?? 0;

  return (
    <div onClick={onOpen}
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer group flex flex-col">
      {/* Colored top strip */}
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <div className="p-5 flex flex-col flex-1">
        {/* Icon + badge row */}
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 rounded-xl" style={{ backgroundColor: accent + "12" }}>
            <DocIcon color={accent} />
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* Name + description */}
        <h3 className="text-sm font-bold text-gray-900 mb-1 truncate">{t.name}</h3>
        {t.description
          ? <p className="text-xs text-gray-400 line-clamp-2 mb-3">{t.description}</p>
          : <p className="text-xs text-gray-300 italic mb-3">No description</p>
        }

        {/* Stats pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">
            <Tag size={9} /> {fieldCount} field{fieldCount !== 1 ? "s" : ""}
          </span>
          {loopCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              <RefreshCw size={9} /> {loopCount} loop{loopCount !== 1 ? "s" : ""}
            </span>
          )}
          {t.usage_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
              <Zap size={9} /> {t.usage_count}×
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <Clock size={9} />
            {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={onGenerate}
              className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50 opacity-0 group-hover:opacity-100 transition-all">
              <Play size={10} /> Generate
            </button>
            <button onClick={onDelete} disabled={deleting}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50">
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
            <ChevronRight size={13} className="text-gray-300 group-hover:text-violet-400 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DocTemplatesPage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/doc-templates");
    const d = await r.json();
    setTemplates(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? Generated documents will still be accessible.")) return;
    setDeletingId(id);
    await fetch(`/api/doc-templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
    setDeletingId(null);
  }

  return (
    <AppShell>
      <PageHeader
        title="Doc Composer"
        subtitle="Upload Word templates with merge fields, fill data, generate DOCX or PDF"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/help#doc-composer")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <BookOpen size={13} /> Guide
            </button>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors shadow-sm">
              <Upload size={13} /> Upload Template
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <div className="w-12 h-14 bg-gray-100 rounded-xl" />
                    <div className="w-16 h-5 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 rounded-3xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-5 shadow-sm">
              <LayoutTemplate size={32} className="text-violet-500" />
            </div>
            <h2 className="text-base font-bold text-gray-800 mb-2">No templates yet</h2>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-6">
              Upload a Word (.docx) file with{" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs text-gray-600">{"{merge_fields}"}</code>{" "}
              to start generating documents automatically.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm">
                <Upload size={14} /> Upload Template
              </button>
              <button onClick={() => router.push("/help#doc-composer")}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                <BookOpen size={14} /> Read the Guide
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 font-medium mb-5">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map(t => (
                <TemplateCard key={t.id} t={t}
                  deleting={deletingId === t.id}
                  onOpen={() => router.push(`/doc-templates/${t.id}`)}
                  onGenerate={() => router.push(`/doc-templates/${t.id}?tab=test`)}
                  onDelete={() => handleDelete(t.id)}
                />
              ))}
              <button onClick={() => setShowUpload(true)}
                className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2.5 hover:border-violet-300 hover:bg-violet-50/40 transition-all text-gray-400 hover:text-violet-500 min-h-[200px] group">
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-violet-300 flex items-center justify-center transition-colors">
                  <Plus size={18} />
                </div>
                <span className="text-xs font-semibold">Upload template</span>
              </button>
            </div>
          </>
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={id => router.push(`/doc-templates/${id}`)}
        />
      )}
    </AppShell>
  );
}
