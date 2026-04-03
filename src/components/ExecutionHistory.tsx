"use client";

import { useEffect, useState, useCallback } from "react";
import type { Execution, ExecutionLog } from "@/lib/types";
import {
  CheckCircle, XCircle, Loader2, Clock, ChevronDown,
  ChevronRight, X, RefreshCw, AlertCircle, MinusCircle, RotateCcw,
} from "lucide-react";

function duration(e: Execution) {
  if (!e.finished_at) return "—";
  const ms = new Date(e.finished_at).getTime() - new Date(e.started_at).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function LogRow({ log }: { log: ExecutionLog }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(log.output ?? log.error ?? log.input);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden text-[11px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
      >
        {log.status === "running" ? (
          <Loader2 size={11} className="animate-spin text-blue-400 flex-shrink-0" />
        ) : log.status === "success" ? (
          <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
        ) : log.status === "skipped" ? (
          <MinusCircle size={11} className="text-gray-400 flex-shrink-0" />
        ) : (
          <XCircle size={11} className="text-red-500 flex-shrink-0" />
        )}
        <span className="font-medium text-gray-700 flex-1 truncate">{log.node_label}</span>
        {log.duration_ms !== undefined && (
          <span className="text-gray-400 flex-shrink-0">{log.duration_ms}ms</span>
        )}
        {hasDetail && (
          open
            ? <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={11} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {open && hasDetail && (
        <div className="px-3 pb-3 space-y-2 bg-gray-50 border-t border-gray-100">
          {log.error && (
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase mt-2 mb-1">Error</p>
              <pre className="text-[10px] text-red-600 bg-red-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {log.error}
              </pre>
            </div>
          )}
          {log.output !== undefined && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mt-2 mb-1">Output</p>
              <pre className="text-[10px] text-gray-600 bg-white rounded p-2 border border-gray-100 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExecutionRow({ execution, onRerun }: { execution: Execution; onRerun: (e: Execution) => void }) {
  const [open, setOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const logs: ExecutionLog[] = execution.logs ?? [];
  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;

  async function handleRerun(ev: React.MouseEvent) {
    ev.stopPropagation();
    setRerunning(true);
    await onRerun(execution);
    setRerunning(false);
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors">
        {/* Status icon */}
        {execution.status === "running" ? (
          <Loader2 size={13} className="animate-spin text-blue-500 flex-shrink-0" />
        ) : execution.status === "success" ? (
          <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
        ) : (
          <XCircle size={13} className="text-red-500 flex-shrink-0" />
        )}

        {/* Main info — clickable to expand */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                execution.status === "success"
                  ? "bg-green-50 text-green-600"
                  : execution.status === "failed"
                  ? "bg-red-50 text-red-600"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              {execution.status}
            </span>
            <span className="text-[10px] text-gray-400">
              {successCount}/{logs.length} nodes · {duration(execution)}
            </span>
            {errorCount > 0 && (
              <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                <AlertCircle size={9} /> {errorCount} error{errorCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
            <Clock size={9} /> {timeAgo(execution.started_at)}
          </p>
        </button>

        {/* Re-run button */}
        <button
          onClick={handleRerun}
          disabled={rerunning}
          title="Re-run with same trigger data"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-gray-100 hover:bg-violet-100 text-gray-500 hover:text-violet-600 transition-colors flex-shrink-0 disabled:opacity-50"
        >
          {rerunning
            ? <Loader2 size={10} className="animate-spin" />
            : <RotateCcw size={10} />
          }
          Re-run
        </button>

        {/* Expand toggle */}
        <button onClick={() => setOpen((v) => !v)} className="flex-shrink-0">
          {open
            ? <ChevronDown size={13} className="text-gray-400" />
            : <ChevronRight size={13} className="text-gray-400" />
          }
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50/50 space-y-1.5 pt-2">
          {logs.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-2">No logs recorded.</p>
          ) : (
            logs.map((log, i) => <LogRow key={i} log={log} />)
          )}

          {/* Trigger data */}
          {execution.trigger_data && Object.keys(execution.trigger_data).length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Trigger Input</p>
              <pre className="text-[10px] text-gray-500 bg-white rounded p-2 border border-gray-100 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(execution.trigger_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type StatusFilter = "all" | "success" | "failed" | "running";

interface Props {
  workflowId: string;
  onClose: () => void;
}

export default function ExecutionHistory({ workflowId, onClose }: Props) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/executions/${workflowId}`)
      .then((r) => r.json())
      .then((data) => setExecutions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 seconds for streaming triggers (CDC, webhooks, etc.)
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleRerun(execution: Execution) {
    await fetch(`/api/execute/${workflowId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_data: execution.trigger_data ?? {} }),
    });
    load();
  }

  const filtered = statusFilter === "all"
    ? executions
    : executions.filter((e) => e.status === statusFilter);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "success", label: "Success" },
    { value: "failed", label: "Failed" },
    { value: "running", label: "Running" },
  ];

  return (
    <div className="absolute inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Execution History</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Last 50 runs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-100 flex-shrink-0">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-300" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No executions yet.</p>
            <p className="text-[10px] text-gray-300 mt-1">Run the workflow to see logs here.</p>
          </div>
        ) : (
          filtered.map((e) => <ExecutionRow key={e.id} execution={e} onRerun={handleRerun} />)
        )}
      </div>
    </div>
  );
}
