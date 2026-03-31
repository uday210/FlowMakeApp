"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Save, Send, Loader2, Plus, Trash2,
  PenLine, Type, Calendar, AlignLeft, UserPlus,
  CheckCircle2, Clock, Users, Eye, X, Download, Copy, Check, Link2,
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

interface Signer { email: string; name: string; order: number }

interface SignerRequest {
  id: string;
  signer_email: string;
  signer_name: string;
  status: string; // 'waiting' | 'pending' | 'signed'
  signed_at: string | null;
  signing_order: number;
  signing_url: string | null;
}

const FIELD_TYPES = [
  { type: "signature", label: "Signature", icon: PenLine, color: "#4f46e5", height: 10 },
  { type: "initials",  label: "Initials",  icon: Type,    color: "#0891b2", height: 8  },
  { type: "date",      label: "Date",      icon: Calendar, color: "#059669", height: 7  },
  { type: "text",      label: "Text",      icon: AlignLeft, color: "#d97706", height: 7 },
] as const;

// Per-signer color palette (distinct colors per signer order)
const SIGNER_COLORS = ["#4f46e5", "#0891b2", "#d97706", "#059669", "#db2777", "#7c3aed"];


type Tab = "editor" | "signers" | "status";

export default function DocumentEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [doc, setDoc] = useState<EsignDoc | null>(null);
  const [fields, setFields] = useState<EsignField[]>([]);
  const [signers, setSigners] = useState<Signer[]>([{ email: "", name: "", order: 1 }]);
  const [signerRequests, setSignerRequests] = useState<SignerRequest[]>([]);
  const [tab, setTab] = useState<Tab>("editor");
  const [activeTool, setActiveTool] = useState<EsignField["type"] | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendSuccess, setSendSuccess] = useState<{ email: string; url: string | null; order: number; status: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [activeSignerEmail, setActiveSignerEmail] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);

  const load = useCallback(async () => {
    const [docRes, fieldsRes, statusRes] = await Promise.all([
      fetch(`/api/documents/${id}`),
      fetch(`/api/documents/${id}/fields`),
      fetch(`/api/documents/${id}/status`),
    ]);
    const docData = await docRes.json();
    const fieldsData = await fieldsRes.json();
    const statusData = await statusRes.json();

    setDoc(docData);
    setFields(fieldsData);
    setSignerRequests(statusData.requests || []);
    setPageCount(docData.page_count || 1);
    setIsTemplate(!!docData.is_template);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (signers[0]?.email) setActiveSignerEmail(signers[0].email);
  }, [signers]);

  const handleSaveFields = async () => {
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
        body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status, is_template: isTemplate }),
      });
    }
    setSaving(false);
  };

  const toggleTemplate = async () => {
    const next = !isTemplate;
    setIsTemplate(next);
    if (doc) {
      await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status, is_template: next }),
      });
    }
  };

  const handleSend = async () => {
    const validSigners = signers.filter((s) => s.email.trim());
    if (validSigners.length === 0) { setTab("signers"); return; }
    await handleSaveFields();
    setSending(true);
    const res = await fetch(`/api/documents/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signers: validSigners.map((s) => ({ email: s.email, name: s.name, order: s.order })) }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setSendSuccess(data.requests.map((r: { signer_email: string; signing_url: string | null; signing_order: number; status: string }) => ({
        email: r.signer_email,
        url: r.signing_url,
        order: r.signing_order,
        status: r.status,
      })));
      setTab("status");
      load();
    }
  };

  const handlePageCountChange = (n: number) => setPageCount(n);

  const handlePlaceField = useCallback((page: number, x: number, y: number) => {
    if (!activeTool) return;
    const ft = FIELD_TYPES.find((f) => f.type === activeTool)!;
    const newField: EsignField = {
      id: crypto.randomUUID(),
      type: activeTool,
      page,
      x,
      y,
      width: 22,
      height: ft.height,
      signer_email: activeSignerEmail,
      label: ft.label,
      required: true,
    };
    setFields((prev) => [...prev, newField]);
  }, [activeTool, activeSignerEmail]);

  const handleUpdateField = useCallback((updated: EsignField) => {
    setFields((prev) => prev.map((f) => f.id === updated.id ? updated : f));
  }, []);

  const handleDeleteField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    setSelectedField(null);
  };

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

  const validSigners = signers.filter((s) => s.email.trim());

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 z-20">
        <button onClick={() => router.push("/documents")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">{doc.name}</span>
        <div className="flex-1" />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["editor", "signers", "status"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                tab === t ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "signers" ? `Signers (${validSigners.length})` : t}
            </button>
          ))}
        </div>

        {/* Template toggle */}
        <button
          onClick={toggleTemplate}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isTemplate
              ? "bg-violet-600 text-white border-violet-600"
              : "text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
          title={isTemplate ? "Template mode: fields use role slots (Signer 1, Signer 2…). Send via API with dynamic emails." : "Enable template mode"}
        >
          {isTemplate ? "Template" : "Make Template"}
        </button>
        <button onClick={handleSaveFields} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
        </button>
        <button onClick={handleSend} disabled={sending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar — only shown on editor tab */}
        {tab === "editor" && (
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto">

            {/* Step 1 — Pick signer / role */}
            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Step 1 · {isTemplate ? "Pick role slot" : "Pick signer"}
              </p>
              {isTemplate && (
                <p className="text-[9px] text-violet-500 mb-2">Template mode — fields use role slots</p>
              )}
              {isTemplate ? (
                // In template mode, show role slots directly (no signers needed)
                <div className="space-y-1">
                  {[1, 2, 3, 4].map((n) => {
                    const role = `Signer ${n}`;
                    const color = SIGNER_COLORS[(n - 1) % SIGNER_COLORS.length];
                    const isActive = activeSignerEmail === role;
                    return (
                      <button
                        key={role}
                        onClick={() => setActiveSignerEmail(role)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${
                          isActive ? "font-semibold" : "hover:bg-gray-50 text-gray-600"
                        }`}
                        style={isActive ? { backgroundColor: `${color}18`, color } : {}}
                      >
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                          {n}
                        </span>
                        <span>{role}</span>
                        {isActive && <span className="ml-auto text-[9px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ) : validSigners.length === 0 ? (
                <button
                  onClick={() => setTab("signers")}
                  className="w-full text-[11px] text-indigo-600 hover:text-indigo-700 py-1.5 text-center border border-dashed border-indigo-300 rounded-lg"
                >
                  + Add signers first
                </button>
              ) : (
                <div className="space-y-1">
                  {validSigners.map((s, i) => {
                    const color = SIGNER_COLORS[i % SIGNER_COLORS.length];
                    const isActive = activeSignerEmail === s.email;
                    return (
                      <button
                        key={s.email}
                        onClick={() => setActiveSignerEmail(s.email)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${
                          isActive ? "font-semibold" : "hover:bg-gray-50 text-gray-600"
                        }`}
                        style={isActive ? { backgroundColor: `${color}18`, color } : {}}
                      >
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                          {i + 1}
                        </span>
                        <span className="truncate">{s.name || s.email.split("@")[0]}</span>
                        {isActive && <span className="ml-auto text-[9px] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2 — Pick field type */}
            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Step 2 · Field type
              </p>
              <div className="space-y-1">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.type}
                    onClick={() => setActiveTool(activeTool === ft.type ? null : ft.type)}
                    disabled={validSigners.length === 0}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                      activeTool === ft.type ? "text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                    style={activeTool === ft.type ? { backgroundColor: ft.color } : {}}
                  >
                    <ft.icon size={12} /> {ft.label}
                  </button>
                ))}
              </div>
              {/* Active placement indicator */}
              {activeTool && activeSignerEmail && (
                <div className="mt-2 px-2 py-1.5 rounded-lg text-[10px] font-semibold text-center"
                  style={{
                    backgroundColor: `${SIGNER_COLORS[validSigners.findIndex(s => s.email === activeSignerEmail) % SIGNER_COLORS.length]}18`,
                    color: SIGNER_COLORS[validSigners.findIndex(s => s.email === activeSignerEmail) % SIGNER_COLORS.length],
                  }}
                >
                  Click PDF to place {activeTool} for {activeSignerEmail.split("@")[0]}
                </div>
              )}
            </div>

            {/* Placed fields list */}
            <div className="p-3 flex-1 overflow-y-auto">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Fields ({fields.length})
              </p>
              {fields.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-4">No fields yet.<br/>Select a signer &amp; type, then click the PDF.</p>
              ) : (
                <div className="space-y-1">
                  {fields.map((f) => {
                    const ft = FIELD_TYPES.find((x) => x.type === f.type)!;
                    const signerIdx = validSigners.findIndex(s => s.email === f.signer_email);
                    const color = signerIdx >= 0 ? SIGNER_COLORS[signerIdx % SIGNER_COLORS.length] : ft.color;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedField(f.id === selectedField ? null : f.id)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                          selectedField === f.id ? "bg-gray-100" : "hover:bg-gray-50"
                        }`}
                      >
                        <ft.icon size={10} style={{ color }} className="flex-shrink-0" />
                        <span className="truncate text-gray-600">p{f.page} · {f.label}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteField(f.id); }}
                          className="ml-auto text-gray-300 hover:text-red-400 flex-shrink-0"
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

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          {tab === "editor" && (
            <PDFEditorCanvas
              fileUrl={doc.file_url}
              fields={fields}
              activeTool={activeTool}
              selectedField={selectedField}
              onPlaceField={handlePlaceField}
              onUpdateField={handleUpdateField}
              onSelectField={setSelectedField}
              onDeleteField={handleDeleteField}
              onPageCountChange={handlePageCountChange}
              signerColors={
                isTemplate
                  ? Object.fromEntries([1,2,3,4].map((n) => [`Signer ${n}`, SIGNER_COLORS[(n-1) % SIGNER_COLORS.length]]))
                  : Object.fromEntries(validSigners.map((s, i) => [s.email, SIGNER_COLORS[i % SIGNER_COLORS.length]]))
              }
            />
          )}

          {tab === "signers" && (
            <div className="max-w-xl mx-auto py-10 px-6 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Users size={16} /> Signers</h2>
                {signers.length > 1 && (
                  <p className="text-xs text-gray-400 mt-1">Signers will be asked to sign in the order shown below (1 → 2 → 3…). Each signer can see the previous signatures.</p>
                )}
              </div>
              {signers.map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {s.order}
                      </span>
                      <span className="text-xs font-medium text-gray-500">Signer {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Move up / down */}
                      {i > 0 && (
                        <button
                          onClick={() => setSigners((prev) => {
                            const next = [...prev];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next.map((x, idx) => ({ ...x, order: idx + 1 }));
                          })}
                          className="text-xs text-gray-400 hover:text-indigo-500 px-1"
                          title="Move up"
                        >↑</button>
                      )}
                      {i < signers.length - 1 && (
                        <button
                          onClick={() => setSigners((prev) => {
                            const next = [...prev];
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            return next.map((x, idx) => ({ ...x, order: idx + 1 }));
                          })}
                          className="text-xs text-gray-400 hover:text-indigo-500 px-1"
                          title="Move down"
                        >↓</button>
                      )}
                      {signers.length > 1 && (
                        <button onClick={() => setSigners((prev) => prev.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order: idx + 1 })))} className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={s.email}
                    onChange={(e) => setSigners((prev) => prev.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="text"
                    placeholder="Full name (optional)"
                    value={s.name}
                    onChange={(e) => setSigners((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
              <button onClick={() => setSigners((prev) => [...prev, { email: "", name: "", order: prev.length + 1 }])} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
                <UserPlus size={14} /> Add another signer
              </button>
              <button onClick={handleSend} disabled={sending || validSigners.length === 0} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send for Signature
              </button>
            </div>
          )}

          {tab === "status" && (
            <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">

              {/* Header + progress */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Eye size={16} /> Tracking</h2>
                  {signerRequests.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {signerRequests.filter(r => r.status === "signed").length} of {signerRequests.length} signed
                    </p>
                  )}
                </div>
                {signerRequests.every(r => r.status === "signed") && signerRequests.length > 0 && (
                  <a
                    href={`/api/documents/${id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <Download size={13} /> Download Final PDF
                  </a>
                )}
              </div>

              {/* Progress bar */}
              {signerRequests.length > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(signerRequests.filter(r => r.status === "signed").length / signerRequests.length) * 100}%` }}
                  />
                </div>
              )}

              {/* Just-sent banner */}
              {sendSuccess.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-xs font-medium text-green-700">Signing requests sent successfully!</p>
                </div>
              )}

              {signerRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Users size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No signing requests yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add signers and click Send to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {signerRequests.map((r, idx) => {
                    const isSigned = r.status === "signed";
                    const isPending = r.status === "pending";
                    const isWaiting = r.status === "waiting";
                    const signingLink = r.signing_url;

                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl border p-4 space-y-3 transition-all ${
                          isSigned ? "bg-green-50 border-green-200" :
                          isPending ? "bg-white border-indigo-200 shadow-sm" :
                          "bg-white border-gray-200 opacity-70"
                        }`}
                      >
                        {/* Top row */}
                        <div className="flex items-center gap-3">
                          {/* Step number */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isSigned ? "bg-green-500 text-white" :
                            isPending ? "bg-indigo-600 text-white" :
                            "bg-gray-200 text-gray-500"
                          }`}>
                            {isSigned ? <Check size={14} /> : r.signing_order}
                          </div>

                          {/* Name + email */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{r.signer_name || r.signer_email}</p>
                            <p className="text-xs text-gray-400">{r.signer_email}</p>
                          </div>

                          {/* Status badge */}
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isSigned ? "bg-green-100 text-green-700" :
                            isPending ? "bg-indigo-100 text-indigo-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {isSigned ? "Signed" : isPending ? "Pending" : "Waiting"}
                          </span>

                          {/* Per-signer PDF download */}
                          {isSigned && (
                            <a
                              href={`/api/documents/${id}/download?until_order=${r.signing_order}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                              <Download size={11} /> PDF #{r.signing_order}
                            </a>
                          )}
                        </div>

                        {/* Signed timestamp */}
                        {isSigned && r.signed_at && (
                          <p className="text-xs text-green-600 flex items-center gap-1.5 pl-11">
                            <CheckCircle2 size={11} />
                            Signed {new Date(r.signed_at).toLocaleString()}
                          </p>
                        )}

                        {/* Pending — show signing link */}
                        {isPending && signingLink && (
                          <div className="ml-11 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Link2 size={11} className="text-indigo-500 flex-shrink-0" />
                              <span className="text-[11px] font-semibold text-indigo-700">Signing link (share with signer)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-[10px] text-indigo-600 bg-white border border-indigo-100 rounded px-2 py-1 truncate">
                                {signingLink}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(signingLink);
                                  setCopiedId(r.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex-shrink-0 ${
                                  copiedId === r.id
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                }`}
                              >
                                {copiedId === r.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Waiting */}
                        {isWaiting && (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5 pl-11">
                            <Clock size={11} />
                            Waiting for signer #{idx} to complete first
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Final download when partial signers done */}
              {signerRequests.some(r => r.status === "signed") && !signerRequests.every(r => r.status === "signed") && (
                <div className="pt-2 border-t border-gray-100">
                  <a
                    href={`/api/documents/${id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Download size={12} /> Download partial PDF (signed so far)
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
