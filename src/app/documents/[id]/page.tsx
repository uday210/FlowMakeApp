"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Save, Send, Loader2, PenLine, Type, Calendar, AlignLeft,
  CheckCircle2, Clock, X, Download, Copy, Check, Link2, Users, UserPlus,
  Eye, FileText, RefreshCw, GitMerge, Layers2, ArrowDownUp, ChevronUp, ChevronDown,
} from "lucide-react";

const PDFEditorCanvas = dynamic(() => import("@/components/PDFEditorCanvas"), { ssr: false });

interface EsignField {
  id: string;
  type: "signature" | "initials" | "date" | "text";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signer_email: string;
  label: string;
  required: boolean;
}

interface EsignDoc {
  id: string;
  name: string;
  file_url: string;
  page_count: number;
  status: string;
  is_template: boolean;
}

interface Signer { email: string; name: string; order: number; group: number }

type SigningMode = "sequential" | "parallel" | "groups";

interface SignerRequest {
  id: string;
  signer_email: string;
  signer_name: string;
  status: string;
  signed_at: string | null;
  signing_order: number;
  signing_url: string | null;
  session_id: string | null;
  created_at: string;
}

const FIELD_TYPES = [
  { type: "signature" as const, label: "Signature", icon: PenLine,   color: "#4f46e5", height: 10 },
  { type: "initials"  as const, label: "Initials",  icon: Type,      color: "#0891b2", height: 8  },
  { type: "date"      as const, label: "Date",       icon: Calendar,  color: "#059669", height: 7  },
  { type: "text"      as const, label: "Text",       icon: AlignLeft, color: "#d97706", height: 7  },
];

const SIGNER_COLORS = ["#4f46e5", "#0891b2", "#d97706", "#059669", "#db2777", "#7c3aed"];

