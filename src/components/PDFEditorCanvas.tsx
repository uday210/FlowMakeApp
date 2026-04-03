"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PDFPageCanvas from "./PDFPageCanvas";
import { PenLine, Type, Calendar, AlignLeft, GripVertical, X } from "lucide-react";

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
  activeTool: EsignField["type"] | null;
  selectedField: string | null;
  onPlaceField: (page: number, x: number, y: number) => void;
  onUpdateField: (field: EsignField) => void;
  onSelectField: (id: string | null) => void;
  onDeleteField?: (id: string) => void;
  onPageCountChange: (n: number) => void;
  signerColors?: Record<string, string>;
}

export default function PDFEditorCanvas({
  fileUrl, fields, activeTool, selectedField,
  onPlaceField, onUpdateField, onSelectField, onDeleteField, onPageCountChange, signerColors = {},
}: Props) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageDims, setPageDims] = useState<Record<number, { w: number; h: number }>>({});
  const [containerWidth, setContainerWidth] = useState(750);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ fieldId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (containerRef.current)
        setContainerWidth(Math.min(containerRef.current.clientWidth - 64, 850));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedField && onDeleteField) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        onDeleteField(selectedField);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedField, onDeleteField]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        onPageCountChange(doc.numPages);
      } catch {
        if (!cancelled) setError("Failed to load PDF. Check the file URL.");
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl, onPageCountChange]);

  const handlePageRendered = useCallback((pageNum: number, w: number, h: number) => {
    setPageDims((prev) => ({ ...prev, [pageNum]: { w, h } }));
  }, []);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!activeTool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onPlaceField(pageNum, xPct, yPct);
  };

  const handleFieldMouseDown = (e: React.MouseEvent, field: EsignField) => {
    e.stopPropagation();
    onSelectField(field.id);
    const dim = pageDims[field.page];
    if (!dim) return;
    draggingRef.current = { fieldId: field.id, startX: e.clientX, startY: e.clientY, origX: field.x, origY: field.y };
    const onMouseMove = (me: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = ((me.clientX - draggingRef.current.startX) / dim.w) * 100;
      const dy = ((me.clientY - draggingRef.current.startY) / dim.h) * 100;
      onUpdateField({ ...field, x: Math.max(0, Math.min(100 - field.width, draggingRef.current.origX + dx)), y: Math.max(0, Math.min(100 - field.height, draggingRef.current.origY + dy)) });
    };
    const onMouseUp = () => { draggingRef.current = null; window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (error) return <div className="p-8 text-sm text-red-400">{error}</div>;
  if (!pdfDoc) return <div className="p-8 text-sm text-gray-400 text-center">Loading PDF…</div>;

  return (
    <div ref={containerRef} className="p-8 space-y-6" onClick={() => onSelectField(null)}>
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <div key={pageNum} className="mx-auto" style={{ width: containerWidth }}>
          <div className="text-xs text-gray-400 mb-1 text-center">Page {pageNum}</div>
          <div
            className="relative shadow-lg rounded-sm overflow-hidden bg-white"
            style={{ cursor: activeTool ? "crosshair" : "default" }}
            onClick={(e) => handlePageClick(e, pageNum)}
          >
            <PDFPageCanvas
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              width={containerWidth}
              onRendered={(w, h) => handlePageRendered(pageNum, w, h)}
            />

            {fields.filter((f) => f.page === pageNum).map((field) => {
              const Icon = FIELD_ICONS[field.type];
              const signerColor = signerColors[field.signer_email] || FIELD_COLORS[field.type];
              const isSelected = selectedField === field.id;
              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleFieldMouseDown(e, field)}
                  onClick={(e) => { e.stopPropagation(); onSelectField(field.id); }}
                  className="absolute group"
                  style={{
                    left: `${field.x}%`, top: `${field.y}%`,
                    width: `${field.width}%`, height: `${field.height}%`,
                    border: `2px ${isSelected ? "solid" : "dashed"} ${signerColor}`,
                    backgroundColor: `${signerColor}22`,
                    borderRadius: 4, cursor: "move", zIndex: isSelected ? 20 : 10,
                    boxShadow: isSelected ? `0 0 0 2px ${signerColor}55` : undefined,
                  }}
                >
                  <div className="flex items-center gap-1 px-1 h-full overflow-hidden pointer-events-none" style={{ color: signerColor }}>
                    <Icon size={10} className="flex-shrink-0" />
                    <span className="text-xs font-semibold truncate leading-none">{field.label}</span>
                    {field.signer_email && (
                      <span className="text-[8px] opacity-70 truncate ml-auto">{field.signer_email.split("@")[0]}</span>
                    )}
                  </div>
                  {/* Delete button on hover */}
                  {onDeleteField && (
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onDeleteField(field.id); }}
                      className="absolute -top-2.5 -right-2.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-30"
                    >
                      <X size={8} />
                    </button>
                  )}
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const dim = pageDims[field.page];
                      if (!dim) return;
                      const startX = e.clientX; const startW = field.width;
                      const mm = (me: MouseEvent) => onUpdateField({ ...field, width: Math.max(8, Math.min(60, startW + ((me.clientX - startX) / dim.w) * 100)) });
                      const mu = () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
                      window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
                    }}
                    className="absolute bottom-0 right-0 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: signerColor }}
                  >
                    <GripVertical size={10} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
