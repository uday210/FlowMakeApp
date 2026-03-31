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

      // Reset any leftover transform before rendering — stale transforms from a
      // previous render (or from DPR scaling) can cause the page to appear
      // inverted or mirrored on certain PDFs.
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      if (!cancelled) onRendered?.(scaledViewport.width, scaledViewport.height);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, width, onRendered]);

  return <canvas ref={canvasRef} className="block w-full" />;
}
