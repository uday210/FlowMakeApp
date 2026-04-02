"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  BarChart2, Plus, Upload, Database, Trash2,
  X, Loader2, BarChart, LineChart, PieChart,
  AreaChart, ScatterChart, Sparkles, RefreshCw,
  Table2, Home, ChevronRight, Rows3, LayoutDashboard,
  CloudUpload, GitMerge, Pencil, GripVertical,
  Maximize2, Square, RectangleHorizontal,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  BarChart as ReBarChart, Bar,
  LineChart as ReLineChart, Line,
  AreaChart as ReAreaChart, Area,
  PieChart as RePieChart, Pie, Cell,
  ScatterChart as ReScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string;
  name: string;
  source_type: "upload" | "db" | "merge";
  columns: string[];
  row_count: number;
  created_at: string;
  parent_ids?: string[];
}

interface DatasetDetail extends Dataset {
  data: Record<string, unknown>[];
  total_rows: number;
}

type ChartType = "bar" | "line" | "area" | "pie" | "scatter";
type AggFunc = "sum" | "avg" | "count" | "min" | "max";
type WidgetSize = 1 | 2 | 3; // grid column span

interface Widget {
  id: string;
  title: string;
  chart_type: ChartType;
  dataset_id: string;
  x_col: string;
  y_col: string;
  agg: AggFunc;
  color?: string;
  size?: WidgetSize;
}

interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
  created_at: string;
}

type View =
  | { type: "home" }
  | { type: "dataset"; id: string }
  | { type: "dashboard"; id: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: "bar", label: "Bar", icon: <BarChart size={13} /> },
  { type: "line", label: "Line", icon: <LineChart size={13} /> },
  { type: "area", label: "Area", icon: <AreaChart size={13} /> },
  { type: "pie", label: "Pie", icon: <PieChart size={13} /> },
  { type: "scatter", label: "Scatter", icon: <ScatterChart size={13} /> },
];

function srcBadge(t: string) {
  if (t === "upload") return "bg-blue-50 text-blue-600 border-blue-200";
  if (t === "db") return "bg-emerald-50 text-emerald-600 border-emerald-200";
  if (t === "merge") return "bg-violet-50 text-violet-600 border-violet-200";
  return "bg-gray-50 text-gray-500 border-gray-200";
}
function srcLabel(t: string) {
  if (t === "upload") return "Upload";
  if (t === "db") return "Database";
  if (t === "merge") return "Merged";
  return t;
}
function fmtRows(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

function aggregateData(
  rows: Record<string, unknown>[],
  xCol: string,
  yCol: string,
  agg: AggFunc
): { x: unknown; y: number }[] {
  // Group rows by x value, preserve insertion order
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = String(row[xCol] ?? "");
    const val = parseFloat(String(row[yCol]));
    if (!groups.has(key)) groups.set(key, []);
    if (!isNaN(val)) groups.get(key)!.push(val);
  }

  return Array.from(groups.entries()).map(([x, vals]) => {
    let y = 0;
    if (agg === "sum")   y = vals.reduce((s, v) => s + v, 0);
    if (agg === "avg")   y = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    if (agg === "count") y = vals.length;
    if (agg === "min")   y = vals.length ? Math.min(...vals) : 0;
    if (agg === "max")   y = vals.length ? Math.max(...vals) : 0;
    return { x, y: Math.round(y * 100) / 100 };
  });
}

// ─── File parsing ─────────────────────────────────────────────────────────────

async function parseFile(file: File) {
  return new Promise<{ columns: string[]; rows: Record<string, unknown>[] }>((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (r) => resolve({ columns: r.meta.fields ?? [], rows: r.data as Record<string, unknown>[] }),
        error: reject,
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array" });
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        resolve({ columns: json.length ? Object.keys(json[0]) : [], rows: json });
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error("Unsupported file. Use CSV or XLS/XLSX."));
    }
  });
}

// ─── Mini chart (thumbnail for widget cards) ──────────────────────────────────

