"use client";

import { useEffect, useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  ClipboardList, Loader2, RefreshCw, CheckCircle, XCircle,
  Zap, Trash2, Plus, ChevronDown, ChevronRight, PenLine,
  Shield, Table2, KeyRound, Database, Bot, Plug, FileText, Mail, FileSignature,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: (meta: Record<string, unknown>) => string; icon: React.ReactNode; color: string }> = {
  "workflow.created":       { label: (m) => `Created scenario "${m.name ?? "Untitled"}"`, icon: <Plus size={13} />, color: "text-green-500 bg-green-50" },
  "workflow.updated":       { label: (m) => `Saved scenario "${m.name ?? ""}" (${m.node_count ?? 0} nodes)`, icon: <PenLine size={13} />, color: "text-blue-500 bg-blue-50" },
  "workflow.deleted":       { label: () => "Deleted a scenario", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "execution.triggered":    { label: (m) => `Ran "${m.workflow_name ?? "scenario"}" — ${m.nodes_success ?? 0}/${m.nodes_total ?? 0} nodes succeeded`, icon: <Zap size={13} />, color: "text-violet-500 bg-violet-50" },
  "connection.created":     { label: (m) => `Added ${m.type ?? ""} connection "${m.name ?? ""}"`, icon: <Shield size={13} />, color: "text-green-500 bg-green-50" },
  "connection.deleted":     { label: () => "Deleted a connection", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "table.created":          { label: (m) => `Created table "${m.name ?? ""}"`, icon: <Table2 size={13} />, color: "text-green-500 bg-green-50" },
  "table.deleted":          { label: () => "Deleted a table", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "apikey.created":         { label: (m) => `Created API key "${m.name ?? ""}"`, icon: <KeyRound size={13} />, color: "text-green-500 bg-green-50" },
  "apikey.deleted":         { label: () => "Deleted an API key", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "secret.created":         { label: (m) => `Added secret "${m.name ?? ""}"`, icon: <KeyRound size={13} />, color: "text-green-500 bg-green-50" },
  "secret.deleted":         { label: (m) => `Deleted secret "${m.name ?? ""}"`, icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "datastore.set":          { label: (m) => `Set datastore key "${m.key ?? ""}"`, icon: <Database size={13} />, color: "text-blue-500 bg-blue-50" },
  "datastore.deleted":      { label: (m) => `Deleted datastore key "${m.key ?? ""}"`, icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "agent.created":          { label: (m) => `Created agent "${m.name ?? ""}"`, icon: <Bot size={13} />, color: "text-green-500 bg-green-50" },
  "agent.deleted":          { label: () => "Deleted an agent", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "mcp_toolbox.created":    { label: (m) => `Created MCP toolbox "${m.name ?? ""}"`, icon: <Plug size={13} />, color: "text-green-500 bg-green-50" },
  "mcp_toolbox.deleted":    { label: () => "Deleted an MCP toolbox", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "doc_template.created":   { label: (m) => `Uploaded doc template "${m.name ?? ""}"`, icon: <FileText size={13} />, color: "text-green-500 bg-green-50" },
  "doc_template.deleted":   { label: () => "Deleted a doc template", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "email_template.created": { label: (m) => `Created email template "${m.name ?? ""}"`, icon: <Mail size={13} />, color: "text-green-500 bg-green-50" },
  "email_template.deleted": { label: () => "Deleted an email template", icon: <Trash2 size={13} />, color: "text-red-500 bg-red-50" },
  "esign_document.created": { label: (m) => `Sent e-sign document "${m.name ?? m.title ?? ""}"`, icon: <FileSignature size={13} />, color: "text-green-500 bg-green-50" },
};

const FILTER_GROUPS = [
  { label: "All", value: "all" },
  { label: "Scenarios", value: "workflow" },
  { label: "Executions", value: "execution" },
  { label: "Connections", value: "connection" },
  { label: "Tables", value: "table" },
  { label: "API Keys", value: "apikey" },
  { label: "Secrets", value: "secret" },
  { label: "Agents", value: "agent" },
  { label: "Other", value: "other" },
];

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function MetaDetail({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2 text-[11px]">
      <span className="text-gray-400 font-medium min-w-[80px]">{label}</span>
      <span className="text-gray-600 break-all">
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </span>
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const cfg = ACTION_CONFIG[log.action];
  const label = cfg ? cfg.label(log.meta) : log.action;
  const icon = cfg?.icon ?? <CheckCircle size={13} />;
  const color = cfg?.color ?? "text-gray-500 bg-gray-50";

  const isError = log.action === "execution.triggered" && log.meta.status === "failed";

  const metaEntries = Object.entries(log.meta).filter(([k]) =>
    !["workflow_id"].includes(k)
  );

  return (
    <div className={`border-b border-gray-50 last:border-0 ${open ? "bg-gray-50/50" : ""}`}>
      <button
        onClick={() => metaEntries.length > 0 && setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Icon badge */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          {icon}
        </div>

        {/* Main label */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isError ? "text-red-600" : "text-gray-800"} truncate`}>
            {label}
          </p>
          {log.meta.status === "failed" && Number(log.meta.nodes_error) > 0 && (
            <p className="text-[11px] text-red-400 mt-0.5">
              {Number(log.meta.nodes_error)} node{Number(log.meta.nodes_error) > 1 ? "s" : ""} failed
            </p>
          )}
          {log.resource_id && !cfg && (
            <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{log.resource_id}</p>
          )}
        </div>

        {/* Time */}
        <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(log.created_at)}</span>

        {/* Expand chevron */}
        {metaEntries.length > 0 && (
          open ? <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
               : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-5 pb-3 space-y-1.5 ml-10">
          <MetaDetail label="Status" value={log.meta.status} />
          <MetaDetail label="Workflow" value={log.meta.workflow_name} />
          <MetaDetail label="Nodes run" value={log.meta.nodes_total !== undefined ? `${log.meta.nodes_success} succeeded · ${log.meta.nodes_error} failed · ${log.meta.nodes_skipped} skipped` : undefined} />
          <MetaDetail label="Node count" value={log.meta.node_count} />
          <MetaDetail label="Name" value={log.meta.name} />
          <MetaDetail label="Type" value={log.meta.type} />
          <MetaDetail label="Key" value={log.meta.key} />
          {Array.isArray(log.meta.errors) && log.meta.errors.length > 0 && (
            <div className="text-[11px] mt-1">
              <span className="text-gray-400 font-medium">Errors</span>
              <div className="mt-1 space-y-1">
                {(log.meta.errors as { node: string; error?: string }[]).map((e, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded px-2 py-1">
                    <span className="text-red-500 font-medium">{e.node}:</span>{" "}
                    <span className="text-red-400">{e.error ?? "unknown error"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <MetaDetail label="Resource ID" value={log.resource_id} />
        </div>
      )}
    </div>
  );
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

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "other") return !["workflow", "execution", "connection", "table", "apikey", "secret", "agent"].some((k) => l.action.startsWith(k));
    return l.action.startsWith(filter);
  });

  // Group by day
  const groups: { day: string; logs: AuditLog[] }[] = [];
  for (const log of filtered) {
    const day = formatDay(log.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.logs.push(log);
    else groups.push({ day, logs: [log] });
  }

  return (
    <AppShell>
      <PageHeader
        title="Activity Log"
        subtitle={`${logs.length} events recorded for your organization`}
        action={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g.value}
              onClick={() => setFilter(g.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === g.value
                  ? "bg-violet-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300"
              }`}
            >
              {g.label}
              {g.value !== "all" && (
                <span className="ml-1.5 opacity-60">
                  {logs.filter((l) => g.value === "other"
                    ? !["workflow","execution","connection","table","apikey","secret","agent"].some((k) => l.action.startsWith(k))
                    : l.action.startsWith(g.value)
                  ).length}
                </span>
              )}
            </button>
          ))}
        </div>

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
          <div className="space-y-6">
            {groups.map(({ day, logs: dayLogs }) => (
              <div key={day}>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-1">{day}</p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {dayLogs.map((log) => <LogRow key={log.id} log={log} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
