"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Save, Send, Loader2, Plus, Trash2,
  PenLine, Type, Calendar, AlignLeft, UserPlus,
  CheckCircle2, Clock, Users, Eye, X, Download,
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
}

interface Signer { email: string; name: string }

interface SignerRequest {
  id: string;
  signer_email: string;
  signer_name: string;
  status: string;
  signed_at: string | null;
}

const FIELD_TYPES = [
  { type: "signature", label: "Signature", icon: PenLine, color: "#4f46e5", height: 10 },
  { type: "initials",  label: "Initials",  icon: Type,    color: "#0891b2", height: 8  },
  { type: "date",      label: "Date",      icon: Calendar, color: "#059669", height: 7  },
  { type: "text",      label: "Text",      icon: AlignLeft, color: "#d97706", height: 7 },
] as const;

type Tab = "editor" | "signers" | "status";

export default function DocumentEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [doc, setDoc] = useState<EsignDoc | null>(null);
  const [fields, setFields] = useState<EsignField[]>([]);
  const [signers, setSigners] = useState<Signer[]>([{ email: "", name: "" }]);
  const [signerRequests, setSignerRequests] = useState<SignerRequest[]>([]);
  const [tab, setTab] = useState<Tab>("editor");
  const [activeTool, setActiveTool] = useState<EsignField["type"] | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendSuccess, setSendSuccess] = useState<{ email: string; url: string }[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [activeSignerEmail, setActiveSignerEmail] = useState("");

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
    // update page count
    if (doc) {
      await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: doc.name, page_count: pageCount, status: doc.status }),
      });
    }
    setSaving(false);
  };

  const handleSend = async () => {
    const validSigners = signers.filter((s) => s.email.trim());
    if (validSigners.length === 0) { setTab("signers"); return; }
    await handleSaveFields();
    setSending(true);
    const res = await fetch(`/api/documents/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signers: validSigners }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setSendSuccess(data.requests.map((r: { signer_email: string; signing_url: string }) => ({
        email: r.signer_email,
        url: r.signing_url,
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
          <aside className="w-52 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Field Type</p>
              <div className="space-y-1">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.type}
                    onClick={() => setActiveTool(activeTool === ft.type ? null : ft.type)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeTool === ft.type
                        ? "text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                    style={activeTool === ft.type ? { backgroundColor: ft.color } : {}}
                  >
                    <ft.icon size={13} /> {ft.label}
                  </button>
                ))}
              </div>
              {activeTool && validSigners.length === 0 && (
                <p className="text-[10px] text-amber-500 mt-2 text-center">⚠ Add signers first in the Signers tab</p>
              )}
              {activeTool && validSigners.length > 0 && (
                <p className="text-[10px] text-indigo-500 mt-2 text-center">Click on PDF to place</p>
              )}
            </div>

            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Assign to</p>
              <div className="space-y-1">
                {validSigners.map((s) => (
                  <button
                    key={s.email}
                    onClick={() => setActiveSignerEmail(s.email)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-lg truncate transition-colors ${
                      activeSignerEmail === s.email
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {s.name || s.email}
                  </button>
                ))}
                {validSigners.length === 0 && (
                  <p className="text-[10px] text-gray-400">Add signers first</p>
                )}
              </div>
            </div>

            <div className="p-3 flex-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Fields ({fields.length})
              </p>
              <div className="space-y-1">
                {fields.map((f) => {
                  const ft = FIELD_TYPES.find((x) => x.type === f.type)!;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedField(f.id === selectedField ? null : f.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                        selectedField === f.id ? "bg-indigo-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <ft.icon size={11} style={{ color: ft.color }} className="flex-shrink-0" />
                      <span className="truncate text-gray-600">p{f.page} · {f.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteField(f.id); }}
                        className="ml-auto text-gray-300 hover:text-red-400 flex-shrink-0"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
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
              onPageCountChange={handlePageCountChange}
            />
          )}

          {tab === "signers" && (
            <div className="max-w-xl mx-auto py-10 px-6 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Users size={16} /> Signers</h2>
              {signers.map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Signer {i + 1}</span>
                    {signers.length > 1 && (
                      <button onClick={() => setSigners((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
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
              <button onClick={() => setSigners((prev) => [...prev, { email: "", name: "" }])} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
                <UserPlus size={14} /> Add another signer
              </button>
              <button onClick={handleSend} disabled={sending || validSigners.length === 0} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send for Signature
              </button>
            </div>
          )}

          {tab === "status" && (
            <div className="max-w-2xl mx-auto py-10 px-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Eye size={16} /> Tracking</h2>
                {signerRequests.some((r) => r.status === "signed") && (
                  <a
                    href={`/api/documents/${id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <Download size={13} /> Download Signed PDF
                  </a>
                )}
              </div>

              {sendSuccess.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-green-700 flex items-center gap-2"><CheckCircle2 size={14} /> Document sent successfully!</p>
                  {sendSuccess.map((s) => (
                    <div key={s.email} className="text-xs text-green-600 space-y-0.5">
                      <p className="font-medium">{s.email}</p>
                      <a href={s.url} target="_blank" rel="noreferrer" className="underline break-all">{s.url}</a>
                    </div>
                  ))}
                </div>
              )}

              {signerRequests.length === 0 ? (
                <p className="text-sm text-gray-400">No signing requests yet. Add signers and send the document.</p>
              ) : (
                <div className="space-y-3">
                  {signerRequests.map((r) => (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${r.status === "signed" ? "bg-green-50" : "bg-amber-50"}`}>
                        {r.status === "signed"
                          ? <CheckCircle2 size={18} className="text-green-600" />
                          : <Clock size={18} className="text-amber-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{r.signer_name || r.signer_email}</p>
                        <p className="text-xs text-gray-400">{r.signer_email}</p>
                        {r.signed_at && (
                          <p className="text-xs text-green-600 mt-0.5">Signed {new Date(r.signed_at).toLocaleString()}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                        r.status === "signed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
