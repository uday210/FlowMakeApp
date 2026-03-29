"use client";

import type { ExecutionLog } from "@/lib/types";
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, MinusCircle } from "lucide-react";
import { useState } from "react";

function LogEntry({ log }: { log: ExecutionLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(log.output ?? log.error ?? log.input);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
      >
        {log.status === "running" ? (
          <Loader2 size={12} className="animate-spin text-blue-500 flex-shrink-0" />
        ) : log.status === "success" ? (
          <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
        ) : log.status === "skipped" ? (
          <MinusCircle size={12} className="text-gray-400 flex-shrink-0" />
        ) : (
          <XCircle size={12} className="text-red-500 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-gray-700 flex-1 truncate">
          {log.node_label}
        </span>
        {log.duration_ms !== undefined && (
          <span className="text-[10px] text-gray-400">{log.duration_ms}ms</span>
        )}
        {hasDetails && (
          expanded
            ? <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
        )}
      </button>
      {expanded && hasDetails && (
        <div className="px-3 pb-3 space-y-2 bg-gray-50">
          {log.error && (
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase mb-1">Error</p>
              <pre className="text-[10px] text-red-600 bg-red-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {log.error}
              </pre>
            </div>
          )}
          {Boolean(log.output) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Output</p>
              <pre className="text-[10px] text-gray-600 bg-white rounded p-2 border border-gray-100 overflow-x-auto whitespace-pre-wrap">
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
}

export default function ExecutionPanel({ logs, status, onClose }: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl z-10 max-h-72 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Execution Results</span>
          {status === "running" && (
            <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <Loader2 size={10} className="animate-spin" /> Running
            </span>
          )}
          {status === "success" && (
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Success
            </span>
          )}
          {status === "failed" && (
            <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              Failed
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
      <div className="overflow-y-auto p-3 space-y-2 flex-1">
        {logs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No logs yet...</p>
        ) : (
          logs.map((log, i) => <LogEntry key={i} log={log} />)
        )}
      </div>
    </div>
  );
}
