"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-200 text-left">
      {/* header bar */}
      <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* code body */}
      <pre className="bg-gray-900 px-4 py-3 overflow-x-auto text-[12px] leading-relaxed">
        <code className="text-gray-100 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

type Props = {
  content: string;
  /** Pass Tailwind text colour class e.g. "text-white" or "text-gray-700" */
  textColor?: string;
  isStreaming?: boolean;
};

export default function MarkdownMessage({ content, textColor = "text-gray-700", isStreaming }: Props) {
  return (
    <div className={`prose-sm max-w-none ${textColor}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Code ──────────────────────────────────────────────────────────
          code({ className, children, ...props }) {
            const isInline = !className && !String(children).includes("\n");
            const language = (className ?? "").replace("language-", "");
            const code = String(children).replace(/\n$/, "");

            if (isInline) {
              return (
                <code
                  className="bg-black/10 text-current font-mono text-[11px] px-1 py-0.5 rounded"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock language={language} code={code} />;
          },
          // ── Headings ──────────────────────────────────────────────────────
          h1: ({ children }) => (
            <p className={`font-bold text-sm mt-2 mb-1 ${textColor}`}>{children}</p>
          ),
          h2: ({ children }) => (
            <p className={`font-bold text-[13px] mt-2 mb-1 ${textColor}`}>{children}</p>
          ),
          h3: ({ children }) => (
            <p className={`font-semibold text-[12px] mt-1.5 mb-0.5 ${textColor}`}>{children}</p>
          ),
          // ── Paragraph ─────────────────────────────────────────────────────
          p: ({ children }) => (
            <p className={`text-[13px] leading-relaxed mb-1.5 last:mb-0 ${textColor}`}>{children}</p>
          ),
          // ── Lists ─────────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-0.5 mb-1.5 text-[13px]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-0.5 mb-1.5 text-[13px]">{children}</ol>
          ),
          li: ({ children }) => (
            <li className={`text-[13px] leading-relaxed ${textColor}`}>{children}</li>
          ),
          // ── Strong / Em ───────────────────────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          // ── Blockquote ────────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-current opacity-60 pl-3 my-1 italic text-[12px]">
              {children}
            </blockquote>
          ),
          // ── Tables ────────────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="text-[11px] border-collapse w-full">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-black/10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-black/20 px-2 py-1 font-semibold text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-black/20 px-2 py-1">{children}</td>
          ),
          // ── HR ────────────────────────────────────────────────────────────
          hr: () => <hr className="border-black/10 my-2" />,
          // ── Links ─────────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline opacity-80 hover:opacity-100"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-current opacity-70 animate-pulse rounded-sm ml-0.5" />
      )}
    </div>
  );
}
