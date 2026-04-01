"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  FileText, Plus, Upload, Loader2, CheckCircle2,
  Clock, Send, Trash2, Eye, AlertCircle, BookOpen,
  Layers, User, ChevronDown, ChevronUp,
} from "lucide-react";

interface EsignDocument {
  id: string;
  name: string;
  file_url: string;
  page_count: number;
  status: "draft" | "sent" | "completed";
  is_template: boolean;
  created_at: string;
}

interface SignerRequest {
  id: string;
  document_id: string;
  signer_email: string;
  signer_name: string;
  status: "pending" | "waiting" | "signed" | "declined";
  signing_order: number;
  created_at: string;
}

const DOC_STATUS_STYLES: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-500",
  sent:      "bg-blue-50 text-blue-600",
  completed: "bg-green-50 text-green-700",
};

const DOC_STATUS_ICONS: Record<string, React.ReactNode> = {
  draft:     <Clock size={11} />,
  sent:      <Send size={11} />,
  completed: <CheckCircle2 size={11} />,
};

const SIGNER_STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-600 border-amber-200",
  waiting:  "bg-gray-50 text-gray-400 border-gray-200",
  signed:   "bg-green-50 text-green-600 border-green-200",
  declined: "bg-red-50 text-red-500 border-red-200",
};

const SIGNER_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:  <Clock size={9} />,
  waiting:  <Clock size={9} />,
  signed:   <CheckCircle2 size={9} />,
  declined: <AlertCircle size={9} />,
};

function DocCard({
  doc,
  signers,
  onOpen,
  onDelete,
}: {
  doc: EsignDocument;
  signers: SignerRequest[];
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTemplate = doc.is_template;
  const hasSent = signers.length > 0;

  const signedCount  = signers.filter(s => s.status === "signed").length;
  const pendingCount = signers.filter(s => s.status === "pending").length;

  return (
    <div className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-sm ${
      isTemplate ? "border-violet-200 bg-violet-50/20" : "border-gray-200"
    }`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${isTemplate ? "bg-violet-100" : "bg-gray-100"}`}>
          {isTemplate
            ? <Layers size={18} className="text-violet-600" />
            : <FileText size={18} className="text-gray-500" />}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-gray-900 truncate">{doc.name}</p>
            {isTemplate && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                TEMPLATE
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {doc.page_count} page{doc.page_count !== 1 ? "s" : ""} · {new Date(doc.created_at).toLocaleDateString()}
            {hasSent && !isTemplate && (
              <span className="ml-2">
                · <span className="text-green-600 font-medium">{signedCount}</span>/<span className="font-medium">{signers.length}</span> signed
                {pendingCount > 0 && <span className="text-amber-500 ml-1">· {pendingCount} pending</span>}
              </span>
            )}
          </p>
        </div>

        {/* Status badge */}
        {!isTemplate && (
          <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${DOC_STATUS_STYLES[doc.status]}`}>
            {DOC_STATUS_ICONS[doc.status]} {doc.status}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSent && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={expanded ? "Hide signers" : "Show signers"}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          <button
            onClick={onOpen}
            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
            title="Open editor"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Expanded signers */}
      {expanded && hasSent && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {signers
            .sort((a, b) => a.signing_order - b.signing_order)
            .map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <User size={10} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-700">{s.signer_name || s.signer_email}</span>
                  {s.signer_name && <span className="text-xs text-gray-400 ml-1.5">{s.signer_email}</span>}
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${SIGNER_STATUS_STYLES[s.status]}`}>
                  {SIGNER_STATUS_ICONS[s.status]} {s.status}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<EsignDocument[]>([]);
  const [signerMap, setSignerMap] = useState<Record<string, SignerRequest[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    Promise.all([
      fetch("/api/documents").then(r => r.json()),
      fetch("/api/documents/signers").then(r => r.json()).catch(() => []),
    ]).then(([docsData, signersData]) => {
      setDocs(Array.isArray(docsData) ? docsData : []);
      if (Array.isArray(signersData)) {
        const map: Record<string, SignerRequest[]> = {};
        for (const s of signersData) {
          if (!map[s.document_id]) map[s.document_id] = [];
          map[s.document_id].push(s);
        }
        setSignerMap(map);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.pdf$/i, ""), file_path: uploadData.file_path, file_url: uploadData.file_url, page_count: 1 }),
      });
      const doc = await docRes.json();
      if (!docRes.ok) throw new Error(doc.error || "Failed to create document");
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const templates = docs.filter(d => d.is_template);
  const documents = docs.filter(d => !d.is_template);

  return (
    <AppShell>
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      <PageHeader
        title="E-Sign Documents"
        subtitle="Upload PDFs, add signature fields, and send for signing"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/help#esign"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <BookOpen size={14} /> API Docs
            </Link>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Upload PDF
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6 max-w-4xl">
        {uploadError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6">
            <AlertCircle size={14} /> {uploadError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-violet-500" size={28} />
          </div>
        ) : docs.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all group"
          >
            <Upload size={36} className="mx-auto text-gray-300 group-hover:text-violet-400 mb-4 transition-colors" />
            <p className="font-medium text-gray-500 group-hover:text-violet-600 transition-colors">Upload your first PDF</p>
            <p className="text-sm text-gray-400 mt-1">Click to select a PDF to get started</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Templates section */}
            {templates.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={14} className="text-violet-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-violet-600">Templates</h2>
                  <span className="text-xs text-gray-400">({templates.length})</span>
                </div>
                <div className="space-y-3">
                  {templates.map(doc => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      signers={signerMap[doc.id] ?? []}
                      onOpen={() => router.push(`/documents/${doc.id}`)}
                      onDelete={() => handleDelete(doc.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Documents section */}
            {documents.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-gray-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Documents</h2>
                  <span className="text-xs text-gray-400">({documents.length})</span>
                </div>
                <div className="space-y-3">
                  {documents.map(doc => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      signers={signerMap[doc.id] ?? []}
                      onOpen={() => router.push(`/documents/${doc.id}`)}
                      onDelete={() => handleDelete(doc.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
