"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import type { UserTable, UserTableColumn } from "@/lib/types";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Table2, Loader2, ChevronRight, ChevronDown,
  Settings2, X, Check, RefreshCw, Copy, Database,
  AlertCircle, MoreHorizontal, Download, Rows3, PenLine,
} from "lucide-react";

const COLUMN_TYPES = ["text", "textarea", "number", "boolean", "select", "date", "datetime", "email", "url", "phone", "json"] as const;

// ─── Column type badge ────────────────────────────────────────────────────────

const TYPE_PILL: Record<string, string> = {
  text:     "bg-blue-50 text-blue-600 border-blue-100",
  textarea: "bg-blue-50 text-blue-500 border-blue-100",
  number:   "bg-orange-50 text-orange-600 border-orange-100",
  boolean:  "bg-green-50 text-green-600 border-green-100",
  select:   "bg-violet-50 text-violet-600 border-violet-100",
  date:     "bg-pink-50 text-pink-600 border-pink-100",
  datetime: "bg-pink-50 text-pink-600 border-pink-100",
  email:    "bg-cyan-50 text-cyan-600 border-cyan-100",
  url:      "bg-indigo-50 text-indigo-600 border-indigo-100",
  phone:    "bg-yellow-50 text-yellow-700 border-yellow-100",
  json:     "bg-gray-100 text-gray-500 border-gray-200",
};