function MiniChart({ widget, data }: { widget: Widget; data: Record<string, unknown>[] }) {
  const chartData = aggregateData(data, widget.x_col, widget.y_col, widget.agg ?? "sum").slice(0, 20);
  const color = widget.color ?? COLORS[0];

  return (
    <ResponsiveContainer width="100%" height="100%">
      {widget.chart_type === "bar" ? (
        <ReBarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Bar dataKey="y" fill={color} radius={[3, 3, 0, 0]} />
          <XAxis dataKey="x" hide /><YAxis hide /><Tooltip contentStyle={{ fontSize: 11 }} />
        </ReBarChart>
      ) : widget.chart_type === "line" ? (
        <ReLineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line type="monotone" dataKey="y" stroke={color} dot={false} strokeWidth={2} />
          <XAxis dataKey="x" hide /><YAxis hide /><Tooltip contentStyle={{ fontSize: 11 }} />
        </ReLineChart>
      ) : widget.chart_type === "area" ? (
        <ReAreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Area type="monotone" dataKey="y" stroke={color} fill={color + "33"} strokeWidth={2} />
          <XAxis dataKey="x" hide /><YAxis hide /><Tooltip contentStyle={{ fontSize: 11 }} />
        </ReAreaChart>
      ) : widget.chart_type === "pie" ? (
        <RePieChart>
          <Pie data={chartData} dataKey="y" nameKey="x" cx="50%" cy="50%" outerRadius="70%">
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11 }} />
        </RePieChart>
      ) : (
        <ReScatterChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <XAxis dataKey="x" hide /><YAxis dataKey="y" hide />
          <Scatter data={chartData} fill={color} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
        </ReScatterChart>
      )}
    </ResponsiveContainer>
  );
}

// ─── Full chart (dashboard view) ──────────────────────────────────────────────

function FullChart({ widget, data }: { widget: Widget; data: Record<string, unknown>[] }) {
  const chartData = aggregateData(data, widget.x_col, widget.y_col, widget.agg ?? "sum");
  const color = widget.color ?? COLORS[0];

  return (
    <ResponsiveContainer width="100%" height="100%">
      {widget.chart_type === "bar" ? (
        <ReBarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="y" fill={color} radius={[4, 4, 0, 0]} />
        </ReBarChart>
      ) : widget.chart_type === "line" ? (
        <ReLineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Line type="monotone" dataKey="y" stroke={color} dot={false} strokeWidth={2} />
        </ReLineChart>
      ) : widget.chart_type === "area" ? (
        <ReAreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Area type="monotone" dataKey="y" stroke={color} fill={color + "22"} strokeWidth={2} />
        </ReAreaChart>
      ) : widget.chart_type === "pie" ? (
        <RePieChart>
          <Pie data={chartData} dataKey="y" nameKey="x" cx="50%" cy="50%" outerRadius="65%" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend />
        </RePieChart>
      ) : (
        <ReScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" name={widget.x_col} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis dataKey="y" name={widget.y_col} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chartData} fill={color} />
        </ReScatterChart>
      )}
    </ResponsiveContainer>
  );
}

// ─── Widget Modal (Add + Edit) ────────────────────────────────────────────────

