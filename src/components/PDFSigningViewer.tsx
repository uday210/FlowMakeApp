"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PDFPageCanvas from "./PDFPageCanvas";
import { PenLine, Type, Calendar, AlignLeft, CheckCircle2 } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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

const FIELD_COLORS: Record<string, string> = {
  signature: "#4f46e5",
  initials: "#0891b2",
  date: "#059669",
  text: "#d97706",
};

const FIELD_ICONS: Record<string, React.ElementType> = {
  signature: PenLine,
  initials: Type,
  date: Calendar,
  text: AlignLeft,
};

interface Props {
  fileUrl: string;
  fields: EsignField[];
  fieldValues: Record<string, string>;
  onFieldClick: (fieldId: string) => void;
  onFieldValueChange: (fieldId: string, value: string) => void;
  // Previous signers' fields shown as read-only overlays
  readOnlyFields?: EsignField[];
  readOnlyValues?: Record<string, string>;
}

export default function PDFSigningViewer({ fileUrl, fields, fieldValues, onFieldClick, onFieldValueChange, readOnlyFields = [], readOnlyValues = {} }: Props) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageDims, setPageDims] = useState<Record<number, { w: number; h: number }>>({});
  const [containerWidth, setContainerWidth] = useState(800);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setContainerWidth(Math.min(containerRef.current.clientWidth, 900));
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Proxy returned HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (!cancelled) { setPdfDoc(doc); setNumPages(doc.numPages); }
      } catch (err) {
        if (!cancelled) setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (error) return <div className="p-6 text-sm text-red-400 bg-white rounded-xl border border-red-100">{error}</div>;
  if (!pdfDoc) return <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">Loading document…</div>;

  return (
    <div ref={containerRef} className="space-y-4">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <div key={pageNum} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="relative">
            <PDFPageCanvas
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              width={containerWidth}
              onRendered={(w, h) => setPageDims((p) => ({ ...p, [pageNum]: { w, h } }))}
            />

            {/* Read-only overlays for previous signers */}
            {readOnlyFields.filter((f) => f.page === pageNum).map((field) => {
              const value = readOnlyValues[field.id];
              const dim = pageDims[pageNum];
              return (
                <div
                  key={`ro-${field.id}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: dim ? `${(field.height / 100) * dim.h}px` : `${field.height}%`,
                    zIndex: 9,
                  }}
                >
                  {value?.startsWith("data:image") ? (
                    <img src={value} alt="prev-sig" className="max-h-full max-w-full object-contain p-0.5 opacity-80" />
                  ) : value ? (
                    <div className="w-full h-full flex items-center px-1 text-xs text-gray-600 bg-gray-50/70 border border-gray-200 rounded">
                      {value}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {fields.filter((f) => f.page === pageNum).map((field) => {
              const Icon = FIELD_ICONS[field.type];
              const color = FIELD_COLORS[field.type];
              const value = fieldValues[field.id];
              const isSigned = !!value;
              const dim = pageDims[pageNum];

              return (
                <div
                  key={field.id}
                  className="absolute"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: dim ? `${(field.height / 100) * dim.h}px` : `${field.height}%`,
                    zIndex: 10,
                  }}
                >
                  {field.type === "text" ? (
                    <input
                      type="text"
                      placeholder={field.label}
                      value={value || ""}
                      onChange={(e) => onFieldValueChange(field.id, e.target.value)}
                      className="w-full h-full text-xs px-1 outline-none border-b-2 bg-opacity-10"
                      style={{ borderColor: color, backgroundColor: `${color}18`, color: "#1e293b" }}
                    />
                  ) : field.type === "date" ? (
                    <input
                      type="date"
                      value={value || ""}
                      onChange={(e) => onFieldValueChange(field.id, e.target.value)}
                      className="w-full h-full text-xs px-1 outline-none border-2 rounded"
                      style={{ borderColor: color, backgroundColor: `${color}18` }}
                    />
                  ) : (
                    <button
                      onClick={() => onFieldClick(field.id)}
                      className="w-full h-full flex items-center justify-center gap-1 border-2 rounded transition-all hover:opacity-80"
                      style={{
                        borderColor: color,
                        backgroundColor: isSigned ? `${color}28` : `${color}14`,
                        borderStyle: isSigned ? "solid" : "dashed",
                      }}
                    >
                      {isSigned && value.startsWith("data:image") ? (
                        <img src={value} alt="sig" className="max-h-full max-w-full object-contain p-0.5" />
                      ) : isSigned ? (
                        <div className="flex items-center gap-1" style={{ color }}>
                          <CheckCircle2 size={11} />
                          <span className="text-[9px] font-semibold">Signed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1" style={{ color }}>
                          <Icon size={11} />
                          <span className="text-[10px] font-semibold">Click to sign</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
