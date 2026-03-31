"use client";

import { useEffect, useRef } from "react";

export default function EmailTemplatePreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // Auto-resize iframe to content height
    const resize = () => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + "px";
      }
    };
    setTimeout(resize, 100);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full border-0"
      style={{ minHeight: 400 }}
      sandbox="allow-same-origin"
      title="Email Preview"
    />
  );
}