const TYPE_SHORT: Record<string, string> = {
  text: "TXT", textarea: "AREA", number: "NUM", boolean: "BOOL",
  select: "SEL", date: "DATE", datetime: "DT", email: "EMAIL",
  url: "URL", phone: "TEL", json: "JSON",
};

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    text: "bg-blue-50 text-blue-600",
    number: "bg-orange-50 text-orange-600",
    boolean: "bg-green-50 text-green-600",
    date: "bg-purple-50 text-purple-600",
    json: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colors[type] ?? "bg-gray-100 text-gray-500"}`}>
      {type}
    </span>
  );
}

// ─── Column editor row ────────────────────────────────────────────────────────

function ColumnRow({
  col,
  onUpdate,
  onDelete,
}: {
  col: UserTableColumn;
  onUpdate: (c: UserTableColumn) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 group">
      <Database size={12} className="text-gray-400 flex-shrink-0" />
      <input
        value={col.name}
        onChange={e => onUpdate({ ...col, name: e.target.value })}
        placeholder="column_name"
        className="flex-1 text-xs font-mono bg-transparent border-none outline-none text-gray-700 placeholder-gray-300"
      />
      <select
        value={col.type}
        onChange={e => onUpdate({ ...col, type: e.target.value as UserTableColumn["type"] })}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 outline-none focus:border-violet-400"
      >
        {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={col.required}
          onChange={e => onUpdate({ ...col, required: e.target.checked })}
          className="accent-violet-600 w-3 h-3"
        />
        req
      </label>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ─── Table schema editor modal ────────────────────────────────────────────────

function TableModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<UserTable>;
  onSave: (data: { name: string; description: string; columns: UserTableColumn[] }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [columns, setColumns] = useState<UserTableColumn[]>(initial?.columns ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addColumn = () => {
    setColumns(c => [...c, { name: "", type: "text", required: false }]);
  };

  const updateColumn = (i: number, col: UserTableColumn) => {
    setColumns(c => c.map((x, j) => j === i ? col : x));
  };

  const deleteColumn = (i: number) => {
    setColumns(c => c.filter((_, j) => j !== i));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Table name is required"); return; }
    if (columns.some(c => !c.name.trim())) { setError("All columns must have a name"); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), columns });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {initial?.id ? "Edit Table Schema" : "Create New Table"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Table name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. form_submissions, leads, products"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What data is stored here?"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">Columns</label>
              <span className="text-xs text-gray-400">{columns.length} column{columns.length !== 1 ? "s" : ""}</span>
            </div>

            {columns.length === 0 ? (
              <div className="bg-gray-50 rounded-xl px-4 py-5 text-center border-2 border-dashed border-gray-200">
                <p className="text-xs text-gray-400">No columns yet. Add your first column below.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                {columns.map((col, i) => (
                  <ColumnRow
                    key={i}
                    col={col}
                    onUpdate={c => updateColumn(i, c)}
                    onDelete={() => deleteColumn(i)}
                  />
                ))}
              </div>
            )}

            <button
              onClick={addColumn}
              className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors mt-2"
            >
              <Plus size={13} /> Add column
            </button>
          </div>

          {/* Built-in columns note */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600 flex items-start gap-2">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span>Every row automatically gets an <strong>id</strong> (UUID) and <strong>created_at</strong> timestamp — no need to add them.</span>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {initial?.id ? "Save changes" : "Create table"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Row Modal ────────────────────────────────────────────────────────────

function AddRowModal({
  table,
  onSave,
  onClose,
}: {
  table: UserTable;
  onSave: (data: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(table.columns.map(c => [c.name, ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const missing = table.columns.filter(c => c.required && !values[c.name]?.trim());
    if (missing.length > 0) {
      setError(`Required: ${missing.map(c => c.name).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await onSave(values);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Add Row — {table.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {table.columns.map(col => (
            <div key={col.name}>
              <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">
                <span className="font-mono">{col.name}</span>
                <TypeBadge type={col.type} />
                {col.required && <span className="text-red-400 text-xs">required</span>}
              </label>
              {col.type === "boolean" ? (
                <select
                  value={values[col.name]}
                  onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">— select —</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : col.type === "json" ? (
                <textarea
                  value={values[col.name]}
                  onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
                  rows={3}
                  placeholder='{"key": "value"}'
                  className="w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
                />
              ) : (
                <input
                  type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                  value={values[col.name]}
                  onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
                  placeholder={col.type === "number" ? "0" : `Enter ${col.name}`}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              )}
            </div>
          ))}
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add row
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row viewer ───────────────────────────────────────────────────────────────

function TableRows({ table, onClose }: { table: UserTable; onClose: () => void }) {
  const [rows, setRows] = useState<{ id: string; data: Record<string, unknown>; created_at: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [addingRow, setAddingRow] = useState(false);
  const PAGE_SIZE = 25;

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/tables/${table.id}/rows?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [table.id, page]);

  useEffect(() => { load(); }, [load]);

  const deleteRow = async (rowId: string) => {
    await fetch(`/api/tables/${table.id}/rows?rowId=${rowId}`, { method: "DELETE" });
    load();
  };

  const addRow = async (data: Record<string, string>) => {
    // Cast values to their proper types
    const typed: Record<string, unknown> = {};
    for (const col of table.columns) {
      const raw = data[col.name];
      if (raw === "" || raw === undefined) continue;
      if (col.type === "number") typed[col.name] = Number(raw);
      else if (col.type === "boolean") typed[col.name] = raw === "true";
      else if (col.type === "json") typed[col.name] = JSON.parse(raw);
      else typed[col.name] = raw;
    }
    const res = await fetch(`/api/tables/${table.id}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: typed }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to insert row");
    }
    load();
  };

  const exportCSV = () => {
    if (rows.length === 0) return;
    const cols = table.columns.map(c => c.name);
    const header = ["id", ...cols, "created_at"].join(",");
    const csvRows = rows.map(r =>
      [r.id, ...cols.map(c => JSON.stringify(r.data[c] ?? "")), r.created_at].join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${table.name}.csv`; a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{table.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{total} row{total !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddingRow(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
            >
              <Plus size={12} /> Add row
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Download size={12} /> Export CSV
            </button>
            <button onClick={load} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
              <RefreshCw size={13} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <Rows3 size={28} className="text-gray-200" />
              <p className="text-sm">No rows yet</p>
              <p className="text-xs">Add rows manually or let your workflow insert data</p>
              <button
                onClick={() => setAddingRow(true)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition-colors"
              >
                <PenLine size={12} /> Add first row
              </button>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">id</th>
                  {table.columns.map(col => (
                    <th key={col.name} className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {col.name}
                      <span className="ml-1.5 normal-case font-normal text-gray-300">{col.type}</span>
                    </th>
                  ))}
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">created_at</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/50 group">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-300 whitespace-nowrap">
                      {row.id.slice(0, 8)}…
                    </td>
                    {table.columns.map(col => {
                      const val = row.data[col.name];
                      return (
                        <td key={col.name} className="px-4 py-2.5 text-gray-700 max-w-[200px]">
                          <span className="truncate block">
                            {val === null || val === undefined ? (
                              <span className="text-gray-300 italic">—</span>
                            ) : typeof val === "object" ? (
                              <span className="font-mono text-xs text-gray-500">{JSON.stringify(val)}</span>
                            ) : (
                              String(val)
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                ← Prev
              </button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {addingRow && (
        <AddRowModal
          table={table}
          onSave={addRow}
          onClose={() => setAddingRow(false)}
        />
      )}
    </div>
  );
}

// ─── Table card ───────────────────────────────────────────────────────────────

const CARD_ACCENTS = [
  { bar: "bg-violet-500", icon: "bg-violet-50 border-violet-100 text-violet-600" },
  { bar: "bg-blue-500",   icon: "bg-blue-50 border-blue-100 text-blue-600" },
  { bar: "bg-emerald-500",icon: "bg-emerald-50 border-emerald-100 text-emerald-600" },
  { bar: "bg-orange-500", icon: "bg-orange-50 border-orange-100 text-orange-600" },
  { bar: "bg-pink-500",   icon: "bg-pink-50 border-pink-100 text-pink-600" },
  { bar: "bg-teal-500",   icon: "bg-teal-50 border-teal-100 text-teal-600" },
  { bar: "bg-indigo-500", icon: "bg-indigo-50 border-indigo-100 text-indigo-600" },
  { bar: "bg-rose-500",   icon: "bg-rose-50 border-rose-100 text-rose-600" },
];

function TableCard({
  table,
  index,
  onEdit,
  onDelete,
  onViewRows,
}: {
  table: UserTable;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onViewRows: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  const copyId = () => {
    navigator.clipboard.writeText(table.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setMenuOpen(false);
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all group flex flex-col"
    >
      {/* Accent strip */}
      <div className={`h-1 w-full ${accent.bar}`} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${accent.icon}`}>
            <Table2 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate leading-tight">{table.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 leading-relaxed">
              {table.description || <span className="italic">No description</span>}
            </p>
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 transition-all"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 w-44 z-20">
                  <button onClick={() => { onEdit(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">
                    <Settings2 size={12} /> Edit schema
                  </button>
                  <button onClick={copyId}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy table ID"}
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50">
                    <Trash2 size={12} /> Delete table
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Column pills */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {table.columns.slice(0, 6).map(col => (
            <span
              key={col.name}
              className={`inline-flex items-center gap-1 text-xs border rounded-lg px-2 py-1 ${TYPE_PILL[col.type] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}
            >
              <span className="font-medium truncate max-w-[72px]">{col.name}</span>
              <span className="font-bold text-[9px] opacity-60 uppercase tracking-wide">
                {TYPE_SHORT[col.type] ?? col.type}
              </span>
            </span>
          ))}
          {table.columns.length > 6 && (
            <span className="inline-flex items-center text-xs px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-400">
              +{table.columns.length - 6} more
            </span>
          )}
          {table.columns.length === 0 && (
            <span className="text-xs text-gray-300 italic py-1">No columns defined</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-gray-100">
          <span className="text-xs text-gray-400 font-medium">
            {table.columns.length} column{table.columns.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onViewRows}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors group/btn"
          >
            Open table
            <ChevronRight size={12} className="transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<UserTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; table?: UserTable } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/tables")
      .then(r => r.json())
      .then(d => setTables(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (tableData: { name: string; description: string; columns: UserTableColumn[] }) => {
    if (modal?.mode === "edit" && modal.table) {
      const res = await fetch(`/api/tables/${modal.table.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tableData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update table");
      // Refresh from DB to ensure we always show accurate saved state
      load();
    } else {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tableData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create table");
      setTables(prev => [json, ...prev]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this table and ALL its data? This cannot be undone.")) return;
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
    setTables(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppShell>
      <PageHeader
        title="My Tables"
        subtitle="Create custom database tables and use them in your workflows"
        action={
          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus size={14} /> New table
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[1,2,3].map(j => <div key={j} className="h-6 w-20 bg-gray-100 rounded-lg" />)}
                  </div>
                  <div className="h-px bg-gray-100 mt-4" />
                  <div className="flex justify-between">
                    <div className="h-2.5 w-16 bg-gray-100 rounded" />
                    <div className="h-2.5 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-5 border border-violet-100 shadow-sm">
              <Table2 size={28} className="text-violet-500" />
            </div>
            <h2 className="text-base font-bold text-gray-800 mb-2">No tables yet</h2>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              Create a table with custom columns, then use the <strong className="text-gray-600">My Tables</strong> node in your workflows to read and write data.
            </p>
            <button
              onClick={() => setModal({ mode: "create" })}
              className="mt-6 flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Plus size={14} /> Create your first table
            </button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs text-gray-400 font-medium">
                {tables.length} table{tables.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table, i) => (
                <TableCard
                  key={table.id}
                  table={table}
                  index={i}
                  onEdit={() => setModal({ mode: "edit", table })}
                  onDelete={() => handleDelete(table.id)}
                  onViewRows={() => router.push(`/tables/${table.id}`)}
                />
              ))}
              {/* New table card */}
              <button
                onClick={() => setModal({ mode: "create" })}
                className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2.5 hover:border-violet-300 hover:bg-violet-50/40 transition-all text-gray-400 hover:text-violet-500 min-h-[180px] group"
              >
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-violet-300 flex items-center justify-center transition-colors">
                  <Plus size={18} />
                </div>
                <span className="text-xs font-semibold">New table</span>
              </button>
            </div>
          </>
        )}
      </main>

      {modal && (
        <TableModal
          initial={modal.table}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

    </AppShell>
  );
}
