"use client";

import { useEffect, useRef, useState, use } from "react";
import dynamic from "next/dynamic";
import { CheckCircle, PenLine, Type, RotateCcw, Loader2, AlertCircle } from "lucide-react";

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

interface EsignRequest {
  id: string;
  token: string;
  document_id: string | null;
  document_title: string;
  document_content: string;
  signer_email: string;
  signer_name: string;
  status: string;
  signed_at: string | null;
}

type SignMode = "draw" | "type";

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [req, setReq] = useState<EsignRequest | null>(null);
  const [docFileUrl, setDocFileUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<EsignField[]>([]);
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

        // If this request is linked to a document, load it
        if (data.document_id) {
          const [docRes, fieldsRes] = await Promise.all([
            fetch(`/api/documents/${data.document_id}`),
            fetch(`/api/documents/${data.document_id}/fields`),
          ]);
          if (docRes.ok) {
            const doc = await docRes.json();
            setDocFileUrl(doc.file_url);
          }
          if (fieldsRes.ok) {
            const allFields: EsignField[] = await fieldsRes.json();
            // Show fields assigned to this signer OR unassigned fields (empty signer_email)
            const myFields = allFields.filter(
              (f) => !f.signer_email || f.signer_email === data.signer_email
            );
            setFields(myFields);
            // Pre-fill date fields
            const initial: Record<string, string> = {};
            myFields.forEach((f) => {
              if (f.type === "date") initial[f.id] = new Date().toLocaleDateString();
            });
            setFieldValues(initial);
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

  // For PDF mode: when a signature/initials field is clicked, we open the signature pad
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
      // Validate required fields
      const missing = fields.filter((f) => f.required && !fieldValues[f.id]);
      if (missing.length > 0) {
        setError(`Please complete all required fields: ${missing.map((f) => f.label).join(", ")}`);
        return;
      }
    } else {
      // Simple signature pad mode
      if (mode === "draw" && !hasDrawn.current) { setError("Please draw your signature."); return; }
      if (mode === "type" && !typedName.trim()) { setError("Please type your name."); return; }
    }

    setError("");
    setSubmitting(true);

    // Auto-apply drawn/typed signature to any unsigned signature or initials fields
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

    const signatureData = hasPdfFields
      ? JSON.stringify(finalFieldValues)
      : getSignatureData();

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

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-4">
        <CheckCircle className="mx-auto text-green-500" size={48} />
        <h1 className="text-xl font-semibold text-gray-800">Document Signed</h1>
        <p className="text-sm text-gray-500">
          Thank you, {req.signer_name || req.signer_email}. Your signature has been recorded.
        </p>
      </div>
    </div>
  );

  const hasPdfFields = fields.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
          <PenLine size={16} /> FlowMake E-Sign
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{req.document_title}</p>
          <p className="text-xs text-gray-400">Signing as {req.signer_email}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {/* Always show PDF if available, otherwise show text content */}
        {docFileUrl ? (
          <PDFSigningViewer
            fileUrl={docFileUrl}
            fields={fields}
            fieldValues={fieldValues}
            onFieldClick={handleFieldSign}
            onFieldValueChange={handleFieldValueChange}
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

        {/* Signature pad — always shown unless all fields are inline (pdf fields with no active field) */}
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
