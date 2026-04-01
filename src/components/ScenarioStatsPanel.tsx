"use client";

import { useEffect, useState, useCallback } from "react";
import type { Execution } from "@/lib/types";
import { RefreshCw, Calendar, Loader2, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Mini sparkline chart ─────────────────────────────────────────────────────

function UsageChart({ executions }: { executions: Execution[] }) {
  const days = 30;
  const now = Date.now();
  const DAY = 86400000;

  // Build day buckets
  const buckets = Array.from({ length: days }, (_, i) => {
    const day = new Date(now - (days - 1 - i) * DAY);
    const label = i === days - 1 ? "Today" :
      i === 0 ? day.toLocaleDateString("en-US", { month: "short", day: "numeric" }) :
      i % 7 === 0 ? day.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const dayStart = new Date(day).setHours(0, 0, 0, 0);
    const dayEnd = dayStart + DAY;
    const count = executions.filter(e => {
      const t = new Date(e.started_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    return { label, count };
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const W = 280, H = 100, padL = 28, padR = 8, padT = 10, padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / (days - 1);

  const points = buckets.map((b, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - (b.count / maxCount) * chartH,
    count: b.count,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${points[0].x},${padT + chartH} ${polyline} ${points[points.length - 1].x},${padT + chartH}`;

  // Y-axis grid lines
  const yTicks = maxCount === 1
    ? [{ val: 0, y: padT + chartH }, { val: 1, y: padT }]
    : [0, 0.5, 1].map(f => ({ val: Math.round(f * maxCount), y: padT + chartH - f * chartH }));

  // X axis labels
  const xLabels = buckets
    .map((b, i) => ({ label: b.label, x: padL + i * stepX }))
    .filter(l => l.label);

  const totalRuns = executions.length;
  const successRuns = executions.filter(e => e.status === "success").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-5">
          <div>
            <span className="text-2xl font-bold text-violet-600 leading-none">{totalRuns}</span>
            <span className="text-xs text-gray-400 ml-1.5">runs</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-red-400 leading-none">{totalRuns - successRuns}</span>
            <span className="text-xs text-gray-400 ml-1.5">errors</span>
          </div>
        </div>
        <span className="text-[9px] text-gray-300 uppercase tracking-wider">30 days</span>
      </div>

      <svg width={W} height={H} className="w-full overflow-visible" viewBox={`0 0 ${W} ${H}`}>
        {/* Horizontal grid lines + Y labels */}
        {yTicks.map(({ val, y }, i) => (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y}
              stroke="#f3f4f6" strokeWidth={1} />
            <text x={padL - 4} y={y + 3} fontSize={7} fill="#d1d5db" textAnchor="end">{val}</text>
          </g>
        ))}

        {/* Bottom axis line */}
        <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH}
          stroke="#e5e7eb" strokeWidth={1} />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <polygon points={area} fill="url(#chartGrad)" />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#7c3aed" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots on active days */}
        {points.filter(p => p.count > 0).map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="white" stroke="#7c3aed" strokeWidth={1.5} />
            <circle cx={p.x} cy={p.y} r={2} fill="#7c3aed" />
          </g>
        ))}

        {/* X axis labels */}
        {xLabels.map(({ label, x }, i) => (
          <text key={i} x={x} y={H - 2} fontSize={7.5} fill="#9ca3af" textAnchor="middle">{label}</text>
        ))}
      </svg>
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
  workflowId: string;
  isActive: boolean;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dur(e: Execution) {
  if (!e.finished_at) return "—";
  const ms = new Date(e.finished_at).getTime() - new Date(e.started_at).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function ScenarioStatsPanel({ workflowId, isActive, collapsed = false, onToggle }: Props) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/executions/${workflowId}`)
      .then(r => r.json())
      .then(d => setExecutions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => { load(); }, [load]);

  const running = executions.find(e => e.status === "running");
  const recent = executions.slice(0, 5);

  const last7 = executions.filter(e =>
    Date.now() - new Date(e.started_at).getTime() < 7 * 86400000
  );
  const creditsUsed = last7.filter(e => e.status === "success").length;

  // ── Collapsed state: slim strip ────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="w-8 border-l border-gray-200 bg-white flex flex-col items-center overflow-hidden flex-shrink-0">
        <button
          onClick={onToggle}
          title="Expand scenario usage"
          className="mt-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[9px] font-bold text-gray-300 uppercase tracking-widest select-none"
            style={{ writingMode: "vertical-rl" }}
          >
            Usage
          </span>
        </div>
      </aside>
    );
  }

  // ── Expanded state ─────────────────────────────────────────────────────────
  return (
    <aside className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex-1 overflow-y-auto">

        {/* ── Scenario Usage ── */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Scenario Usage</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 border border-gray-200 rounded-md px-2 py-0.5">
                <Calendar size={10} />
                Last 30 days
              </div>
              <button
                onClick={onToggle}
                title="Collapse panel"
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={16} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <UsageChart executions={executions} />
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Credits used</p>
              <p className="text-lg font-bold text-violet-600 leading-none">{creditsUsed}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Data transfer</p>
              <p className="text-lg font-bold text-gray-500 leading-none">0 <span className="text-xs font-normal">B</span></p>
            </div>
          </div>
        </div>

        {/* ── Scenario Properties ── */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Scenario Properties</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-green-400" : "bg-gray-300"}`} />
            {isActive ? (
              <span className="text-green-600 font-medium">Active — running on schedule</span>
            ) : (
              <span className="text-gray-500">Inactive — run manually or activate</span>
            )}
          </div>
        </div>

        {/* ── Currently Running ── */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Currently Running</p>
          {running ? (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 size={12} className="animate-spin" />
              <span>Execution in progress…</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No execution is currently running.</p>
          )}
        </div>

        {/* ── History ── */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">History</p>
            <button onClick={load} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
              <RefreshCw size={11} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={14} className="animate-spin text-gray-300" />
            </div>
          ) : recent.length === 0 ? (
            <p className="text-xs text-gray-400">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(e => (
                <div key={e.id} className="flex items-center gap-2.5 py-1.5">
                  <div className="flex-shrink-0">
                    {e.status === "running" ? (
                      <Loader2 size={13} className="animate-spin text-blue-400" />
                    ) : e.status === "success" ? (
                      <CheckCircle size={13} className="text-green-500" />
                    ) : (
                      <XCircle size={13} className="text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        e.status === "success" ? "bg-green-50 text-green-600" :
                        e.status === "failed" ? "bg-red-50 text-red-500" :
                        "bg-blue-50 text-blue-500"
                      }`}>{e.status}</span>
                      <span className="text-[10px] text-gray-400">{dur(e)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock size={8} /> {timeAgo(e.started_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {executions.length > 5 && (
            <p className="text-[10px] text-violet-500 mt-3 cursor-pointer hover:underline">
              View all {executions.length} runs in History tab →
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
