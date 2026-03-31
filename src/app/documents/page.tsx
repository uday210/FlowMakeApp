"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  FileText, Plus, Upload, Loader2, CheckCircle2,
  Clock, Send, Trash2, Eye, AlertCircle, BookOpen,
} from "lucide-react";

interface EsignDocument {
  id: string;
  name: string;
  file_url: string;
  page_count: number;
  status: "draft" | "sent" | "completed";
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  completed: "bg-green-50 text-green-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock size={11} />,
  sent: <Send size={11} />,
  completed: <CheckCircle2 size={11} />,
};

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<EsignDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);

    try {
      // Upload file
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      // Create document record
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name.replace(/\.pdf$/i, ""),
          file_path: uploadData.file_path,
          file_url: uploadData.file_url,
          page_count: 1,
        }),
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
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <AppShell>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <PageHeader
        title="E-Sign Documents"
        subtitle="Upload PDFs, add signature fields, and send for signing"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/docs/esign"
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

      <main className="flex-1 overflow-auto px-8 py-6">
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
            <p className="font-medium text-gray-500 group-hover:text-violet-600 transition-colors">
              Upload your first PDF
            </p>
            <p className="text-sm text-gray-400 mt-1">Click to select a PDF to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow"
              >
                <div className="p-3 bg-violet-50 rounded-lg flex-shrink-0">
                  <FileText size={22} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {doc.page_count} page{doc.page_count !== 1 ? "s" : ""} ·{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[doc.status]}`}>
                  {STATUS_ICONS[doc.status]} {doc.status}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Open editor"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
