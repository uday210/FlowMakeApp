"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

interface Props {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  onRendered?: (width: number, height: number) => void;
}

export default function PDFPageCanvas({ pdfDoc, pageNumber, width, onRendered }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  // Keep onRendered in a ref so it never triggers the effect — it's just a callback
  const onRenderedRef = useRef(onRendered);
  useEffect(() => { onRenderedRef.current = onRendered; }, [onRendered]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale: 1 });
      const scale = width / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      canvas.width  = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const ctx = canvas.getContext("2d");
      if (!ctx || cancelled) return;

      // Always reset to identity — canvas.width= resets pixels but not the
      // 2D transform in all browsers; a stale pdfjs transform causes inversion.
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Do NOT pass `canvas` — pdfjs v5 uses it as an OffscreenCanvas hint and
      // applies a flipped coordinate transform, causing pages to appear inverted.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderTask = (page.render as any)({ canvasContext: ctx, viewport: scaledViewport });
      try {
        await renderTask!.promise;
        if (!cancelled) onRenderedRef.current?.(scaledViewport.width, scaledViewport.height);
      } catch {
        // render cancelled — normal, ignore
      }
    })();

    return () => {
      cancelled = true;
      // Cancel an in-progress pdfjs render so it doesn't write to the canvas
      // after a new render has already started (causes racing transforms / inversion)
      renderTask?.cancel();
    };
  // onRendered intentionally excluded — stored in ref above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNumber, width]);

  return <canvas ref={canvasRef} className="block w-full" />;
}