export default function DocumentEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [doc, setDoc]                     = useState<EsignDoc | null>(null);
  const [fields, setFields]               = useState<EsignField[]>([]);
  const [signers, setSigners]             = useState<Signer[]>([]);
  const [signerRequests, setSignerRequests] = useState<SignerRequest[]>([]);
  const [activeTool, setActiveTool]       = useState<EsignField["type"] | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);
  const [sending, setSending]             = useState(false);
  const [loading, setLoading]             = useState(true);
  const [pageCount, setPageCount]         = useState(1);
  const [activeSignerIdx, setActiveSignerIdx] = useState(0);
  const [isTemplate, setIsTemplate]       = useState(false);
  const [aiEnabled, setAiEnabled]         = useState(false);
  const [showStatus, setShowStatus]       = useState(false);
  const [sendSuccess, setSendSuccess]     = useState<{ email: string; url: string | null; order: number }[]>([]);
  const [copiedId, setCopiedId]           = useState<string | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string }[]>([]);
  const [emailTemplateId, setEmailTemplateId] = useState<string>("");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [newEmail, setNewEmail]           = useState("");
  const [newName, setNewName]             = useState("");
  const [editingIdx, setEditingIdx]       = useState<number | null>(null);
  const [editingName, setEditingName]     = useState(false);
  const [draftName, setDraftName]         = useState("");
  const [signingMode, setSigningMode]     = useState<SigningMode>("sequential");
  const [groupCount, setGroupCount]       = useState(1); // tracks highest group number created
  const [templateSlotCount, setTemplateSlotCount] = useState(4); // number of signer slots in template mode

  const load = useCallback(async () => {
    const [docRes, fieldsRes, statusRes] = await Promise.all([
      fetch(`/api/documents/${id}`),
      fetch(`/api/documents/${id}/fields`),
      fetch(`/api/documents/${id}/status`),
    ]);
    const docData    = await docRes.json();
    const fieldsData = await fieldsRes.json();
    const statusData = await statusRes.json();
    setDoc(docData);
    setFields(Array.isArray(fieldsData) ? fieldsData : []);
    setSignerRequests(statusData.requests || []);
    setPageCount(docData.page_count || 1);
    setIsTemplate(!!docData.is_template);
    setAiEnabled(!!docData.ai_enabled);
    setEmailTemplateId(docData.email_template_id || "");
    if (statusData.requests?.length > 0) setShowStatus(true);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh status every 10s so signing events appear without manual refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/documents/${id}/status`)
        .then(r => r.json())
        .then(d => { if (d.requests) setSignerRequests(d.requests); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((d) => setEmailTemplates(Array.isArray(d) ? d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : []));
  }, []);

  const handleEmailPreview = async () => {
    if (!emailTemplateId) return;
    setEmailPreviewLoading(true);
    const res = await fetch(`/api/email-templates/${emailTemplateId}`);
    const tmpl = await res.json();
    // Interpolate sample variables so the preview feels real
    const sampleVars: Record<string, string> = {
      signer_name:    signers[0]?.name  || "Jane Smith",
      signer_email:   signers[0]?.email || "jane@example.com",
      document_title: doc?.name         || "Document",
      signing_url:    `${window.location.origin}/sign/sample-token`,
      org_name:       "Your Organization",
      sender_name:    "Your Team",
    };
    let html: string = tmpl.html_body || "";
    Object.entries(sampleVars).forEach(([k, v]) => {
      html = html.replaceAll(`{{${k}}}`, v);
    });
    setEmailPreviewHtml(html);
    setEmailPreviewLoading(false);
  };

  // Esc cancels active tool
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveTool(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveFields = async () => {
    setSaving(true);
    await fetch(`/api/documents/${id}/fields`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    if (doc) {
      await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status, is_template: isTemplate, email_template_id: emailTemplateId || null }),
      });
    }
    setSaving(false);
  };

  const handleSend = async () => {
    const valid = signers.filter(s => s.email.trim());
    if (valid.length === 0) { alert("Add at least one recipient first."); return; }
    await saveFields();
    setSending(true);
    const res  = await fetch(`/api/documents/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signers: valid,
        email_template_id: emailTemplateId || undefined,
        mode: signingMode,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setSendSuccess(data.requests.map((r: SignerRequest) => ({
        email: r.signer_email, url: r.signing_url, order: r.signing_order,
      })));
      load();
    }
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (!name || !doc || name === doc.name) { setEditingName(false); return; }
    setDoc(d => d ? { ...d, name } : d);
    setEditingName(false);
    await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, page_count: pageCount, status: doc.status, is_template: isTemplate, email_template_id: emailTemplateId || null }),
    });
  };

  const [newGroup, setNewGroup] = useState<number>(1);

  const addRecipient = () => {
    if (!newEmail.trim()) return;
    const nextOrder = signers.length + 1;
    const grp = signingMode === "parallel" ? 1
      : signingMode === "groups" ? newGroup
      : nextOrder; // sequential: each signer is their own order
    setSigners(prev => [...prev, { email: newEmail.trim(), name: newName.trim(), order: nextOrder, group: grp }]);
    setActiveSignerIdx(signers.length);
    setNewEmail(""); setNewName(""); setAddingRecipient(false);
    setNewGroup(signingMode === "groups" ? newGroup : 1);
  };

  const removeRecipient = (idx: number) => {
    setSigners(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
    setFields(prev => prev.filter(f => f.signer_email !== signers[idx].email));
    setActiveSignerIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
  };

  const setSignerGroup = (idx: number, g: number) => {
    setSigners(prev => prev.map((s, i) => i === idx ? { ...s, group: Math.max(1, g) } : s));
  };

  // All group numbers: those with signers + any manually created empty groups
  const signerGroups = [...new Set(signers.map(s => s.group))];
  const allGroups = [...new Set([...signerGroups, ...Array.from({ length: groupCount }, (_, i) => i + 1)])].sort((a, b) => a - b);
  const existingGroups = allGroups;

  const handlePlaceField = useCallback((page: number, x: number, y: number) => {
    if (!activeTool) return;
    const ft = FIELD_TYPES.find(f => f.type === activeTool)!;
    // activeSignerIdx === -1 means "All Signers" slot
    const sEmail = activeSignerIdx === -1 ? ""
      : isTemplate ? `Signer ${activeSignerIdx + 1}`
      : (signers[activeSignerIdx]?.email || "");
    setFields(prev => [...prev, {
      id: crypto.randomUUID(), type: activeTool,
      page, x, y, width: 22, height: ft.height,
      signer_email: sEmail, label: ft.label, required: true,
    }]);
  }, [activeTool, activeSignerIdx, signers, isTemplate]);

  const handleUpdateField = useCallback((updated: EsignField) => {
    setFields(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  const handleDeleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    setSelectedField(null);
  };

  const toggleTemplate = async () => {
    const next = !isTemplate;
    setIsTemplate(next);
    setSigners([]); setFields([]);
    if (doc) {
      await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status, is_template: next }),
      });
    }
  };

  const templateSlots  = Array.from({ length: templateSlotCount }, (_, i) => ({ email: `Signer ${i + 1}`, name: `Signer ${i + 1}`, order: i + 1, group: i + 1 }));
  const displaySigners = isTemplate ? templateSlots : signers;
  // activeSignerIdx === -1 = "All Signers"
  const activeSigner   = activeSignerIdx === -1 ? null : displaySigners[activeSignerIdx];
  const activeColor    = activeSignerIdx === -1 ? "#64748b" : SIGNER_COLORS[activeSignerIdx % SIGNER_COLORS.length];
  const signerColors   = isTemplate
    ? { "": "#64748b", ...Object.fromEntries(Array.from({ length: templateSlotCount }, (_, i) => [`Signer ${i + 1}`, SIGNER_COLORS[i % SIGNER_COLORS.length]])) }
    : { "": "#64748b", ...Object.fromEntries(signers.map((s, i) => [s.email, SIGNER_COLORS[i % SIGNER_COLORS.length]])) };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-gray-400" size={28} />
    </div>
  );
  if (!doc) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Document not found.</p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-gray-200 px-4 h-12 flex items-center gap-3 flex-shrink-0 z-20 shadow-sm">
        <button onClick={() => router.push("/documents")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <FileText size={14} className="text-gray-400 flex-shrink-0" />
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="text-sm font-semibold text-gray-800 bg-white border border-violet-400 rounded px-2 py-0.5 outline-none max-w-xs w-48"
          />
        ) : (
          <button
            onClick={() => { setDraftName(doc.name); setEditingName(true); }}
            className="text-sm font-semibold text-gray-800 truncate max-w-xs hover:text-violet-600 transition-colors"
            title="Click to rename"
          >
            {doc.name}
          </button>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-4">
          <button
            onClick={() => setShowStatus(false)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              !showStatus ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setShowStatus(true)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              showStatus ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Status
            {signerRequests.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${showStatus ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"}`}>
                {signerRequests.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={toggleTemplate}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isTemplate ? "bg-violet-50 text-violet-700 border-violet-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"
          }`}
          title="Template mode: assign fields to role slots (Signer 1, 2…) then send to any email via the API"
        >
          {isTemplate ? "◆ Template" : "Make Template"}
        </button>

        <button
          onClick={async () => {
            const next = !aiEnabled;
            setAiEnabled(next);
            if (doc) {
              await fetch(`/api/documents/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status, is_template: isTemplate, ai_enabled: next }),
              });
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            aiEnabled ? "bg-amber-50 text-amber-700 border-amber-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"
          }`}
          title="Let signers chat with an AI about this document before signing"
        >
          ✦ {aiEnabled ? "AI On" : "AI Off"}
        </button>

        <button
          onClick={saveFields} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
        </button>

        {isTemplate ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700 font-medium">
            <span>◆ Template — send via API or a Scenario workflow</span>
          </div>
        ) : (
          <>
            <select
              value={emailTemplateId}
              onChange={(e) => {
                setEmailTemplateId(e.target.value);
                if (doc) fetch(`/api/documents/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status, is_template: isTemplate, email_template_id: e.target.value || null }) });
              }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500 max-w-[160px]"
              title="Optionally attach an email template — signers will be emailed automatically"
            >
              <option value="">✉ No email (URL only)</option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {emailTemplateId && (
              <button
                onClick={handleEmailPreview}
                disabled={emailPreviewLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                title="Preview the email signers will receive"
              >
                {emailPreviewLoading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                Preview Email
              </button>
            )}

            <button
              onClick={handleSend} disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              Send for Signature
            </button>
          </>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar (only when not showing status) ── */}
        {!showStatus && (
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto">

            {/* RECIPIENTS */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipients</span>
                </div>
                {!isTemplate && signingMode !== "groups" && (
                  <button
                    onClick={() => { setAddingRecipient(true); setEditingIdx(null); }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                  >
                    <UserPlus size={11} /> Add
                  </button>
                )}
                {isTemplate && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { if (templateSlotCount > 1) { if (activeSignerIdx >= templateSlotCount - 1) setActiveSignerIdx(templateSlotCount - 2); setTemplateSlotCount(c => c - 1); } }}
                      disabled={templateSlotCount <= 1}
                      className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-200 rounded disabled:opacity-30 text-xs font-bold"
                      title="Remove last signer slot"
                    >−</button>
                    <span className="text-xs text-gray-400">{templateSlotCount}</span>
                    <button
                      onClick={() => setTemplateSlotCount(c => c + 1)}
                      className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-indigo-600 border border-gray-200 rounded text-xs font-bold"
                      title="Add signer slot"
                    >+</button>
                  </div>
                )}
              </div>

              {/* Signing mode selector */}
              {!isTemplate && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">Signing mode</p>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                    {(["sequential", "parallel", "groups"] as SigningMode[]).map((m) => {
                      const icons = { sequential: ArrowDownUp, parallel: GitMerge, groups: Layers2 };
                      const labels = { sequential: "Sequential", parallel: "Parallel", groups: "Groups" };
                      const Icon = icons[m];
                      return (
                        <button key={m} onClick={() => {
                          setSigningMode(m);
                          setGroupCount(1);
                          if (m === "sequential" && activeSignerIdx === -1) setActiveSignerIdx(0);
                        }}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 transition-colors ${signingMode === m ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                          title={m === "sequential" ? "Each signer signs one after another" : m === "parallel" ? "All signers receive the link at once" : "Signers in same group sign together, groups unlock in order"}
                        >
                          <Icon size={10} /> {labels[m]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                    {signingMode === "sequential" && "Each signer signs one after another in order."}
                    {signingMode === "parallel" && "Everyone gets the link at once. Use 'All Signers' fields."}
                    {signingMode === "groups" && "Each group signs together, then the next group unlocks."}
                  </p>
                  {signingMode === "groups" && (
                    <button
                      onClick={() => setGroupCount(c => c + 1)}
                      className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <span className="text-sm leading-none">+</span> New Group
                    </button>
                  )}
                </div>
              )}

              {/* All Signers slot — shown for parallel and groups only (not sequential) */}
              {!isTemplate && signingMode !== "sequential" && (
                <button
                  onClick={() => { setActiveSignerIdx(-1); setActiveTool(null); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all mb-2 ${activeSignerIdx === -1 ? "shadow-sm" : "hover:bg-gray-50"}`}
                  style={activeSignerIdx === -1 ? { backgroundColor: "#64748b18", border: "1px solid #64748b40" } : { border: "1px solid transparent" }}
                >
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-slate-500">∀</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">All Signers</p>
                    <p className="text-xs text-gray-400">Fields filled by every signer</p>
                  </div>
                  {activeSignerIdx === -1 && <span className="text-xs font-bold text-slate-500">active</span>}
                </button>
              )}

              {displaySigners.length === 0 && !addingRecipient && signingMode !== "groups" && (
                <div className="text-center py-3">
                  <p className="text-xs text-gray-400 mb-2">No recipients yet</p>
                  <button onClick={() => setAddingRecipient(true)}
                    className="text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-lg px-3 py-1.5 w-full hover:bg-indigo-50 transition-colors">
                    + Add first recipient
                  </button>
                </div>
              )}

              {/* Signer list */}
              <div className="space-y-1">
                {signingMode === "groups" && !isTemplate
                  ? (() => {
                      const groupNums = existingGroups.length > 0 ? existingGroups : [];
                      return (
                        <>
                          {groupNums.map((g) => {
                            const groupSigners = signers.map((s, i) => ({ s, i })).filter(({ s }) => s.group === g);
                            const isAddingToThisGroup = addingRecipient && newGroup === g;
                            return (
                              <div key={g} className="mb-2 rounded-xl border border-gray-100 overflow-hidden">
                                {/* Group header */}
                                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 border-b border-indigo-100">
                                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                    Group {g}
                                  </span>
                                  <span className="text-xs text-indigo-400">· {groupSigners.length} signer{groupSigners.length !== 1 ? "s" : ""}</span>
                                  <div className="flex-1" />
                                  <button
                                    onClick={() => { setNewGroup(g); setAddingRecipient(true); setEditingIdx(null); }}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                                  >+ Add</button>
                                  <button
                                    onClick={() => {
                                      setSigners(prev => prev.filter(s => s.group !== g));
                                      if (activeSignerIdx >= 0 && signers[activeSignerIdx]?.group === g) setActiveSignerIdx(0);
                                      // shrink groupCount if this was the last group
                                      if (g === groupCount) setGroupCount(c => Math.max(1, c - 1));
                                    }}
                                    className="text-xs font-semibold text-red-400 hover:text-red-600 px-1 py-0.5 rounded hover:bg-red-50 transition-colors"
                                    title="Delete group and all its signers"
                                  >✕</button>
                                </div>
                                {/* Signers in group */}
                                <div className="p-1 space-y-0.5">
                                  {groupSigners.length === 0 && !isAddingToThisGroup && (
                                    <p className="text-xs text-gray-400 text-center py-2">No signers yet — click + Add</p>
                                  )}
                                  {groupSigners.map(({ s, i }) => {
                                    const color = SIGNER_COLORS[i % SIGNER_COLORS.length];
                                    const isActive = activeSignerIdx === i;
                                    return (
                                      <div key={i}>
                                        {editingIdx === i ? (
                                          <div className="space-y-1.5 p-2 rounded-lg border border-indigo-200 bg-indigo-50">
                                            <input autoFocus type="email" placeholder="Email address" value={s.email}
                                              onChange={e => setSigners(prev => prev.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                                            <input type="text" placeholder="Name (optional)" value={s.name}
                                              onChange={e => setSigners(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-gray-500">Move to group:</span>
                                              <select value={s.group} onChange={e => setSignerGroup(i, Number(e.target.value))}
                                                className="flex-1 text-xs border border-gray-200 rounded px-1 py-1 outline-none bg-white">
                                                {existingGroups.map(gn => (
                                                  <option key={gn} value={gn}>Group {gn}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="flex gap-1">
                                              <button onClick={() => setEditingIdx(null)} className="flex-1 text-xs bg-indigo-600 text-white rounded py-1 font-semibold">Done</button>
                                              <button onClick={() => { setEditingIdx(null); removeRecipient(i); }} className="text-xs text-red-500 px-2">Remove</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all group/signer ${isActive ? "shadow-sm" : "hover:bg-gray-50"}`}
                                            style={isActive ? { backgroundColor: `${color}12`, border: `1px solid ${color}40` } : { border: "1px solid transparent" }}
                                            onClick={() => { setActiveSignerIdx(i); setActiveTool(null); }}
                                          >
                                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: color }}>{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium text-gray-800 truncate">{s.name || s.email.split("@")[0]}</p>
                                              <p className="text-xs text-gray-400 truncate">{s.email}</p>
                                            </div>
                                            {isActive && <span className="text-xs font-bold flex-shrink-0" style={{ color }}>active</span>}
                                            <button onClick={e => { e.stopPropagation(); setEditingIdx(i); }}
                                              className="opacity-0 group-hover/signer:opacity-100 text-xs text-gray-400 hover:text-gray-600 transition-opacity">edit</button>
                                            <button onClick={e => { e.stopPropagation(); removeRecipient(i); if (activeSignerIdx === i) setActiveSignerIdx(0); }}
                                              className="opacity-0 group-hover/signer:opacity-100 text-xs text-red-400 hover:text-red-600 transition-opacity ml-0.5">✕</button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {/* Inline add form inside this group */}
                                  {isAddingToThisGroup && (
                                    <div className="space-y-1.5 p-2 rounded-lg border border-indigo-200 bg-indigo-50">
                                      <input autoFocus type="email" placeholder="Email address *" value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") addRecipient(); if (e.key === "Escape") { setAddingRecipient(false); setNewEmail(""); setNewName(""); } }}
                                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                                      <input type="text" placeholder="Name (optional)" value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") addRecipient(); if (e.key === "Escape") { setAddingRecipient(false); setNewEmail(""); setNewName(""); } }}
                                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                                      <div className="flex gap-1">
                                        <button onClick={addRecipient} className="flex-1 text-xs bg-indigo-600 text-white rounded py-1 font-semibold">Add</button>
                                        <button onClick={() => { setAddingRecipient(false); setNewEmail(""); setNewName(""); }} className="text-xs text-gray-400 px-2">Cancel</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()
                  : displaySigners.map((s, i) => {
                      const color = SIGNER_COLORS[i % SIGNER_COLORS.length];
                      const isActive = activeSignerIdx === i;
                      return (
                        <div key={i}>
                          {editingIdx === i && !isTemplate ? (
                            <div className="space-y-1.5 p-2 rounded-lg border border-indigo-200 bg-indigo-50">
                              <input autoFocus type="email" placeholder="Email address" value={signers[i].email}
                                onChange={e => setSigners(prev => prev.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                              <input type="text" placeholder="Name (optional)" value={signers[i].name}
                                onChange={e => setSigners(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                              <div className="flex gap-1">
                                <button onClick={() => setEditingIdx(null)} className="flex-1 text-xs bg-indigo-600 text-white rounded py-1 font-semibold">Done</button>
                                <button onClick={() => { setEditingIdx(null); removeRecipient(i); }} className="text-xs text-red-500 hover:text-red-600 px-2">Remove</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setActiveSignerIdx(i); setActiveTool(null); }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all group ${isActive ? "shadow-sm" : "hover:bg-gray-50"}`}
                              style={isActive ? { backgroundColor: `${color}12`, border: `1px solid ${color}40` } : { border: "1px solid transparent" }}
                            >
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                                {signingMode === "parallel" ? "=" : i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{s.name || s.email.split("@")[0]}</p>
                                {!isTemplate && <p className="text-xs text-gray-400 truncate">{s.email}</p>}
                              </div>
                              {isActive && <span className="text-xs font-bold ml-auto flex-shrink-0" style={{ color }}>active</span>}
                              {!isTemplate && !isActive && (
                                <button onClick={e => { e.stopPropagation(); setEditingIdx(i); }}
                                  className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 transition-opacity">
                                  edit
                                </button>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                }
              </div>

              {/* Inline add form — not shown in groups mode (each group has its own) */}
              {addingRecipient && !isTemplate && signingMode !== "groups" && (
                <div className="mt-2 space-y-1.5 p-2 rounded-lg border border-indigo-200 bg-indigo-50">
                  <input autoFocus type="email" placeholder="Email address *" value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addRecipient(); if (e.key === "Escape") { setAddingRecipient(false); setNewEmail(""); setNewName(""); } }}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                  <input type="text" placeholder="Name (optional)" value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addRecipient(); if (e.key === "Escape") { setAddingRecipient(false); setNewEmail(""); setNewName(""); } }}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                  <div className="flex gap-1">
                    <button onClick={addRecipient} disabled={!newEmail.trim()} className="flex-1 text-xs bg-indigo-600 text-white rounded py-1 font-semibold disabled:opacity-40">Add</button>
                    <button onClick={() => { setAddingRecipient(false); setNewEmail(""); setNewName(""); }} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* FIELD TYPES */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</span>
                {activeSigner && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full ml-1 truncate max-w-[120px]"
                    style={{ backgroundColor: `${activeColor}18`, color: activeColor }}>
                    {activeSigner.name || activeSigner.email.split("@")[0]}
                  </span>
                )}
              </div>

              {displaySigners.length === 0 && activeSignerIdx !== -1 ? (
                <p className="text-xs text-gray-400 text-center py-2">Add a recipient or select &quot;All Signers&quot; to place fields</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FIELD_TYPES.map(ft => {
                      const isActive = activeTool === ft.type;
                      return (
                        <button
                          key={ft.type}
                          onClick={() => setActiveTool(isActive ? null : ft.type)}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-center transition-all ${
                            isActive
                              ? "text-white border-transparent shadow-md"
                              : "text-gray-600 border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                          }`}
                          style={isActive ? { backgroundColor: ft.color, borderColor: ft.color } : {}}
                        >
                          <ft.icon size={16} />
                          <span className="text-xs font-semibold leading-none">{ft.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!activeTool && (
                    <p className="text-xs text-gray-400 text-center mt-2">Select a field type, then click the document</p>
                  )}
                </>
              )}
            </div>

            {/* PLACED FIELDS */}
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Placed Fields</span>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{fields.length}</span>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-gray-400">No fields yet</p>
                  <p className="text-xs text-gray-300 mt-1">1. Pick a recipient → 2. Pick a field → 3. Click the PDF</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {fields.map(f => {
                    const ft        = FIELD_TYPES.find(x => x.type === f.type)!;
                    const sIdx      = displaySigners.findIndex(s => s.email === f.signer_email);
                    const color     = sIdx >= 0 ? SIGNER_COLORS[sIdx % SIGNER_COLORS.length] : ft.color;
                    const isSelected = selectedField === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedField(f.id === selectedField ? null : f.id)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${isSelected ? "bg-gray-100" : "hover:bg-gray-50"}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <ft.icon size={10} style={{ color }} className="flex-shrink-0" />
                        <span className="flex-1 truncate text-gray-600">{f.label} · p{f.page}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteField(f.id); }}
                          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Placement banner */}
          {activeTool && (activeSigner || activeSignerIdx === -1) && !showStatus && (
            <div className="px-4 py-2.5 flex items-center gap-3 flex-shrink-0 shadow-sm" style={{ backgroundColor: activeColor }}>
              {(() => { const Icon = FIELD_TYPES.find(f => f.type === activeTool)!.icon; return <Icon size={14} className="text-white flex-shrink-0" />; })()}
              <span className="text-sm font-semibold text-white flex-1">
                Placing <span className="capitalize">{activeTool}</span> for{" "}
                <span className="underline underline-offset-2">{activeSignerIdx === -1 ? "All Signers" : (activeSigner!.name || activeSigner!.email)}</span>
                {" "}— click anywhere on the document
              </span>
              <button onClick={() => setActiveTool(null)} className="text-white/80 hover:text-white flex items-center gap-1 text-xs font-medium">
                <X size={13} /> Esc to cancel
              </button>
            </div>
          )}

          {/* PDF editor */}
          {!showStatus && (
            <div className="flex-1 overflow-auto">
              <PDFEditorCanvas
                fileUrl={`/api/documents/${id}/pdf`}
                fields={fields}
                activeTool={activeTool}
                selectedField={selectedField}
                onPlaceField={handlePlaceField}
                onUpdateField={handleUpdateField}
                onSelectField={setSelectedField}
                onDeleteField={handleDeleteField}
                onPageCountChange={n => setPageCount(n)}
                signerColors={signerColors}
              />
            </div>
          )}

          {/* Status view */}
          {showStatus && (() => {
            // Group requests by session_id
            const groupMap = new Map<string, typeof signerRequests>();
            for (const r of signerRequests) {
              const key = r.session_id ?? r.id;
              if (!groupMap.has(key)) groupMap.set(key, []);
              groupMap.get(key)!.push(r);
            }
            const groups = Array.from(groupMap.entries())
              .map(([sessionId, reqs]) => ({ sessionId, reqs: reqs.sort((a, b) => a.signing_order - b.signing_order) }))
              .sort((a, b) => new Date(a.reqs[0].created_at).getTime() - new Date(b.reqs[0].created_at).getTime());

            return (
              <div className="flex-1 overflow-auto">
                <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold text-gray-800">Signing Status</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {groups.length} sending group{groups.length !== 1 ? "s" : ""} · {signerRequests.filter(r => r.status === "signed").length} of {signerRequests.length} total signed
                      </p>
                    </div>
                  <button
                    onClick={async () => {
                      setRefreshing(true);
                      const d = await fetch(`/api/documents/${id}/status`).then(r => r.json());
                      if (d.requests) setSignerRequests(d.requests);
                      setRefreshing(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    title="Refresh status"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                  </button>
                  </div>

                  {signerRequests.length === 0 ? (
                    <div className="text-center py-16">
                      <Users size={28} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No signing requests yet</p>
                      <p className="text-xs text-gray-400 mt-1">Add recipients and click Send for Signature</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {groups.map(({ sessionId, reqs }, gi) => {
                        const allSigned   = reqs.every(r => r.status === "signed");
                        const someSigned  = reqs.some(r => r.status === "signed");
                        const signedCount = reqs.filter(r => r.status === "signed").length;
                        const sentAt      = new Date(reqs[0].created_at);
                        const dlBase      = `/api/documents/${id}/download?session_id=${sessionId}`;
                        // Parallel = all signers share the same signing_order; each needs their own copy
                        const isParallelSession = reqs.length > 1 && reqs.every(r => r.signing_order === reqs[0].signing_order);

                        return (
                          <div key={sessionId} className={`rounded-2xl border overflow-hidden ${allSigned ? "border-green-200" : "border-gray-200"}`}>
                            {/* Group header */}
                            <div className={`px-4 py-3 flex items-center justify-between gap-3 ${allSigned ? "bg-green-50" : "bg-gray-50"}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${allSigned ? "bg-green-500" : "bg-indigo-500"}`}>
                                  {gi + 1}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">
                                    Group {gi + 1} · {reqs.length} signer{reqs.length !== 1 ? "s" : ""}
                                    {allSigned && <span className="ml-2 text-green-600">· All signed</span>}
                                    {!allSigned && someSigned && <span className="ml-2 text-amber-600">· {signedCount}/{reqs.length} signed</span>}
                                  </p>
                                  <p className="text-xs text-gray-400">Sent {sentAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                                </div>
                              </div>
                              {/* Group download buttons */}
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {someSigned && !allSigned && (
                                  <a href={dlBase} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">
                                    <Download size={10} /> Signed so far
                                  </a>
                                )}
                                {allSigned && (
                                  <a href={dlBase} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700">
                                    <Download size={10} /> Full Signed PDF
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-100 h-1">
                              <div className="bg-green-500 h-1 transition-all" style={{ width: `${(signedCount / reqs.length) * 100}%` }} />
                            </div>

                            {/* Signers */}
                            <div className="divide-y divide-gray-100">
                              {reqs.map(r => {
                                const isSigned  = r.status === "signed";
                                const isPending = r.status === "pending";
                                return (
                                  <div key={r.id} className={`px-4 py-3 ${isSigned ? "bg-white" : isPending ? "bg-white" : "bg-gray-50 opacity-70"}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSigned ? "bg-green-500 text-white" : isPending ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                                        {isSigned ? <Check size={13} /> : r.signing_order}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800">{r.signer_name || r.signer_email}</p>
                                        <p className="text-xs text-gray-400">{r.signer_email}</p>
                                      </div>
                                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isSigned ? "bg-green-100 text-green-700" : isPending ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                                        {isSigned ? "Signed" : isPending ? "Pending" : "Waiting"}
                                      </span>
                                      {/* Individual download — parallel: per-signer copy; sequential: accumulated PDF */}
                                      {isSigned && (
                                        <a
                                          href={isParallelSession
                                            ? `/api/documents/${id}/download?request_id=${r.id}`
                                            : `${dlBase}&until_order=${r.signing_order}`}
                                          target="_blank" rel="noreferrer"
                                          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                                          <Download size={10} /> {isParallelSession ? "Copy" : "PDF"}
                                        </a>
                                      )}
                                    </div>
                                    {isSigned && r.signed_at && (
                                      <p className="text-xs text-green-600 flex items-center gap-1.5 pl-11 mt-1.5">
                                        <CheckCircle2 size={10} /> Signed {new Date(r.signed_at).toLocaleString()}
                                      </p>
                                    )}
                                    {isPending && r.signing_url && (
                                      <div className="ml-11 mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                                        <p className="text-xs font-semibold text-indigo-700 mb-1.5 flex items-center gap-1">
                                          <Link2 size={11} /> Signing link — share with recipient
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <code className="flex-1 text-xs text-indigo-600 bg-white border border-indigo-100 rounded px-2 py-1 truncate">{r.signing_url}</code>
                                          <button
                                            onClick={() => { navigator.clipboard.writeText(r.signing_url!); setCopiedId(r.id); setTimeout(() => setCopiedId(null), 2000); }}
                                            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border flex-shrink-0 transition-colors ${copiedId === r.id ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"}`}
                                          >
                                            {copiedId === r.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {r.status === "waiting" && (
                                      <p className="text-xs text-gray-400 flex items-center gap-1.5 pl-11 mt-1.5">
                                        <Clock size={11} /> Waiting for signer #{r.signing_order - 1} to sign first
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Email preview modal ── */}
      {emailPreviewHtml && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-800 text-sm">Email Preview</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sample variables filled in — actual email uses real signer data</p>
              </div>
              <button onClick={() => setEmailPreviewHtml(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe
                srcDoc={emailPreviewHtml}
                className="w-full border-0"
                style={{ minHeight: 500 }}
                sandbox="allow-same-origin"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Send success modal ── */}
      {sendSuccess.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Sent successfully!</h3>
                <p className="text-xs text-gray-500">Share each link with the corresponding recipient</p>
              </div>
            </div>
            <div className="space-y-2">
              {sendSuccess.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: SIGNER_COLORS[i % SIGNER_COLORS.length] }}>
                      {s.order}
                    </span>
                    <span className="text-xs font-semibold text-gray-700 truncate">{s.email}</span>
                  </div>
                  {s.url && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-indigo-600 bg-white border border-gray-200 rounded px-2 py-1 truncate">{s.url}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(s.url!); setCopiedId(`m-${i}`); setTimeout(() => setCopiedId(null), 2000); }}
                        className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg border font-semibold transition-colors ${copiedId === `m-${i}` ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"}`}
                      >
                        {copiedId === `m-${i}` ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => { setSendSuccess([]); setShowStatus(true); }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              View Status →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