function WidgetModal({ datasets, onClose, onSave, initial }: {
  datasets: Dataset[];
  onClose: () => void;
  onSave: (w: Omit<Widget, "id">) => void;
  initial?: Widget; // present = edit mode
}) {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [chartType, setChartType] = useState<ChartType>(initial?.chart_type ?? "bar");
  const [datasetId, setDatasetId] = useState(initial?.dataset_id ?? datasets[0]?.id ?? "");
  const [xCol, setXCol] = useState(initial?.x_col ?? "");
  const [yCol, setYCol] = useState(initial?.y_col ?? "");
  const [agg, setAgg] = useState<AggFunc>(initial?.agg ?? "sum");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const ds = datasets.find((d) => d.id === datasetId);

  const AGG_OPTIONS: { value: AggFunc; label: string; desc: string }[] = [
    { value: "sum",   label: "SUM",   desc: "Total" },
    { value: "avg",   label: "AVG",   desc: "Average" },
    { value: "count", label: "COUNT", desc: "# rows" },
    { value: "min",   label: "MIN",   desc: "Minimum" },
    { value: "max",   label: "MAX",   desc: "Maximum" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">{editing ? "Edit Chart Widget" : "Add Chart Widget"}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg text-white"><X size={16} /></button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Widget Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monthly Revenue" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Chart Type</label>
            <div className="grid grid-cols-5 gap-2">
              {CHART_TYPES.map(({ type, label, icon }) => (
                <button key={type} onClick={() => setChartType(type)} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${chartType === type ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200" : "border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Dataset</label>
            <select value={datasetId} onChange={(e) => { setDatasetId(e.target.value); setXCol(""); setYCol(""); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">X Axis <span className="normal-case text-gray-400 font-normal">(dimension)</span></label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Choose…</option>
                {ds?.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Y Axis <span className="normal-case text-gray-400 font-normal">(measure)</span></label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Choose…</option>
                {ds?.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {yCol && chartType !== "scatter" && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                Aggregation <span className="normal-case text-gray-400 font-normal">— how to combine rows with same X</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {AGG_OPTIONS.map(({ value, label, desc }) => (
                  <button key={value} onClick={() => setAgg(value)} className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-all ${agg === value ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600 hover:border-violet-300"}`}>
                    <span className="text-[11px] font-bold">{label}</span>
                    <span className={`text-[9px] ${agg === value ? "text-violet-200" : "text-gray-400"}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "opacity-70 hover:opacity-100"}`} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => onSave({ title, chart_type: chartType, dataset_id: datasetId, x_col: xCol, y_col: yCol, agg, color, size: initial?.size ?? 1 })}
              disabled={!title || !xCol || !yCol}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {editing ? <><Pencil size={14} /> Save Changes</> : <><Plus size={14} /> Add Widget</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Modal ──────────────────────────────────────────────────────────────

function MergeModal({ datasets, onClose, onMerged }: {
  datasets: Dataset[];
  onClose: () => void;
  onMerged: (d: Dataset) => void;
}) {
  const [leftId, setLeftId] = useState(datasets[0]?.id ?? "");
  const [rightId, setRightId] = useState(datasets[1]?.id ?? "");
  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [joinType, setJoinType] = useState<"inner" | "left" | "right" | "outer">("inner");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const left = datasets.find((d) => d.id === leftId);
  const right = datasets.find((d) => d.id === rightId);

  const handleMerge = async () => {
    if (!leftKey || !rightKey) { setError("Select join keys for both datasets."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/analytics/datasets/${leftId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ right_id: rightId, left_key: leftKey, right_key: rightKey, join_type: joinType, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMerged(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Merge failed");
      setLoading(false);
    }
  };

  const JOIN_TYPES = [
    { value: "inner", label: "Inner", desc: "Matching rows only" },
    { value: "left", label: "Left", desc: "All left + matching right" },
    { value: "right", label: "Right", desc: "All right + matching left" },
    { value: "outer", label: "Full", desc: "All rows from both" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <GitMerge size={18} />
            <h2 className="font-semibold">Merge Datasets</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg text-white"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dataset selectors */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Left Dataset</label>
              <select value={leftId} onChange={(e) => { setLeftId(e.target.value); setLeftKey(""); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="pt-5 text-gray-400"><GitMerge size={20} /></div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Right Dataset</label>
              <select value={rightId} onChange={(e) => { setRightId(e.target.value); setRightKey(""); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {datasets.filter((d) => d.id !== leftId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Join keys */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Left Join Key</label>
              <select value={leftKey} onChange={(e) => setLeftKey(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Select column…</option>
                {left?.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Right Join Key</label>
              <select value={rightKey} onChange={(e) => setRightKey(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Select column…</option>
                {right?.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Join type */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Join Type</label>
            <div className="grid grid-cols-4 gap-2">
              {JOIN_TYPES.map(({ value, label, desc }) => (
                <button key={value} onClick={() => setJoinType(value)} className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-center transition-all ${joinType === value ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:border-emerald-300"}`}>
                  <span className="text-xs font-semibold">{label}</span>
                  <span className={`text-[9px] leading-tight ${joinType === value ? "text-emerald-100" : "text-gray-400"}`}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Result Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-generated if empty" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleMerge} disabled={loading} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
              Merge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DB Import Modal ──────────────────────────────────────────────────────────

interface UserTable {
  id: string;
  name: string;
  columns: { name: string; type?: string }[];
}

function DbImportModal({ onClose, onImported }: { onClose: () => void; onImported: (d: Dataset) => void }) {
  const [source, setSource] = useState<"my_tables" | "postgres" | "mysql">("my_tables");

  // My Tables state
  const [userTables, setUserTables] = useState<UserTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState("");

  // External DB state
  const [connStr, setConnStr] = useState("");
  const [tableName, setTableName] = useState("");

  const [dsName, setDsName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch user's tables when "My Tables" is selected
  useEffect(() => {
    if (source !== "my_tables") return;
    setLoadingTables(true);
    fetch("/api/tables")
      .then((r) => r.json())
      .then((data: UserTable[]) => {
        setUserTables(Array.isArray(data) ? data : []);
        if (data.length > 0) setSelectedTableId(data[0].id);
        setLoadingTables(false);
      })
      .catch(() => setLoadingTables(false));
  }, [source]);

  // Auto-fill dataset name when a table is selected
  useEffect(() => {
    if (source === "my_tables" && selectedTableId) {
      const t = userTables.find((t) => t.id === selectedTableId);
      if (t) setDsName(t.name);
    }
  }, [selectedTableId, userTables, source]);

  const handleImport = async () => {
    setLoading(true); setError("");
    try {
      if (source === "my_tables") {
        const t = userTables.find((t) => t.id === selectedTableId);
        if (!t) throw new Error("Select a table.");

        // Fetch all rows from the user table (up to 5000)
        const res = await fetch(`/api/tables/${selectedTableId}/rows?limit=5000`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to fetch rows");

        const rawRows: { data: Record<string, unknown> }[] = json.rows ?? [];
        const columns = t.columns.map((c) => c.name);
        const rows = rawRows.map((r) => r.data ?? {});

        // Save as analytics dataset
        const saveRes = await fetch("/api/analytics/datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: dsName || t.name, source_type: "db", columns, rows }),
        });
        const saved = await saveRes.json();
        if (!saveRes.ok) throw new Error(saved.error);
        onImported(saved);
      } else {
        if (!tableName || !dsName) throw new Error("Dataset name and table name are required.");
        const res = await fetch("/api/analytics/datasets/query-db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: "database",
            table_name: tableName,
            connection_string: connStr || undefined,
            name: dsName,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onImported(data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white"><Database size={18} /><h2 className="font-semibold">Import from Database</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg text-white"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Source selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Source</label>
            <div className="grid grid-cols-3 gap-2">
              {(["my_tables", "postgres", "mysql"] as const).map((s) => (
                <button key={s} onClick={() => { setSource(s); setError(""); }} className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${source === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                  {s === "my_tables" ? "My Tables" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* My Tables — dropdown */}
          {source === "my_tables" && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Select Table</label>
              {loadingTables ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 size={13} className="animate-spin" /> Loading tables…</div>
              ) : userTables.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2.5 rounded-xl">No tables found. Create tables in the My Tables section first.</p>
              ) : (
                <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {userTables.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.columns.length} cols)</option>
                  ))}
                </select>
              )}
              {selectedTableId && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {userTables.find((t) => t.id === selectedTableId)?.columns.map((c) => (
                    <span key={c.name} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{c.name}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* External DB fields */}
          {source !== "my_tables" && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Table Name</label>
                <input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="my_table" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Connection String</label>
                <input value={connStr} onChange={(e) => setConnStr(e.target.value)} placeholder={source === "postgres" ? "postgresql://user:pass@host/db" : "mysql://user:pass@host/db"} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {/* Dataset name */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Dataset Name</label>
            <input value={dsName} onChange={(e) => setDsName(e.target.value)} placeholder="My dataset" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleImport} disabled={loading || (source === "my_tables" && userTables.length === 0)} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Summary Modal ─────────────────────────────────────────────────────────

function AiSummaryModal({ dataset, onClose }: { dataset: Dataset; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    fetch(`/api/analytics/datasets/${dataset.id}?page=0&pageSize=200`)
      .then((r) => r.json())
      .then(async (detail: DatasetDetail) => {
        const rows = detail.data.slice(0, 100);
        const prompt = `You are a data analyst. Dataset: "${dataset.name}" with columns [${detail.columns.join(", ")}].\n\nAnalyze this sample and provide: key statistics, notable patterns, anomalies, and 3 actionable insights.\n\nData:\n${JSON.stringify(rows).slice(0, 4000)}`;
        const res = await fetch("/api/ai/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
        });
        const data = await res.json();
        setSummary(data.text ?? data.content ?? data.message ?? "No summary available.");
        setLoading(false);
      })
      .catch(() => { setSummary("Unable to generate summary."); setLoading(false); });
  }, [dataset]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={18} />
            <div>
              <h2 className="font-semibold">AI Analysis</h2>
              <p className="text-xs text-violet-200">{dataset.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg text-white"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="relative">
                <Loader2 size={28} className="animate-spin text-violet-500" />
                <Sparkles size={12} className="absolute -top-1 -right-1 text-violet-400" />
              </div>
              <p className="text-sm text-gray-400">Analyzing {fmtRows(dataset.row_count)} rows…</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{summary}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dataset Explorer ─────────────────────────────────────────────────────────

function DatasetExplorer({ dataset, onClose }: { dataset: Dataset; onClose: () => void }) {
  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const pageSize = 100;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/datasets/${dataset.id}?page=${page}&pageSize=${pageSize}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setLoading(false); });
  }, [dataset.id, page]);

  return (
    <div className="flex flex-col h-full">
      {/* Explorer header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Home size={12} /> <ChevronRight size={10} className="text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
              <Table2 size={12} className="text-blue-600" />
            </div>
            <span className="font-medium text-sm text-gray-900">{dataset.name}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${srcBadge(dataset.source_type)}`}>{srcLabel(dataset.source_type)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSummary(true)} className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
            <Sparkles size={12} /> AI Summary
          </button>
        </div>
      </div>

      {/* Column pills */}
      {detail && (
        <div className="flex gap-1.5 flex-wrap px-6 py-2.5 border-b bg-gray-50 flex-shrink-0">
          {detail.columns.map((col) => (
            <span key={col} className="text-[11px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-mono">{col}</span>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-6 py-2 border-b bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <span><span className="font-semibold text-gray-800">{(detail?.total_rows ?? dataset.row_count).toLocaleString()}</span> rows</span>
        <span><span className="font-semibold text-gray-800">{dataset.columns.length}</span> columns</span>
        <span>Imported <span className="font-semibold text-gray-800">{new Date(dataset.created_at).toLocaleDateString()}</span></span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="w-10 px-3 py-2.5 text-left font-medium text-gray-400">#</th>
                {detail!.columns.map((col) => (
                  <th key={col} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail!.data.map((row, i) => (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-violet-50/40 transition-colors`}>
                  <td className="px-3 py-2 text-gray-400 font-mono">{page * pageSize + i + 1}</td>
                  {detail!.columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[220px] truncate">{String(row[col] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {detail && (
        <div className="flex items-center justify-between px-6 py-3 border-t bg-white text-xs text-gray-500 flex-shrink-0">
          <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, detail.total_rows).toLocaleString()} of <strong>{detail.total_rows.toLocaleString()}</strong></span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-medium">← Prev</button>
            <button disabled={(page + 1) * pageSize >= detail.total_rows} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-medium">Next →</button>
          </div>
        </div>
      )}

      {showSummary && <AiSummaryModal dataset={dataset} onClose={() => setShowSummary(false)} />}
    </div>
  );
}

// ─── Sortable Widget Card ─────────────────────────────────────────────────────

function SortableWidgetCard({ widget, datasets, data, onEdit, onDelete, onResize }: {
  widget: Widget;
  datasets: Dataset[];
  data: Record<string, unknown>[];
  onEdit: () => void;
  onDelete: () => void;
  onResize: (size: WidgetSize) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const size = widget.size ?? 1;
  const colSpan = size === 3 ? "xl:col-span-3 lg:col-span-2" : size === 2 ? "xl:col-span-2 lg:col-span-2" : "col-span-1";
  const chartH = size === 3 ? "h-72" : size === 2 ? "h-60" : "h-52";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`${colSpan} bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-violet-100 transition-all`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          {/* Drag handle */}
          <button
            {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 rounded flex-shrink-0 touch-none"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: widget.color ?? COLORS[0] }} />
          <span className="text-sm font-medium text-gray-800 truncate">{widget.title}</span>
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* Resize buttons */}
          <button onClick={() => onResize(1)} title="Small (1 col)" className={`p-1 rounded-lg transition-colors ${size === 1 ? "bg-violet-100 text-violet-600" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"}`}>
            <Square size={11} />
          </button>
          <button onClick={() => onResize(2)} title="Medium (2 col)" className={`p-1 rounded-lg transition-colors ${size === 2 ? "bg-violet-100 text-violet-600" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"}`}>
            <RectangleHorizontal size={11} />
          </button>
          <button onClick={() => onResize(3)} title="Wide (full)" className={`p-1 rounded-lg transition-colors ${size === 3 ? "bg-violet-100 text-violet-600" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"}`}>
            <Maximize2 size={11} />
          </button>
          <div className="w-px h-3 bg-gray-200 mx-0.5" />
          {/* Edit */}
          <button onClick={onEdit} title="Edit widget" className="p-1 text-gray-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
            <Pencil size={12} />
          </button>
          {/* Delete */}
          <button onClick={onDelete} title="Delete widget" className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className={`px-2 pb-2 ${chartH}`}>
        <FullChart widget={widget} data={data} />
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 truncate">{datasets.find((d) => d.id === widget.dataset_id)?.name ?? "—"}</span>
        <span className="text-[10px] text-gray-300">·</span>
        <span className="text-[10px] font-mono text-violet-500 font-semibold">{(widget.agg ?? "sum").toUpperCase()}({widget.y_col})</span>
        <span className="text-[10px] text-gray-300">by</span>
        <span className="text-[10px] text-gray-400">{widget.x_col}</span>
      </div>
    </div>
  );
}

// ─── Dashboard Builder ────────────────────────────────────────────────────────

function DashboardBuilder({ dashboard, datasets, onBack, onUpdate }: {
  dashboard: Dashboard;
  datasets: Dataset[];
  onBack: () => void;
  onUpdate: (d: Dashboard) => void;
}) {
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, Record<string, unknown>[]>>({});
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const ids = [...new Set(dashboard.widgets.map((w) => w.dataset_id))];
    Promise.all(ids.map((id) =>
      fetch(`/api/analytics/datasets/${id}?page=0&pageSize=1000`)
        .then((r) => r.json())
        .then((d: DatasetDetail) => ({ id, data: d.data }))
    )).then((results) => {
      const map: Record<string, Record<string, unknown>[]> = {};
      for (const r of results) map[r.id] = r.data;
      setWidgetData(map);
    });
  }, [dashboard.widgets]);

  const saveWidgets = async (widgets: Widget[]) => {
    setSaving(true);
    const res = await fetch(`/api/analytics/dashboards/${dashboard.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgets }),
    });
    const updated = await res.json();
    onUpdate(updated);
    setSaving(false);
  };

  const ensureDataLoaded = (datasetId: string) => {
    if (!widgetData[datasetId]) {
      fetch(`/api/analytics/datasets/${datasetId}?page=0&pageSize=1000`)
        .then((r) => r.json())
        .then((d: DatasetDetail) => setWidgetData((prev) => ({ ...prev, [datasetId]: d.data })));
    }
  };

  const handleAdd = (w: Omit<Widget, "id">) => {
    saveWidgets([...dashboard.widgets, { ...w, id: crypto.randomUUID(), size: w.size ?? 1 }]);
    ensureDataLoaded(w.dataset_id);
    setShowWidgetModal(false);
  };

  const handleEdit = (w: Omit<Widget, "id">) => {
    if (!editingWidget) return;
    saveWidgets(dashboard.widgets.map((x) => x.id === editingWidget.id ? { ...w, id: editingWidget.id } : x));
    ensureDataLoaded(w.dataset_id);
    setEditingWidget(null);
  };

  const handleResize = (widgetId: string, size: WidgetSize) => {
    saveWidgets(dashboard.widgets.map((w) => w.id === widgetId ? { ...w, size } : w));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = dashboard.widgets.findIndex((w) => w.id === active.id);
      const newIdx = dashboard.widgets.findIndex((w) => w.id === over.id);
      saveWidgets(arrayMove(dashboard.widgets, oldIdx, newIdx));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Home size={12} /> <ChevronRight size={10} className="text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-violet-100 rounded-md flex items-center justify-center">
              <LayoutDashboard size={12} className="text-violet-600" />
            </div>
            <span className="font-medium text-sm text-gray-900">{dashboard.name}</span>
            {saving && <Loader2 size={13} className="animate-spin text-violet-500 ml-1" />}
          </div>
        </div>
        <button onClick={() => setShowWidgetModal(true)} disabled={datasets.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm shadow-violet-200">
          <Plus size={14} /> Add Chart
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {dashboard.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <BarChart2 size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium mb-1">Dashboard is empty</p>
            <p className="text-sm text-gray-400 mb-6">Add charts to visualize your data</p>
            <button onClick={() => setShowWidgetModal(true)} disabled={datasets.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 shadow-sm shadow-violet-200 disabled:opacity-40">
              <Plus size={14} /> Add First Chart
            </button>
            {datasets.length === 0 && <p className="text-xs text-amber-600 mt-3">Upload a dataset first</p>}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={dashboard.widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {dashboard.widgets.map((w) => (
                  <SortableWidgetCard
                    key={w.id}
                    widget={w}
                    datasets={datasets}
                    data={widgetData[w.dataset_id] ?? []}
                    onEdit={() => setEditingWidget(w)}
                    onDelete={() => saveWidgets(dashboard.widgets.filter((x) => x.id !== w.id))}
                    onResize={(size) => handleResize(w.id, size)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {showWidgetModal && (
        <WidgetModal datasets={datasets} onClose={() => setShowWidgetModal(false)} onSave={handleAdd} />
      )}
      {editingWidget && (
        <WidgetModal datasets={datasets} onClose={() => setEditingWidget(null)} onSave={handleEdit} initial={editingWidget} />
      )}
    </div>
  );
}

// ─── Home Overview ────────────────────────────────────────────────────────────

function HomeOverview({
  datasets, dashboards, onDatasetClick, onDashboardClick, onUpload, onDbImport, onMerge, uploading, fileInputRef,
}: {
  datasets: Dataset[];
  dashboards: Dashboard[];
  onDatasetClick: (id: string) => void;
  onDashboardClick: (id: string) => void;
  onUpload: (files: FileList | null) => void;
  onDbImport: () => void;
  onMerge: () => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const totalRows = datasets.reduce((s, d) => s + d.row_count, 0);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Datasets", value: datasets.length, icon: <Rows3 size={18} />, color: "from-blue-500 to-blue-600" },
          { label: "Total Rows", value: fmtRows(totalRows), icon: <Table2 size={18} />, color: "from-emerald-500 to-emerald-600" },
          { label: "Dashboards", value: dashboards.length, icon: <LayoutDashboard size={18} />, color: "from-violet-500 to-indigo-600" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} text-white flex items-center justify-center shadow-sm`}>{icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${dragOver ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-violet-300 hover:bg-gray-50/50"}`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragOver ? "bg-violet-100" : "bg-gray-100"}`}>
          {uploading ? <Loader2 size={24} className="animate-spin text-violet-600" /> : <CloudUpload size={24} className={dragOver ? "text-violet-600" : "text-gray-400"} />}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">{uploading ? "Uploading…" : "Drop CSV or Excel files here"}</p>
          <p className="text-xs text-gray-400 mt-0.5">or click to browse · .csv, .xlsx, .xls</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onDbImport} className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all group">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Database size={18} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800">Import from Database</p>
            <p className="text-xs text-gray-400">Supabase, Postgres, MySQL</p>
          </div>
        </button>
        <button onClick={onMerge} disabled={datasets.length < 2} className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group disabled:opacity-40">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <GitMerge size={18} className="text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800">Merge Datasets</p>
            <p className="text-xs text-gray-400">Join two datasets on a key</p>
          </div>
        </button>
      </div>

      {/* Recent datasets */}
      {datasets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datasets</h3>
          <div className="space-y-2">
            {datasets.slice(0, 5).map((ds) => (
              <button key={ds.id} onClick={() => onDatasetClick(ds.id)} className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-violet-200 hover:bg-violet-50/30 transition-all text-left group">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                  <Table2 size={14} className="text-gray-500 group-hover:text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{ds.name}</p>
                  <p className="text-xs text-gray-400">{fmtRows(ds.row_count)} rows · {ds.columns.length} cols</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${srcBadge(ds.source_type)}`}>{srcLabel(ds.source_type)}</span>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-violet-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent dashboards */}
      {dashboards.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dashboards</h3>
          <div className="grid grid-cols-2 gap-3">
            {dashboards.slice(0, 4).map((dash) => (
              <button key={dash.id} onClick={() => onDashboardClick(dash.id)} className="bg-white border border-gray-100 rounded-xl p-4 text-left hover:border-violet-200 hover:bg-violet-50/20 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                    <LayoutDashboard size={13} className="text-violet-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-800 truncate">{dash.name}</span>
                </div>
                <p className="text-xs text-gray-400">{dash.widgets.length} chart{dash.widgets.length !== 1 ? "s" : ""}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [view, setView] = useState<View>({ type: "home" });
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingDashboards, setLoadingDashboards] = useState(true);
  const [showMerge, setShowMerge] = useState(false);
  const [showDbImport, setShowDbImport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [creatingDash, setCreatingDash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = useCallback(() => {
    setLoadingDatasets(true);
    fetch("/api/analytics/datasets").then((r) => r.json()).then((d) => { setDatasets(Array.isArray(d) ? d : []); setLoadingDatasets(false); });
  }, []);
  const fetchDashboards = useCallback(() => {
    setLoadingDashboards(true);
    fetch("/api/analytics/dashboards").then((r) => r.json()).then((d) => { setDashboards(Array.isArray(d) ? d : []); setLoadingDashboards(false); });
  }, []);

  useEffect(() => { fetchDatasets(); fetchDashboards(); }, [fetchDatasets, fetchDashboards]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const { columns, rows } = await parseFile(file);
        await fetch("/api/analytics/datasets", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, ""), source_type: "upload", columns, rows }),
        });
      } catch (e) { console.error(e); }
    }
    setUploading(false);
    fetchDatasets();
  };

  const deleteDataset = async (id: string) => {
    await fetch(`/api/analytics/datasets/${id}`, { method: "DELETE" });
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    if (view.type === "dataset" && view.id === id) setView({ type: "home" });
  };

  const createDashboard = async () => {
    if (!newDashName.trim()) return;
    setCreatingDash(true);
    const res = await fetch("/api/analytics/dashboards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDashName.trim() }),
    });
    const data = await res.json();
    setDashboards((prev) => [data, ...prev]);
    setNewDashName("");
    setCreatingDash(false);
    setView({ type: "dashboard", id: data.id });
  };

  const deleteDashboard = async (id: string) => {
    await fetch(`/api/analytics/dashboards/${id}`, { method: "DELETE" });
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    if (view.type === "dashboard" && view.id === id) setView({ type: "home" });
  };

  const activeDataset = datasets.find((d) => d.id === (view.type === "dataset" ? view.id : ""));
  const activeDashboard = dashboards.find((d) => d.id === (view.type === "dashboard" ? view.id : ""));

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* ─── Left panel ─────────────────────────────────────────────── */}
        <aside className="w-60 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <BarChart2 size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900">Analytics</h1>
                <p className="text-[10px] text-gray-400">Data · Charts · Reports</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Home */}
            <button onClick={() => setView({ type: "home" })} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${view.type === "home" ? "bg-violet-50 text-violet-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              <Home size={14} /> Overview
            </button>

            {/* Datasets section */}
            <div>
              <div className="flex items-center justify-between px-3 mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Datasets</span>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                <button onClick={() => fileInputRef.current?.click()} title="Upload file" className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                  <Upload size={12} />
                </button>
              </div>
              {loadingDatasets ? (
                <div className="px-3 py-2 flex items-center gap-2 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /> Loading…</div>
              ) : datasets.length === 0 ? (
                <p className="px-3 py-1 text-xs text-gray-400 italic">No datasets yet</p>
              ) : (
                <div className="space-y-0.5">
                  {datasets.map((ds) => (
                    <div key={ds.id} className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${view.type === "dataset" && view.id === ds.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}
                      onClick={() => setView({ type: "dataset", id: ds.id })}>
                      <Table2 size={12} className="flex-shrink-0" />
                      <span className="text-xs truncate flex-1">{ds.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteDataset(ds.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 flex-shrink-0">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dashboards section */}
            <div>
              <div className="flex items-center justify-between px-3 mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dashboards</span>
              </div>
              {loadingDashboards ? (
                <div className="px-3 py-2 flex items-center gap-2 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /> Loading…</div>
              ) : dashboards.length === 0 ? (
                <p className="px-3 py-1 text-xs text-gray-400 italic">No dashboards yet</p>
              ) : (
                <div className="space-y-0.5">
                  {dashboards.map((dash) => (
                    <div key={dash.id} className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${view.type === "dashboard" && view.id === dash.id ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-50"}`}
                      onClick={() => setView({ type: "dashboard", id: dash.id })}>
                      <LayoutDashboard size={12} className="flex-shrink-0" />
                      <span className="text-xs truncate flex-1">{dash.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteDashboard(dash.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 flex-shrink-0">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New dashboard input */}
              <div className="flex items-center gap-1.5 px-3 mt-2">
                <input value={newDashName} onChange={(e) => setNewDashName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createDashboard()} placeholder="New dashboard…" className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                <button onClick={createDashboard} disabled={!newDashName.trim() || creatingDash} className="p-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40">
                  {creatingDash ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-gray-100 space-y-1">
            <button onClick={() => setShowDbImport(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
              <Database size={13} /> Import from DB
            </button>
            {datasets.length >= 2 && (
              <button onClick={() => setShowMerge(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
                <GitMerge size={13} /> Merge Datasets
              </button>
            )}
            <button onClick={() => { fetchDatasets(); fetchDashboards(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </aside>

        {/* ─── Main content ────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {view.type === "home" && (
            <HomeOverview
              datasets={datasets}
              dashboards={dashboards}
              onDatasetClick={(id) => setView({ type: "dataset", id })}
              onDashboardClick={(id) => setView({ type: "dashboard", id })}
              onUpload={handleUpload}
              onDbImport={() => setShowDbImport(true)}
              onMerge={() => setShowMerge(true)}
              uploading={uploading}
              fileInputRef={fileInputRef}
            />
          )}

          {view.type === "dataset" && activeDataset && (
            <DatasetExplorer dataset={activeDataset} onClose={() => setView({ type: "home" })} />
          )}

          {view.type === "dashboard" && activeDashboard && (
            <DashboardBuilder
              dashboard={activeDashboard}
              datasets={datasets}
              onBack={() => setView({ type: "home" })}
              onUpdate={(d) => setDashboards((prev) => prev.map((x) => x.id === d.id ? d : x))}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {showMerge && <MergeModal datasets={datasets} onClose={() => setShowMerge(false)} onMerged={(d) => { setDatasets((prev) => [d, ...prev]); setShowMerge(false); }} />}
      {showDbImport && <DbImportModal onClose={() => setShowDbImport(false)} onImported={(d) => { setDatasets((prev) => [d, ...prev]); setShowDbImport(false); }} />}
    </AppShell>
  );
}
