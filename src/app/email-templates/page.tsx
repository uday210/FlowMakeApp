"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Mail, Plus, Pencil, Trash2, Clock, Tag, FileText, Loader2 } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  variables: { key: string; label: string }[];
  created_at: string;
  updated_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  esign: "bg-indigo-100 text-indigo-700",
  workflow: "bg-amber-100 text-amber-700",
  custom: "bg-gray-100 text-gray-600",
};

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const res = await fetch("/api/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled Template", category: "custom" }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.id) router.push(`/email-templates/${data.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    setDeletingId(id);
    await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Email Templates"
        subtitle="Design reusable email templates for esign notifications, workflows, and more."
        action={
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            New Template
          </button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Mail className="text-indigo-400" size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">No email templates yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first template to use in esign and workflows</p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={14} /> New Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-indigo-500" />
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.custom}`}>
                      {t.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm leading-tight mb-1">{t.name}</h3>
                  {t.description && (
                    <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{t.description}</p>
                  )}
                  {t.subject && (
                    <p className="text-xs text-gray-500 truncate mb-3">
                      <span className="font-medium">Subject:</span> {t.subject}
                    </p>
                  )}
                  {t.variables?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      <Tag size={10} className="text-gray-400 flex-shrink-0" />
                      {t.variables.slice(0, 4).map((v) => (
                        <span key={v.key} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {`{{${v.key}}}`}
                        </span>
                      ))}
                      {t.variables.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{t.variables.length - 4} more</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock size={10} />
                    {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                  <button
                    onClick={() => router.push(`/email-templates/${t.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {deletingId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
