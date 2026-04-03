"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Node, Edge } from "@xyflow/react";
import type { Workflow, NodeData, ExecutionLog, Execution } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import NodeConfigPanel from "@/components/NodeConfigPanel";
import WorkflowLogger from "@/components/WorkflowLogger";
import ConnectionsManager from "@/components/ConnectionsManager";
import ScenarioStatsPanel from "@/components/ScenarioStatsPanel";
import AIBuilderPanel from "@/components/AIBuilderPanel";
import {
  Save, Play, ArrowLeft, Loader2, CheckCircle, AlertCircle,
  Plug, GitBranch, X, RotateCcw, RefreshCw, ChevronDown, ChevronRight,
  Clock, XCircle, MinusCircle, Sparkles,
} from "lucide-react";

const Canvas = dynamic(() => import("@/components/Canvas"), { ssr: false });

type ExecStatus = "idle" | "running" | "success" | "failed";
type ActiveTab = "diagram" | "history" | "incomplete";

interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  created_at: string;
}

// ─── History tab ──────────────────────────────────────────────────────────────

function duration(e: Execution) {
  if (!e.finished_at) return "—";
  const ms = new Date(e.finished_at).getTime() - new Date(e.started_at).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function JsonBlock({ value, label }: { value: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  const isEmpty = value === undefined || value === null ||
    (typeof value === "object" && Object.keys(value as object).length === 0);
  if (isEmpty) return null;

  const formatted = (() => {
    try { return JSON.stringify(value, null, 2); }
    catch { return String(value); }
  })();

  // Inline preview: first 80 chars of compact JSON
  const preview = (() => {
    try {
      const s = JSON.stringify(value);
      return s.length > 80 ? s.slice(0, 78) + "…" : s;
    } catch { return String(value); }
  })();

  return (
    <div className="mt-1.5">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors group"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className={`uppercase tracking-wider ${label === "Input" ? "text-blue-400" : label === "Output" ? "text-green-500" : "text-red-400"}`}>
          {label}
        </span>
        {!open && (
          <span className="font-normal text-gray-300 ml-1 font-mono truncate max-w-[400px]">{preview}</span>
        )}
      </button>
      {open && (
        <pre className="mt-1.5 text-[10px] leading-relaxed font-mono bg-gray-950 text-gray-100 rounded-lg px-4 py-3 overflow-x-auto max-h-64 overflow-y-auto border border-gray-800 whitespace-pre-wrap break-words">
          {formatted}
        </pre>
      )}
    </div>
  );
}

function NodeLogRow({ log }: { log: ExecutionLog }) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.input !== undefined || log.output !== undefined || log.error;

  return (
    <div className={`rounded-xl border transition-colors ${
      log.status === "success" ? "border-green-100 bg-green-50/30" :
      log.status === "error" ? "border-red-100 bg-red-50/20" :
      log.status === "skipped" ? "border-gray-100 bg-gray-50/50" :
      "border-blue-100 bg-blue-50/20"
    }`}>
      {/* Header row */}
      <button
        onClick={() => hasDetails && setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
      >
        {/* Status icon */}
        <div className="flex-shrink-0">
          {log.status === "running" ? (
            <Loader2 size={13} className="animate-spin text-blue-400" />
          ) : log.status === "success" ? (
            <CheckCircle size={13} className="text-green-500" />
          ) : log.status === "skipped" ? (
            <MinusCircle size={13} className="text-gray-300" />
          ) : (
            <XCircle size={13} className="text-red-400" />
          )}
        </div>

        {/* Node name */}
        <span className="text-xs font-semibold text-gray-800 flex-1">{log.node_label}</span>

        {/* Status pill */}
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          log.status === "success" ? "bg-green-100 text-green-600" :
          log.status === "error" ? "bg-red-100 text-red-500" :
          log.status === "skipped" ? "bg-gray-100 text-gray-400" :
          "bg-blue-100 text-blue-500"
        }`}>{log.status}</span>

        {/* Duration */}
        {log.duration_ms !== undefined && (
          <span className="text-[10px] text-gray-400 font-mono ml-1">{log.duration_ms}ms</span>
        )}

        {/* Expand chevron */}
        {hasDetails && (
          open ? <ChevronDown size={12} className="text-gray-300 flex-shrink-0" />
               : <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
        )}
      </button>

      {/* Expanded: input / output / error */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-1">
          {log.error && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Error</p>
              <pre className="text-[10px] font-mono bg-red-950/80 text-red-200 rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap break-words">
                {log.error}
              </pre>
            </div>
          )}
          <JsonBlock value={log.input} label="Input" />
          <JsonBlock value={log.output} label="Output" />
        </div>
      )}
    </div>
  );
}

function HistoryTab({ workflowId }: { workflowId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/executions/${workflowId}`)
      .then(r => r.json())
      .then(d => setExecutions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-gray-900">History</h2>
        <button
          onClick={load}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {executions.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No execution history yet.</p>
          <p className="text-xs text-gray-300 mt-1">Run the workflow to see results here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map(e => {
            const logs = (e.logs ?? []) as ExecutionLog[];
            const ops = logs.filter(l => l.status === "success" || l.status === "error").length;
            const isOpen = expanded === e.id;

            return (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Execution header */}
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* Expand button (left side) */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {/* Expand indicator */}
                    {isOpen
                      ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                      : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                    }

                    {/* Status icon */}
                    {e.status === "success" ? (
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    ) : e.status === "failed" ? (
                      <XCircle size={16} className="text-red-400 flex-shrink-0" />
                    ) : e.status === "running" ? (
                      <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />
                    ) : (
                      <MinusCircle size={16} className="text-gray-300 flex-shrink-0" />
                    )}

                    {/* Run name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {e.trigger_data && Object.keys(e.trigger_data).length > 0
                          ? "Triggered with data" : "Manual run"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(e.started_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                      </p>
                    </div>
                  </button>

                  {/* Stats (right side) */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">Nodes</p>
                      <p className="text-xs font-bold text-gray-600">{ops}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">Duration</p>
                      <p className="text-xs font-bold text-gray-600 font-mono">{duration(e)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                      e.status === "success" ? "bg-green-50 text-green-600 border-green-200" :
                      e.status === "failed" ? "bg-red-50 text-red-500 border-red-200" :
                      e.status === "running" ? "bg-blue-50 text-blue-500 border-blue-200" :
                      "bg-gray-50 text-gray-400 border-gray-200"
                    }`}>{e.status}</span>
                  </div>
                </div>

                {/* Trigger data (always shown when expanded) */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {/* Trigger data section */}
                    {e.trigger_data && Object.keys(e.trigger_data).length > 0 && (
                      <div className="px-5 py-3 bg-violet-50/40 border-b border-violet-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">Trigger Data</p>
                        <pre className="text-[10px] font-mono text-violet-800 bg-white rounded-lg border border-violet-100 px-3 py-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(e.trigger_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Node logs */}
                    {logs.length > 0 ? (
                      <div className="px-5 py-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                          Node Execution Log · {logs.length} node{logs.length !== 1 ? "s" : ""}
                        </p>
                        {logs.map((log, i) => (
                          <NodeLogRow key={i} log={log} />
                        ))}
                      </div>
                    ) : (
                      <div className="px-5 py-6 text-center text-xs text-gray-400">
                        No node logs available for this execution.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Incomplete Executions tab ────────────────────────────────────────────────

function IncompleteTab({ workflowId }: { workflowId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/executions/${workflowId}`)
      .then(r => r.json())
      .then(d => {
        const all = Array.isArray(d) ? d : [];
        setExecutions(all.filter((e: Execution) => e.status === "running" || e.status === "pending"));
      })
      .finally(() => setLoading(false));
  }, [workflowId]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-300" /></div>;
  }

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <h2 className="text-base font-bold text-gray-900 mb-5">Incomplete Executions</h2>
      {executions.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No incomplete executions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {executions.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Loader2 size={14} className="animate-spin text-blue-400" />
              <span className="text-xs text-gray-600">
                Started {new Date(e.started_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function WorkflowEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("diagram");
  const [nodeDataPatch, setNodeDataPatch] = useState<{ nodeId: string; data: Partial<NodeData> } | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [execStatus, setExecStatus] = useState<ExecStatus>("idle");
  const [execLogs, setExecLogs] = useState<ExecutionLog[]>([]);
  const [showExec, setShowExec] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionSaveStatus, setVersionSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const [statsKey, setStatsKey] = useState(0); // force-refresh stats panel
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [execNodeStatuses, setExecNodeStatuses] = useState<Record<string, string>>({});
  const [canvasKey, setCanvasKey] = useState(0);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [aiInjectVersion, setAiInjectVersion] = useState(0);
  const prevNodeCount = useRef(0);
  const prevEdgeCount = useRef(0);

  useEffect(() => {
    const handler = () => setShowConnections(true);
    window.addEventListener("open-connections", handler);
    return () => window.removeEventListener("open-connections", handler);
  }, []);

  useEffect(() => {
    fetch(`/api/workflows/${id}`)
      .then(r => r.json())
      .then((data: Workflow) => {
        setWorkflow(data);
        setNodes(((data.nodes as unknown as Node[]) || []).map(n => ({ ...n, type: n.type ?? "workflowNode" })));
        setEdges((data.edges as unknown as Edge[]) || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Reset edge highlight colors when nodes or edges are structurally changed
  const handleNodesChange = useCallback((newNodes: Node[]) => {
    if (prevNodeCount.current !== 0 && newNodes.length !== prevNodeCount.current) {
      setExecNodeStatuses({});
    }
    prevNodeCount.current = newNodes.length;
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    if (prevEdgeCount.current !== 0 && newEdges.length !== prevEdgeCount.current) {
      setExecNodeStatuses({});
    }
    prevEdgeCount.current = newEdges.length;
    setEdges(newEdges);
  }, []);

  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setSaving(true);
    setExecNodeStatuses({});
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...workflow, nodes, edges }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch { setSaveStatus("error"); }
    finally { setSaving(false); }
  }, [workflow, nodes, edges, id]);

  const handleRun = useCallback(async () => {
    setExecStatus("running");
    setExecLogs([]);
    setExecNodeStatuses({});
    setShowExec(true);
    try {
      const res = await fetch(`/api/execute/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _trigger: "manual" }),
      });
      const data = await res.json();
      setExecStatus(data.status === "success" ? "success" : "failed");
      setExecLogs(data.logs || []);
      setStatsKey(k => k + 1);
      // Build node status map for edge highlighting
      const statusMap: Record<string, string> = {};
      for (const log of (data.logs || []) as ExecutionLog[]) {
        statusMap[log.node_id] = log.status;
      }
      setExecNodeStatuses(statusMap);
    } catch { setExecStatus("failed"); }
  }, [id]);

  const handleNodeUpdate = useCallback(async (nodeId: string, data: Partial<NodeData>, wf: Workflow | null, currentNodes: Node[], currentEdges: Edge[]) => {
    setNodeDataPatch({ nodeId, data });
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev);
    if (!wf) return;
    const updatedNodes = currentNodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n);
    await fetch(`/api/workflows/${wf.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...wf, nodes: updatedNodes, edges: currentEdges }),
    });
  }, []);

  const handleToggleActive = useCallback(async () => {
    if (!workflow) return;
    const updated = { ...workflow, is_active: !workflow.is_active };
    setWorkflow(updated);
    await fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updated, nodes, edges }),
    });
  }, [workflow, nodes, edges, id]);

  const handleNameChange = useCallback((newName: string) => {
    if (!workflow) return;
    setWorkflow({ ...workflow, name: newName });
  }, [workflow]);

  const handleSaveVersion = useCallback(async () => {
    if (!workflow) return;
    setSavingVersion(true);
    try {
      const res = await fetch(`/api/workflows/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges, name: workflow.name }),
      });
      setVersionSaveStatus(res.ok ? "saved" : "error");
      setTimeout(() => setVersionSaveStatus("idle"), 2000);
      if (res.ok && showVersions) {
        const vRes = await fetch(`/api/workflows/${id}/versions`);
        if (vRes.ok) setVersions(await vRes.json());
      }
    } catch { setVersionSaveStatus("error"); }
    finally { setSavingVersion(false); }
  }, [workflow, nodes, edges, id, showVersions]);

  const handleOpenVersions = useCallback(async () => {
    setShowVersions(v => !v);
    setShowConnections(false);
    setSelectedNode(null);
    if (!showVersions) {
      setVersionsLoading(true);
      try {
        const res = await fetch(`/api/workflows/${id}/versions`);
        if (res.ok) setVersions(await res.json());
      } finally { setVersionsLoading(false); }
    }
  }, [showVersions, id]);

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!workflow) return;
    try {
      const res = await fetch(`/api/workflows/${id}/versions/${versionId}`);
      if (!res.ok) return;
      const version = await res.json();
      const snapshot = version.snapshot as { nodes?: unknown[]; edges?: unknown[] };
      const restoredNodes = snapshot.nodes
        ? (snapshot.nodes as Node[]).map(n => ({ ...n, type: n.type ?? "workflowNode" }))
        : nodes;
      const restoredEdges = (snapshot.edges as Edge[]) ?? edges;
      // Update page state
      setNodes(restoredNodes);
      setEdges(restoredEdges);
      // Force Canvas to remount with the restored nodes/edges
      setCanvasKey(k => k + 1);
      setExecNodeStatuses({});
      setShowVersions(false);
      // Persist the restored state to DB so it's not lost on navigation
      await fetch(`/api/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...workflow, nodes: restoredNodes, edges: restoredEdges }),
      });
    } catch { /* silent */ }
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-300" size={32} />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Workflow not found.</p>
      </div>
    );
  }

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "diagram", label: "Diagram" },
    { key: "history", label: "History" },
    { key: "incomplete", label: "Incomplete Executions" },
  ];

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      {/* ── Top Bar ── */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 bg-white z-20 flex-shrink-0">
        <button
          onClick={() => router.push("/workflows")}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </button>

        <input
          className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-gray-100 rounded-lg px-2 py-1 transition-colors min-w-0 max-w-[220px]"
          value={workflow.name}
          onChange={e => handleNameChange(e.target.value)}
          onBlur={handleSave}
        />

        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 flex-shrink-0">
            <CheckCircle size={11} /> Saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="flex items-center gap-1 text-[10px] text-red-500 flex-shrink-0">
            <AlertCircle size={11} /> Error
          </span>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleOpenVersions}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
              showVersions ? "bg-gray-800 text-white border-gray-800" : "text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <GitBranch size={13} />
            {versionSaveStatus === "saved" ? "✓ Saved" : "Versions"}
          </button>

          <button
            onClick={() => { setShowConnections(v => !v); setSelectedNode(null); setShowVersions(false); setShowAIBuilder(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
              showConnections ? "bg-gray-800 text-white border-gray-800" : "text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Plug size={13} /> Connections
          </button>

          <button
            onClick={() => { setShowAIBuilder(v => !v); setShowConnections(false); setShowVersions(false); setSelectedNode(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg transition-all ${
              showAIBuilder
                ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200"
                : "text-violet-600 border-violet-200 hover:bg-violet-50"
            }`}
          >
            <Sparkles size={13} /> AI Builder
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Active toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${workflow.is_active ? "text-gray-400" : "text-gray-700"}`}>Inactive</span>
          <button
            onClick={handleToggleActive}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${workflow.is_active ? "bg-violet-600" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${workflow.is_active ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className={`text-xs font-medium ${workflow.is_active ? "text-violet-600" : "text-gray-400"}`}>Active</span>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>

        <button
          onClick={handleSaveVersion}
          disabled={savingVersion}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors disabled:opacity-50"
        >
          {savingVersion ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
          Snapshot
        </button>

        <button
          onClick={handleRun}
          disabled={execStatus === "running"}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-60 shadow-sm"
        >
          {execStatus === "running" ? <><Loader2 size={13} className="animate-spin" /> Running…</> : <><Play size={13} /> Run once</>}
        </button>
      </header>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0 px-6 border-b border-gray-200 bg-white flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      {activeTab === "diagram" && (
        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar collapsed={leftCollapsed} onToggle={() => setLeftCollapsed(v => !v)} />

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <Canvas
              key={canvasKey}
              initialNodes={nodes}
              initialEdges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onNodeSelect={setSelectedNode}
              nodeDataPatch={nodeDataPatch}
              onNodePatchApplied={() => setNodeDataPatch(null)}
              nodeStatuses={execNodeStatuses}
              externalInject={aiInjectVersion > 0 ? { nodes, edges, version: aiInjectVersion } : null}
            />
            {showExec && (
              <WorkflowLogger logs={execLogs} status={execStatus} onClose={() => setShowExec(false)} />
            )}
          </div>

          {/* Versions panel */}
          {showVersions && (
            <div className="w-72 border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <GitBranch size={13} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-800">Version History</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSaveVersion}
                    disabled={savingVersion}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-600 border border-violet-200 rounded-md hover:bg-violet-50 transition-colors disabled:opacity-50"
                  >
                    {savingVersion ? <Loader2 size={9} className="animate-spin" /> : <GitBranch size={9} />}
                    Save now
                  </button>
                  <button onClick={() => setShowVersions(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {versionsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={18} className="animate-spin text-gray-300" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <GitBranch size={24} className="text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">No snapshots yet</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {versions.map(version => (
                      <li key={version.id} className="px-4 py-3 hover:bg-gray-50 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-gray-800">v{version.version_number}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(version.created_at).toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => handleRestoreVersion(version.id)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          >
                            <RotateCcw size={9} /> Restore
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Connections */}
          {showConnections && <ConnectionsManager onClose={() => setShowConnections(false)} />}

          {/* AI Builder */}
          {showAIBuilder && (
            <AIBuilderPanel
              workflowId={id}
              nodes={nodes}
              edges={edges}
              onNodesChange={(newNodes) => {
                handleNodesChange(newNodes);
                setAiInjectVersion(v => v + 1);
                // Keep NodeConfigPanel in sync if the selected node was updated
                setSelectedNode(prev => {
                  if (!prev) return prev;
                  const fresh = newNodes.find(n => n.id === prev.id);
                  return fresh ?? prev;
                });
              }}
              onEdgesChange={(newEdges) => { handleEdgesChange(newEdges); setAiInjectVersion(v => v + 1); }}
              onClose={() => setShowAIBuilder(false)}
              onSave={handleSave}
            />
          )}

          {/* Node config */}
          {selectedNode && !showConnections && (
            <NodeConfigPanel
              node={selectedNode}
              workflowId={id}
              onClose={() => setSelectedNode(null)}
              onUpdate={(nodeId, data) => handleNodeUpdate(nodeId, data, workflow, nodes, edges)}
              allNodes={nodes}
              allEdges={edges}
            />
          )}

          {/* Right stats panel — always visible in diagram tab (when no node selected) */}
          {!selectedNode && !showConnections && !showVersions && (
            <ScenarioStatsPanel
              key={statsKey}
              workflowId={id}
              isActive={workflow.is_active}
              collapsed={rightCollapsed}
              onToggle={() => setRightCollapsed(v => !v)}
            />
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="flex flex-1 overflow-hidden">
          <HistoryTab workflowId={id} />
        </div>
      )}

      {activeTab === "incomplete" && (
        <div className="flex flex-1 overflow-hidden">
          <IncompleteTab workflowId={id} />
        </div>
      )}
    </div>
  );
}
