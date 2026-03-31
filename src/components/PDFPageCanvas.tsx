"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

interface Props {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  onRendered?: (width: number, height: number) => void;
}

export default function PDFPageCanvas({ pdfDoc, pageNumber, width, onRendered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const scale = width / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Always reset transform to identity before rendering.
      // Setting canvas.width/height resets the canvas but NOT the transform in all
      // browsers — a stale transform from a previous render causes inversion.
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Do NOT pass `canvas` to render — pdfjs v5 treats it as an OffscreenCanvas
      // hint and applies a flipped coordinate transform, causing pages to appear inverted.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: ctx, viewport: scaledViewport }).promise;
      if (!cancelled) onRendered?.(scaledViewport.width, scaledViewport.height);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, width, onRendered]);

  return <canvas ref={canvasRef} className="block w-full" />;
}
