"use client";

import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import { ClipboardList, Loader2, RefreshCw, CheckCircle, XCircle, Zap, Trash2, Plus } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

function actionIcon(action: string) {
  if (action.includes("created")) return <Plus size={12} className="text-green-500" />;
  if (action.includes("deleted")) return <Trash2 size={12} className="text-red-400" />;
  if (action === "execution.triggered") return <Zap size={12} className="text-violet-500" />;
  return <CheckCircle size={12} className="text-gray-400" />;
}

function actionLabel(action: string, meta: Record<string, unknown>) {
  switch (action) {
    case "workflow.created": return `Created scenario "${meta.name ?? ""}"`;
    case "workflow.deleted": return `Deleted scenario`;
    case "execution.triggered": return `Execution ${meta.status === "success" ? "succeeded" : "failed"} for scenario`;
    default: return action;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  function load() {
    setLoading(true);
    fetch("/api/audit-logs")
      .then((r) => r.json())
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const actionTypes = ["all", "workflow.created", "workflow.deleted", "execution.triggered"];

  const filtered = filter === "all" ? logs : logs.filter((l) => l.action === filter);

  return (
    <AppShell>
      <PageHeader
        title="Activity Log"
        subtitle="Audit trail of all actions in your organization"
        action={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {actionTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === t ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300"
              }`}
            >
              {t === "all" ? "All events" : t}
            </button>
          ))}
        </div>

        {/* Log table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <ClipboardList size={32} className="text-gray-200" />
            <p className="text-sm">No activity recorded yet.</p>
            <p className="text-xs text-gray-300">Actions like creating or running scenarios will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {filtered.map((log, i) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 px-5 py-3 text-sm ${i !== 0 ? "border-t border-gray-50" : ""}`}
              >
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {log.action.includes("deleted")
                    ? <XCircle size={14} className="text-red-400" />
                    : actionIcon(log.action)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate">{actionLabel(log.action, log.meta)}</p>
                  {log.resource_id && (
                    <p className="text-[10px] text-gray-400 truncate font-mono">{log.resource_id}</p>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
