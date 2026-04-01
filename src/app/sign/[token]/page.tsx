"use client";

import { useEffect, useRef, useState, use } from "react";
import dynamic from "next/dynamic";
import { CheckCircle, PenLine, Type, RotateCcw, Loader2, AlertCircle, Clock, User } from "lucide-react";

const PDFSigningViewer = dynamic(() => import("@/components/PDFSigningViewer"), { ssr: false });

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

interface PreviousSignature {
  signer_name: string;
  signer_email: string;
  signer_role: string | null;
  signing_order: number;
  fields_data: Record<string, string>;
  signature_data: string | null;
  signature_type: string | null;
  signed_at: string;
}

interface EsignRequest {
  id: string;
  token: string;
  document_id: string | null;
  document_title: string;
  document_content: string;
  signer_email: string;
  signer_name: string;
  signer_role: string | null;
  status: string;
  signed_at: string | null;
  signing_order: number;
  file_url: string | null;
  document_fields: EsignField[];
  previous_signatures: PreviousSignature[];
}

type SignMode = "draw" | "type";

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [req, setReq] = useState<EsignRequest | null>(null);
  const [docFileUrl, setDocFileUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<EsignField[]>([]);
  const [readOnlyFields, setReadOnlyFields] = useState<EsignField[]>([]);
  const [readOnlyValues, setReadOnlyValues] = useState<Record<string, string>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<SignMode>("draw");
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    fetch(`/api/esign/${token}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(async (data: EsignRequest) => {
        setReq(data);
        if (data.status === "signed") { setDone(true); return; }
        // waiting — don't load doc, just show the waiting screen
        if (data.status === "waiting") return;

        if (data.document_id) {
          setDocFileUrl(`/api/esign/${token}/pdf`);
          const allFields: EsignField[] = data.document_fields ?? [];

            // Fields for this signer only.
            // Matches by email directly, OR by role (for template documents).
            // If no fields have any signer assigned (old doc), fall back to all fields.
            const hasAssignedFields = allFields.some((f) => f.signer_email);
            const myFields = hasAssignedFields
              ? allFields.filter((f) =>
                  !f.signer_email ||                                              // "All Signers" field
                  f.signer_email === data.signer_email ||
                  (data.signer_role && f.signer_email === data.signer_role)
                )
              : allFields;
            setFields(myFields);

            // Pre-fill date fields
            const initial: Record<string, string> = {};
            myFields.forEach((f) => {
              if (f.type === "date") initial[f.id] = new Date().toISOString().slice(0, 10);
            });
            setFieldValues(initial);

            // Build read-only overlays from previous signatures
            if (data.previous_signatures?.length > 0) {
              const prevEmails = new Set(data.previous_signatures.map((p) => p.signer_email));
              const prevRoles = new Set(
                data.previous_signatures.map((p) => p.signer_role).filter((r): r is string => !!r)
              );
              // Exclude fields that the current signer also needs to fill (UC1: same slot, N signers)
              const myFieldIds = new Set(myFields.map((f) => f.id));
              const prevFields = allFields.filter(
                (f) =>
                  f.signer_email &&           // skip "All Signers" fields (empty signer_email)
                  !myFieldIds.has(f.id) &&
                  (prevEmails.has(f.signer_email) || prevRoles.has(f.signer_email))
              );
              setReadOnlyFields(prevFields);

              // Merge all previous field values
              const prevValues: Record<string, string> = {};
              for (const prev of data.previous_signatures) {
                Object.assign(prevValues, prev.fields_data);
                // If no fields_data but has a simple signature, apply to their signature fields
                if (Object.keys(prev.fields_data).length === 0 && prev.signature_data &&
                    (prev.signature_type === "draw" || prev.signature_type === "type")) {
                  for (const f of prevFields) {
                    const matchByEmail = f.signer_email === prev.signer_email;
                    const matchByRole = !!(prev.signer_role && f.signer_email === prev.signer_role);
                    if ((matchByEmail || matchByRole) && (f.type === "signature" || f.type === "initials")) {
                      prevValues[f.id] = prev.signature_data;
                    }
                  }
                }
              }
              setReadOnlyValues(prevValues);
            }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = getPoint(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
    hasDrawn.current = true;
  };

  const endDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  };

  const getSignatureData = (): string => {
    if (mode === "draw") return canvasRef.current?.toDataURL("image/png") ?? "";
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 600, 160);
    ctx.font = "italic 56px Georgia, serif"; ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(typedName, 300, 80);
    return canvas.toDataURL("image/png");
  };

  const handleFieldSign = (fieldId: string) => {
    setActiveFieldId(fieldId);
    hasDrawn.current = false;
  };

  const handleFieldValueChange = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleApplySignatureToField = () => {
    if (!activeFieldId) return;
    const sig = getSignatureData();
    if (!sig) return;
    setFieldValues((prev) => ({ ...prev, [activeFieldId]: sig }));
    setActiveFieldId(null);
  };

  const handleSubmit = async () => {
    const hasPdfFields = fields.length > 0;

    if (hasPdfFields) {
      const missing = fields.filter((f) => f.required && !fieldValues[f.id]);
      if (missing.length > 0) {
        setError(`Please complete all required fields: ${missing.map((f) => f.label).join(", ")}`);
        return;
      }
    } else {
      if (mode === "draw" && !hasDrawn.current) { setError("Please draw your signature."); return; }
      if (mode === "type" && !typedName.trim()) { setError("Please type your name."); return; }
    }

    setError("");
    setSubmitting(true);

    let finalFieldValues = { ...fieldValues };
    if (hasPdfFields) {
      const sigImage = getSignatureData();
      if (sigImage) {
        fields.forEach((f) => {
          if ((f.type === "signature" || f.type === "initials") && !finalFieldValues[f.id]) {
            finalFieldValues[f.id] = sigImage;
          }
        });
      }
    }

    const signatureData = hasPdfFields ? JSON.stringify(finalFieldValues) : getSignatureData();

    try {
      const res = await fetch(`/api/esign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_data: signatureData,
          signature_type: hasPdfFields ? "fields" : mode,
          fields_data: finalFieldValues,
        }),
      });
      if (res.status === 409) { setDone(true); return; }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Signing failed"); }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  if (notFound || !req) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <AlertCircle className="mx-auto text-red-400" size={40} />
        <p className="text-gray-700 font-medium">Signing request not found.</p>
        <p className="text-sm text-gray-400">This link may be invalid or expired.</p>
      </div>
    </div>
  );

  // ── Waiting — not your turn yet ───────────────────────────────────────────────
  if (req.status === "waiting") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-10 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <Clock className="text-amber-500" size={28} />
        </div>
        <h1 className="text-xl font-semibold text-gray-800">Waiting for previous signers</h1>
        <p className="text-sm text-gray-500">
          You are signer <strong>#{req.signing_order}</strong> on <strong>{req.document_title}</strong>.
          You will receive a notification once it's your turn to sign.
        </p>
        {req.previous_signatures?.length > 0 && (
          <div className="text-left border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signing progress</p>
            {req.previous_signatures.map((p) => (
              <div key={p.signer_email} className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                <span className="text-gray-700">{p.signer_name || p.signer_email}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(p.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="text-amber-400 flex-shrink-0" />
              <span className="text-gray-500 font-medium">You (#{req.signing_order})</span>
              <span className="text-xs text-amber-500 ml-auto">Waiting</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Already signed ────────────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-4">
        <CheckCircle className="mx-auto text-green-500" size={48} />
        <h1 className="text-xl font-semibold text-gray-800">Document Signed</h1>
        <p className="text-sm text-gray-500">
          Thank you, {req.signer_name || req.signer_email}. Your signature has been recorded.
        </p>
        {req.document_id && (
          <a
            href={`/api/documents/${req.document_id}/download?request_id=${req.id}`}
            className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            download
          >
            Download Your Signed Copy
          </a>
        )}
      </div>
    </div>
  );

  const hasPdfFields = fields.length > 0;
  const prevSigners = req.previous_signatures ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
          <PenLine size={16} /> FlowMake E-Sign
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{req.document_title}</p>
          <p className="text-xs text-gray-400">
            Signer #{req.signing_order} · {req.signer_email}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">

        {/* Previous signers progress banner */}
        {prevSigners.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Signing Progress — Previous Signatures
            </p>
            <div className="space-y-2">
              {prevSigners.map((p) => (
                <div key={p.signer_email} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={13} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{p.signer_name || p.signer_email}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.signer_email}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    Signed {new Date(p.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <User size={13} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">{req.signer_name || req.signer_email}</span>
                  <span className="text-xs text-indigo-500 ml-2 font-semibold">← You</span>
                </div>
                <span className="text-xs text-indigo-500 font-semibold flex-shrink-0">Signing now</span>
              </div>
            </div>
            {readOnlyFields.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-3 border-t border-gray-100 pt-2">
                Previous signatures are shown as read-only overlays on the document below.
              </p>
            )}
          </div>
        )}

        {/* PDF / document */}
        {docFileUrl ? (
          <PDFSigningViewer
            fileUrl={docFileUrl}
            fields={fields}
            fieldValues={fieldValues}
            onFieldClick={handleFieldSign}
            onFieldValueChange={handleFieldValueChange}
            readOnlyFields={readOnlyFields}
            readOnlyValues={readOnlyValues}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">{req.document_title}</h1>
            {req.document_content && (
              <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-4">
                {req.document_content}
              </div>
            )}
          </div>
        )}

        {/* Signature pad */}
        {(!hasPdfFields || activeFieldId) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {activeFieldId ? `Sign field: ${fields.find((f) => f.id === activeFieldId)?.label}` : "Your Signature"}
            </h2>
            <div className="flex gap-2">
              {(["draw", "type"] as SignMode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    mode === m ? "bg-indigo-600 text-white border-indigo-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {m === "draw" ? <PenLine size={13} /> : <Type size={13} />}
                  {m === "draw" ? "Draw" : "Type"}
                </button>
              ))}
            </div>

            {mode === "draw" ? (
              <div className="space-y-2">
                <div className="relative border-2 border-dashed border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <canvas ref={canvasRef} width={600} height={160} className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                  />
                  <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-gray-300 pointer-events-none select-none">Sign above</p>
                </div>
                <button onClick={clearCanvas} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  <RotateCcw size={12} /> Clear
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="text" value={typedName} onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {typedName && (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center h-24">
                    <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "2.5rem", color: "#1e293b" }}>
                      {typedName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeFieldId && (
              <button onClick={handleApplySignatureToField}
                className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Apply to Field
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><PenLine size={16} /> Submit Signature</>}
        </button>
        <p className="text-center text-xs text-gray-400">By submitting, you agree this electronic signature is legally binding.</p>
      </div>
    </div>
  );
}
