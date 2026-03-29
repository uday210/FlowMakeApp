"use client";

import { useState, useRef, useEffect } from "react";
import type { ExecutionLog } from "@/lib/types";
import {
  CheckCircle, XCircle, Loader2, MinusCircle,
  ChevronDown, ChevronRight, Copy, Check,
  Trash2, Terminal, X, GripHorizontal,
} from "lucide-react";

type Filter = "all" | "success" | "error" | "skipped";

function timestamp() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function LogLine({ log, index }: { log: ExecutionLog & { _ts?: string }; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasDetail = Boolean(log.output ?? log.error);

  const statusColor =
    log.status === "running" ? "text-blue-400" :
    log.status === "success" ? "text-green-400" :
    log.status === "skipped" ? "text-gray-500" :
    "text-red-400";

  const rowBg =
    log.status === "error" ? "bg-red-950/30 border-red-900/40" :
    log.status === "running" ? "bg-blue-950/20 border-blue-900/30" :
    "border-white/5";

  const copyOutput = () => {
    const text = JSON.stringify({ label: log.node_label, status: log.status, output: log.output, error: log.error }, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`border-b font-mono text-[11px] leading-none ${rowBg}`}>
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 group"
        onClick={() => hasDetail && setExpanded((v) => !v)}
      >
        {/* line number */}
        <span className="text-gray-600 w-5 text-right flex-shrink-0 select-none">{index + 1}</span>

        {/* timestamp */}
        <span className="text-gray-600 flex-shrink-0 w-28">{log._ts ?? ""}</span>

        {/* status icon */}
        <span className="flex-shrink-0">
          {log.status === "running" ? (
            <Loader2 size={11} className="animate-spin text-blue-400" />
          ) : log.status === "success" ? (
            <CheckCircle size={11} className="text-green-400" />
          ) : log.status === "skipped" ? (
            <MinusCircle size={11} className="text-gray-500" />
          ) : (
            <XCircle size={11} className="text-red-400" />
          )}
        </span>

        {/* node label */}
        <span className={`flex-1 truncate ${statusColor} font-medium`}>{log.node_label}</span>

        {/* duration */}
        {log.duration_ms !== undefined && (
          <span className="text-gray-600 flex-shrink-0">{log.duration_ms}ms</span>
        )}

        {/* error inline */}
        {log.error && (
          <span className="text-red-400 truncate max-w-48 flex-shrink-0">{log.error}</span>
        )}

        {/* actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {hasDetail && (
            <button onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }} className="text-gray-500 hover:text-white">
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); copyOutput(); }} className="text-gray-500 hover:text-white">
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* expanded output */}
      {expanded && hasDetail && (
        <div className="px-12 pb-3 pt-1 space-y-2">
          {log.error && (
            <div>
              <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Error</span>
              <pre className="mt-1 text-red-300 bg-red-950/40 rounded p-2 overflow-x-auto whitespace-pre-wrap text-[10px] border border-red-900/30">
                {log.error}
              </pre>
            </div>
          )}
          {log.output !== undefined && log.output !== null && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Output</span>
              <pre className="mt-1 text-gray-300 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap text-[10px] border border-white/10">
                {JSON.stringify(log.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  logs: ExecutionLog[];
  status: "idle" | "running" | "success" | "failed";
  onClose: () => void;
  executionId?: string;
  onStreamedLogs?: (logs: ExecutionLog[]) => void;
  onStreamStatus?: (status: "success" | "failed") => void;
}

const MIN_H = 180;
const MAX_H = 600;
const DEFAULT_H = 280;

export default function WorkflowLogger({ logs, status, onClose, executionId, onStreamedLogs, onStreamStatus }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [height, setHeight] = useState(DEFAULT_H);
  const [allCopied, setAllCopied] = useState(false);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(DEFAULT_H);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stamp each log entry with a time when it first appears
  const stampedLogs = useRef<Map<number, string>>(new Map());
  logs.forEach((_, i) => {
    if (!stampedLogs.current.has(i)) stampedLogs.current.set(i, timestamp());
  });

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  // SSE streaming: when executionId is provided, connect to stream and append logs in real-time
  useEffect(() => {
    if (!executionId) return;

    const streamedLogs: ExecutionLog[] = [];
    const es = new EventSource(`/api/executions/${executionId}/stream`);

    es.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data) as ExecutionLog;
        streamedLogs.push(log);
        onStreamedLogs?.([...streamedLogs]);
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener("done", (event) => {
      try {
        const { status: finalStatus } = JSON.parse((event as MessageEvent).data) as { status: string };
        if (finalStatus === "success" || finalStatus === "failed") {
          onStreamStatus?.(finalStatus as "success" | "failed");
        }
      } catch {
        // ignore
      }
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [executionId, onStreamedLogs, onStreamStatus]);

  // Drag to resize
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - me.clientY;
      setHeight(Math.min(MAX_H, Math.max(MIN_H, startH.current + delta)));
    };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.status !== filter) return false;
    if (search && !l.node_label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;
  const skippedCount = logs.filter((l) => l.status === "skipped").length;
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration_ms ?? 0), 0);

  const copyAll = () => {
    const text = logs.map((l, i) =>
      `[${stampedLogs.current.get(i) ?? ""}] ${l.status.toUpperCase().padEnd(8)} ${l.node_label}${l.duration_ms ? ` (${l.duration_ms}ms)` : ""}${l.error ? `\n  ERROR: ${l.error}` : ""}${l.output ? `\n  OUTPUT: ${JSON.stringify(l.output)}` : ""}`
    ).join("\n");
    navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 1500);
  };

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: logs.length },
    { key: "success", label: "Success", count: successCount },
    { key: "error", label: "Errors", count: errorCount },
    { key: "skipped", label: "Skipped", count: skippedCount },
  ];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-[#0d1117] border-t border-white/10 shadow-2xl z-20 flex flex-col select-none"
      style={{ height }}
    >
      {/* Drag handle */}
      <div
        className="h-3 flex items-center justify-center cursor-ns-resize hover:bg-white/5 transition-colors flex-shrink-0 group"
        onMouseDown={onMouseDown}
      >
        <GripHorizontal size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-200">Execution Log</span>
        </div>

        {/* Status badge */}
        {status === "running" && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
            <Loader2 size={9} className="animate-spin" /> Running
          </span>
        )}
        {status === "success" && (
          <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
            ✓ Done — {totalDuration}ms
          </span>
        )}
        {status === "failed" && (
          <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
            ✗ Failed
          </span>
        )}

        {/* Stats */}
        {logs.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] ml-1">
            {successCount > 0 && <span className="text-green-400">{successCount} ok</span>}
            {errorCount > 0 && <span className="text-red-400">{errorCount} err</span>}
            {skippedCount > 0 && <span className="text-gray-500">{skippedCount} skip</span>}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1 ml-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                filter === f.key
                  ? "bg-white/15 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f.label} {f.count > 0 && <span className="opacity-60">{f.count}</span>}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="filter nodes…"
          className="ml-1 bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-[10px] text-gray-300 placeholder-gray-600 outline-none focus:border-white/20 w-28"
        />

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={copyAll} title="Copy all logs" className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
            {allCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
          <button onClick={() => { stampedLogs.current.clear(); }} title="Clear timestamps" className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Log body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-gray-600 font-mono">
              {logs.length === 0 ? "▶ Run the workflow to see logs here" : "No entries match the current filter"}
            </p>
          </div>
        ) : (
          filtered.map((log, i) => (
            <LogLine
              key={i}
              log={{ ...log, _ts: stampedLogs.current.get(logs.indexOf(log)) }}
              index={i}
            />
          ))
        )}

        {status === "running" && (
          <div className="px-3 py-1.5 flex items-center gap-2 font-mono text-[11px] text-gray-600 animate-pulse">
            <span className="w-5 text-right select-none">&nbsp;</span>
            <span className="w-28">{timestamp()}</span>
            <Loader2 size={11} className="animate-spin text-blue-500" />
            <span className="text-blue-500">executing…</span>
          </div>
        )}
      </div>
    </div>
  );
}
