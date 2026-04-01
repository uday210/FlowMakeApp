"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  FileText, Upload, Trash2, Loader2, BookOpen, Plus,
  LayoutTemplate, Clock, Tag, Zap, ChevronRight, AlertTriangle, RefreshCw,
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

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-600",
  contract: "bg-blue-100 text-blue-700",
  invoice: "bg-green-100 text-green-700",
  hr: "bg-violet-100 text-violet-700",
  legal: "bg-red-100 text-red-700",
  proposal: "bg-amber-100 text-amber-700",
  nda: "bg-orange-100 text-orange-700",
  "offer-letter": "bg-teal-100 text-teal-700",
};

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocTemplatesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState("");

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCat, setFormCat] = useState("general");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/doc-templates");
    const d = await r.json();
    setTemplates(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  function handleFilePick(picked: File | null) {
    if (!picked) return;
    if (!picked.name.endsWith(".docx")) {
      setUploadErr("Only .docx files are supported");
      return;
    }
    setFile(picked);
    if (!formName) setFormName(picked.name.replace(".docx", ""));
    setUploadErr("");
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", formName || file.name.replace(".docx", ""));
    fd.append("description", formDesc);
    fd.append("category", formCat);
    const res = await fetch("/api/doc-templates", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setUploadErr(data.error ?? "Upload failed"); return; }
    setShowUpload(false);
    setFile(null); setFormName(""); setFormDesc(""); setFormCat("general");
    router.push(`/doc-templates/${data.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? All generated documents will still be accessible.")) return;
    setDeletingId(id);
    await fetch(`/api/doc-templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
    setDeletingId(null);
  }

  const fieldCount = (t: DocTemplate) =>
    t.detected_fields?.filter(f => f.kind === "field").length ?? 0;
  const loopCount = (t: DocTemplate) =>
    t.detected_fields?.filter(f => f.kind === "loop_start").length ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Doc Composer"
        subtitle="Upload Word templates, merge data, generate documents"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/help#doc-composer")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <BookOpen size={13} /> Template Guide
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors"
            >
              <Upload size={13} /> Upload Template
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8">

        {/* Upload panel */}
        {showUpload && (
          <div className="mb-6 bg-white border-2 border-dashed border-violet-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800">Upload Word Template</h2>
              <button onClick={() => { setShowUpload(false); setFile(null); setUploadErr(""); }}
                className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFilePick(e.dataTransfer.files[0] ?? null); }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors mb-4 ${
                dragOver ? "border-violet-400 bg-violet-50" : file ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/30"
              }`}
            >
              <input ref={fileRef} type="file" accept=".docx" className="hidden"
                onChange={e => handleFilePick(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={20} className="text-green-500" />
                  <span className="text-sm font-semibold text-green-700">{file.name}</span>
                  <span className="text-xs text-gray-400">({formatBytes(file.size)})</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-500">Drop your .docx file here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Word documents with merge fields like <code className="bg-gray-100 px-1 rounded">{"{field_name}"}</code></p>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Template Name</label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Service Agreement"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
                <select value={formCat} onChange={e => setFormCat(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 bg-white capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs font-medium text-gray-600 block mb-1">Description <span className="text-gray-400">(optional)</span></label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  placeholder="What is this template for?"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400" />
              </div>
            </div>

            {uploadErr && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 mb-3">
                <AlertTriangle size={12} /> {uploadErr}
              </p>
            )}

            <button onClick={handleUpload} disabled={!file || uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Uploading & detecting fields…" : "Upload Template"}
            </button>
          </div>
        )}

        {/* Template grid */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : templates.length === 0 ? (
          <div className="text-center py-24">
            <LayoutTemplate size={40} className="text-gray-200 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-gray-500 mb-1">No templates yet</h2>
            <p className="text-sm text-gray-400 mb-4">
              Upload a Word (.docx) file with <code className="bg-gray-100 px-1 rounded text-xs">{"{merge_fields}"}</code> to get started
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                <Upload size={13} /> Upload Template
              </button>
              <button onClick={() => router.push("/help#doc-composer")}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                <BookOpen size={13} /> Read the Guide
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => router.push(`/doc-templates/${t.id}`)}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-violet-600" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${catColor(t.category)}`}>
                      {t.category}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 mb-1 truncate">{t.name}</h3>
                  {t.description && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">{t.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Tag size={9} /> {fieldCount(t)} field{fieldCount(t) !== 1 ? "s" : ""}
                    </span>
                    {loopCount(t) > 0 && (
                      <span className="flex items-center gap-1">
                        <RefreshCw size={9} /> {loopCount(t)} loop{loopCount(t) !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Zap size={9} /> {t.usage_count} generated
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={9} /> {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-300">{t.file_name} · {formatBytes(t.file_size)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                        disabled={deletingId === t.id}
                        className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      >
                        {deletingId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-violet-500 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add new card */}
            <button onClick={() => setShowUpload(true)}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/30 transition-colors min-h-[160px]">
              <Plus size={20} className="text-gray-300" />
              <span className="text-xs font-medium text-gray-400">Upload new template</span>
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
