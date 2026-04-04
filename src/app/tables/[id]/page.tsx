"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import type { UserTable, UserTableColumn } from "@/lib/types";
import {
  ArrowLeft, Plus, Trash2, Search, FileInput, FileOutput,
  ChevronUp, ChevronDown, X, Loader2, Settings2,
  Maximize2, Check, AlertCircle, Filter, SortAsc,
  Type, Hash, Calendar, ToggleLeft, Braces, Link2,
  ChevronsUpDown, RefreshCw, AlignLeft, Mail, Phone,
  Clock, ListOrdered, ChevronRight, Terminal, Play,
  ChevronUp as PanelClose, Minus,
} from "lucide-react";

// ─── Types ───���────────────────────────────────────────────────────────────────

type Row = { id: string; data: Record<string, unknown>; created_at: string };

type SortConfig = { col: string; dir: "asc" | "desc" } | null;
type FilterConfig = { col: string; op: "contains" | "equals" | "not_empty" | "empty"; value: string } | null;

// ─── Column type icon ─────────────────────────────────────────────────────────

function ColTypeIcon({ type }: { type: string }) {
  const cls = "text-gray-400 flex-shrink-0";
  const props = { size: 12, className: cls };
  switch (type) {
    case "number":   return <Hash {...props} />;
    case "boolean":  return <ToggleLeft {...props} />;
    case "date":     return <Calendar {...props} />;
    case "datetime": return <Clock {...props} />;
    case "json":     return <Braces {...props} />;
    case "url":      return <Link2 {...props} />;
    case "email":    return <Mail {...props} />;
    case "phone":    return <Phone {...props} />;
    case "textarea": return <AlignLeft {...props} />;
    case "select":   return <ListOrdered {...props} />;
    default:         return <Type {...props} />;
  }
}

const COL_WIDTHS: Record<string, number> = {
  text: 200, textarea: 240, number: 120, boolean: 100,
  date: 140, datetime: 180, json: 220, url: 200,
  email: 200, phone: 150, select: 160,
};

// ─── Cell display value ──���────────────────────────────────────────────────────

function CellDisplay({ value, type }: { value: unknown; type: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-300">—</span>;
  }
  if (type === "boolean") {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${value ? "bg-green-50 text-green-600" : "bg-red-50 text-red-400"}`}>
        {value ? <Check size={10} /> : <X size={10} />}
        {String(value)}
      </span>
    );
  }
  if (type === "json") {
    return <span className="font-mono text-xs text-gray-500 truncate">{JSON.stringify(value)}</span>;
  }
  if (type === "url") {
    return (
      <a href={String(value)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
        className="text-violet-600 hover:underline truncate flex items-center gap-1">
        <Link2 size={10} className="flex-shrink-0" />{String(value)}
      </a>
    );
  }
  if (type === "email") {
    return (
      <a href={`mailto:${value}`} onClick={e => e.stopPropagation()}
        className="text-violet-600 hover:underline truncate flex items-center gap-1">
        <Mail size={10} className="flex-shrink-0" />{String(value)}
      </a>
    );
  }
  if (type === "select") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100 truncate">
        {String(value)}
      </span>
    );
  }
  if (type === "textarea") {
    return <span className="truncate text-gray-600 italic text-xs">{String(value).slice(0, 60)}{String(value).length > 60 ? "…" : ""}</span>;
  }
  return <span className="truncate">{String(value)}</span>;
}

// ─── Cell editor ─────────────────────────────────────────────────────────────

function CellEditor({
  value, type, col, onCommit, onCancel,
}: {
  value: unknown; type: string; col?: UserTableColumn;
  onCommit: (v: unknown) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(
    type === "json" ? JSON.stringify(value ?? "") : String(value ?? "")
  );
  const ref = useRef<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    // select() exists on input/textarea but NOT on <select> — use optional call to avoid crash
    ref.current?.select?.();
  }, []);

  const commit = () => {
    let parsed: unknown = draft;
    if (type === "number")  parsed = draft === "" ? null : Number(draft);
    if (type === "boolean") parsed = draft === "true";
    if (type === "json") { try { parsed = JSON.parse(draft); } catch { parsed = draft; } }
    if ((type === "date" || type === "datetime") && draft === "") parsed = null;
    onCommit(parsed);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "json" && type !== "textarea") { e.preventDefault(); commit(); }
    if (e.key === "Escape") onCancel();
  };

  if (type === "boolean") {
    return (
      <select ref={ref as React.RefObject<HTMLSelectElement>} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
        className="w-full h-full px-2 text-xs outline-none bg-white">
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (type === "select" && col?.options?.length) {
    return (
      <select ref={ref as React.RefObject<HTMLSelectElement>} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
        className="w-full h-full px-2 text-xs outline-none bg-white">
        <option value="">— none —</option>
        {col.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (type === "json" || type === "textarea") {
    return (
      <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
        rows={type === "json" ? 3 : 2}
        className={`w-full px-2 py-1 text-xs outline-none bg-white resize-none ${type === "json" ? "font-mono" : ""}`}
      />
    );
  }
  const inputType =
    type === "number" ? "number" :
    type === "date" ? "date" :
    type === "datetime" ? "datetime-local" :
    type === "email" ? "email" :
    type === "url" ? "url" :
    type === "phone" ? "tel" : "text";

  return (
    <input ref={ref as React.RefObject<HTMLInputElement>}
      type={inputType} value={draft}
      onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
      className="w-full h-full px-2 text-xs outline-none bg-white"
    />
  );
}

// ─── Row expand panel ─────────────────────────────────────────────────────────

function ExpandPanel({
  row, columns, onClose, onSave,
}: {
  row: Row; columns: UserTableColumn[];
  onClose: () => void;
  onSave: (rowId: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map(c => [c.name, c.type === "json"
      ? JSON.stringify(row.data[c.name] ?? "")
      : String(row.data[c.name] ?? "")
    ]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const typed: Record<string, unknown> = {};
    for (const col of columns) {
      const raw = draft[col.name];
      if (raw === "" || raw === undefined) { typed[col.name] = null; continue; }
      if (col.type === "number")  typed[col.name] = Number(raw);
      else if (col.type === "boolean") typed[col.name] = raw === "true";
      else if (col.type === "json") { try { typed[col.name] = JSON.parse(raw); } catch { typed[col.name] = raw; } }
      else typed[col.name] = raw;
    }
    await onSave(row.id, typed);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[420px] bg-white shadow-2xl flex flex-col border-l border-gray-200 h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">{row.id.slice(0, 8)}…</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(row.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {columns.map(col => (
            <div key={col.name}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5">
                <ColTypeIcon type={col.type} />
                <span className="font-mono">{col.name}</span>
                {col.required && <span className="text-red-400">*</span>}
              </label>
              {col.type === "boolean" ? (
                <select value={draft[col.name]} onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400">
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : col.type === "select" ? (
                <select value={draft[col.name]} onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400">
                  <option value="">— none —</option>
                  {(col.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : col.type === "json" || col.type === "textarea" ? (
                <textarea value={draft[col.name]} onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                  rows={col.type === "json" ? 4 : 3}
                  className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 resize-none ${col.type === "json" ? "font-mono" : ""}`}
                />
              ) : (
                <input
                  type={col.type === "number" ? "number" : col.type === "date" ? "date" : col.type === "datetime" ? "datetime-local" : col.type === "email" ? "email" : col.type === "url" ? "url" : col.type === "phone" ? "tel" : "text"}
                  value={draft[col.name]}
                  onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schema editor modal (reused from tables page) ───────────────────────���───

function SchemaModal({
  table, onSave, onClose,
}: {
  table: UserTable;
  onSave: (cols: UserTableColumn[]) => Promise<void>;
  onClose: () => void;
}) {
  const [columns, setColumns] = useState<UserTableColumn[]>(table.columns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedCol, setExpandedCol] = useState<number | null>(null);

  const TYPES: { value: UserTableColumn["type"]; label: string; icon: React.ReactNode }[] = [
    { value: "text",     label: "Text",      icon: <Type size={12} /> },
    { value: "textarea", label: "Long text", icon: <AlignLeft size={12} /> },
    { value: "number",   label: "Number",    icon: <Hash size={12} /> },
    { value: "boolean",  label: "Checkbox",  icon: <ToggleLeft size={12} /> },
    { value: "select",   label: "Select",    icon: <ListOrdered size={12} /> },
    { value: "date",     label: "Date",      icon: <Calendar size={12} /> },
    { value: "datetime", label: "Date & time", icon: <Clock size={12} /> },
    { value: "email",    label: "Email",     icon: <Mail size={12} /> },
    { value: "url",      label: "URL",       icon: <Link2 size={12} /> },
    { value: "phone",    label: "Phone",     icon: <Phone size={12} /> },
    { value: "json",     label: "JSON",      icon: <Braces size={12} /> },
  ];

  const updateCol = (i: number, patch: Partial<UserTableColumn>) =>
    setColumns(c => c.map((x, j) => j === i ? { ...x, ...patch } : x));

  const handleSave = async () => {
    if (columns.some(c => !c.name.trim())) { setError("All columns must have a name"); return; }
    setSaving(true);
    try { await onSave(columns); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Edit schema — {table.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {columns.map((col, i) => (
            <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-2 px-3 py-2.5 group">
                <input
                  value={col.name}
                  onChange={e => updateCol(i, { name: e.target.value })}
                  placeholder="column_name"
                  className="flex-1 text-xs font-mono bg-transparent outline-none text-gray-700 min-w-0"
                />
                <select
                  value={col.type}
                  onChange={e => {
                    updateCol(i, { type: e.target.value as UserTableColumn["type"], options: e.target.value === "select" ? (col.options ?? []) : undefined });
                    setExpandedCol(e.target.value === "select" ? i : null);
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-violet-400 flex-shrink-0"
                >
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer flex-shrink-0">
                  <input type="checkbox" checked={col.required}
                    onChange={e => updateCol(i, { required: e.target.checked })}
                    className="accent-violet-600 w-3 h-3"
                  />req
                </label>
                {col.type === "select" && (
                  <button onClick={() => setExpandedCol(expandedCol === i ? null : i)}
                    className="p-1 text-gray-400 hover:text-violet-500 flex-shrink-0">
                    <ChevronRight size={12} className={`transition-transform ${expandedCol === i ? "rotate-90" : ""}`} />
                  </button>
                )}
                <button onClick={() => { setColumns(c => c.filter((_, j) => j !== i)); if (expandedCol === i) setExpandedCol(null); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                  <X size={11} />
                </button>
              </div>
              {/* Select options editor */}
              {col.type === "select" && expandedCol === i && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-white space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium mb-1.5">Options</p>
                  {(col.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input value={opt}
                        onChange={e => updateCol(i, { options: col.options!.map((o, j) => j === oi ? e.target.value : o) })}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
                        placeholder={`Option ${oi + 1}`}
                      />
                      <button onClick={() => updateCol(i, { options: col.options!.filter((_, j) => j !== oi) })}
                        className="p-1 text-gray-300 hover:text-red-400">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateCol(i, { options: [...(col.options ?? []), ""] })}
                    className="flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-800 mt-1">
                    <Plus size={11} /> Add option
                  </button>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setColumns(c => [...c, { name: "", type: "text", required: false }])}
            className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold hover:text-violet-800 mt-1">
            <Plus size={12} /> Add column
          </button>
          {error && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle size={11} />{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save schema
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Edit Modal ──────────────────────────────────────────────────────────

function BulkEditModal({
  columns, selectedCount, onSave, onClose,
}: {
  columns: UserTableColumn[];
  selectedCount: number;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (name: string) =>
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const handleSave = async () => {
    if (enabled.size === 0) { setError("Enable at least one field to edit"); return; }
    setSaving(true);
    const patch: Record<string, unknown> = {};
    for (const col of columns) {
      if (!enabled.has(col.name)) continue;
      const raw = draft[col.name] ?? "";
      if (col.type === "number")  patch[col.name] = raw === "" ? null : Number(raw);
      else if (col.type === "boolean") patch[col.name] = raw === "true";
      else if (col.type === "json") { try { patch[col.name] = JSON.parse(raw); } catch { patch[col.name] = raw; } }
      else patch[col.name] = raw;
    }
    try { await onSave(patch); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Bulk edit</h2>
            <p className="text-xs text-gray-400 mt-0.5">Apply changes to {selectedCount} selected row{selectedCount !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            Toggle a field on to include it in the update. Fields left off are not changed.
          </p>
          {columns.map(col => {
            const on = enabled.has(col.name);
            return (
              <div key={col.name} className={`rounded-xl border transition-all ${on ? "border-violet-300 bg-violet-50/50" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(col.name)}
                    className="accent-violet-600 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                  />
                  <ColTypeIcon type={col.type} />
                  <span className="text-xs font-semibold text-gray-700 font-mono flex-1">{col.name}</span>
                  <span className="text-[10px] text-gray-400">{col.type}</span>
                </div>
                {on && (
                  <div className="px-3 pb-3">
                    {col.type === "boolean" ? (
                      <select
                        value={draft[col.name] ?? ""}
                        onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white"
                      >
                        <option value="">— keep original —</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : col.type === "select" && col.options?.length ? (
                      <select
                        value={draft[col.name] ?? ""}
                        onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white"
                      >
                        <option value="">— none —</option>
                        {col.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : col.type === "textarea" || col.type === "json" ? (
                      <textarea
                        value={draft[col.name] ?? ""}
                        onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                        placeholder={col.type === "json" ? '{"key": "value"}' : "Enter value…"}
                        rows={3}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 resize-none font-mono"
                      />
                    ) : (
                      <input
                        type={col.type === "number" ? "number" : col.type === "date" ? "date" : col.type === "datetime" ? "datetime-local" : col.type === "email" ? "email" : col.type === "url" ? "url" : "text"}
                        value={draft[col.name] ?? ""}
                        onChange={e => setDraft(d => ({ ...d, [col.name]: e.target.value }))}
                        placeholder="Enter value…"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving || enabled.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Apply to {selectedCount} row{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter / Sort bar ────────────────────────────────────────────────────────

function FilterBar({
  columns, sort, filter, onSort, onFilter, onClear,
}: {
  columns: UserTableColumn[];
  sort: SortConfig; filter: FilterConfig;
  onSort: (s: SortConfig) => void;
  onFilter: (f: FilterConfig) => void;
  onClear: () => void;
}) {
  const [tab, setTab] = useState<"sort" | "filter">("sort");
  const OPS = ["contains", "equals", "not_empty", "empty"] as const;

  return (
    <div className="absolute top-10 left-0 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-80">
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {(["sort", "filter"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all capitalize ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "sort" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={sort?.col ?? ""}
              onChange={e => onSort(e.target.value ? { col: e.target.value, dir: sort?.dir ?? "asc" } : null)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
            >
              <option value="">— no sort —</option>
              {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select
              value={sort?.dir ?? "asc"}
              onChange={e => sort && onSort({ ...sort, dir: e.target.value as "asc" | "desc" })}
              disabled={!sort}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 disabled:opacity-40"
            >
              <option value="asc">↑ Asc</option>
              <option value="desc">↓ Desc</option>
            </select>
          </div>
        </div>
      )}

      {tab === "filter" && (
        <div className="space-y-2">
          <select
            value={filter?.col ?? ""}
            onChange={e => onFilter(e.target.value ? { col: e.target.value, op: filter?.op ?? "contains", value: filter?.value ?? "" } : null)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
          >
            <option value="">— no filter —</option>
            {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          {filter?.col && (
            <>
              <select
                value={filter.op}
                onChange={e => onFilter({ ...filter, op: e.target.value as "contains" | "equals" | "not_empty" | "empty" })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
              >
                {OPS.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
              </select>
              {filter.op !== "not_empty" && filter.op !== "empty" && (
                <input
                  value={filter.value}
                  onChange={e => onFilter({ ...filter, value: e.target.value })}
                  placeholder="value…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
                />
              )}
            </>
          )}
        </div>
      )}

      {(sort || filter) && (
        <button onClick={onClear} className="mt-3 w-full text-xs text-red-400 hover:text-red-600 font-medium text-center">
          Clear all
        </button>
      )}
    </div>
  );
}

// ─── Query Builder panel ──────────────────────────────────────────────────────

type Condition = {
  field: string;
  op: string;
  value: string;
  logic: "AND" | "OR";
};

type QueryResult = {
  rows: Record<string, unknown>[];
  total_matched: number;
  total_scanned: number;
  elapsed?: number;
};

const OPS = [
  { value: "=",            label: "equals" },
  { value: "!=",           label: "not equals" },
  { value: "contains",     label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "starts_with",  label: "starts with" },
  { value: "ends_with",    label: "ends with" },
  { value: ">",            label: ">" },
  { value: "<",            label: "<" },
  { value: ">=",           label: ">=" },
  { value: "<=",           label: "<=" },
  { value: "is_empty",     label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

function QueryBuilder({
  tableId, columns, onClose,
}: {
  tableId: string;
  columns: UserTableColumn[];
  onClose: () => void;
}) {
  const [conditions, setConditions] = useState<Condition[]>([
    { field: columns[0]?.name ?? "", op: "contains", value: "", logic: "AND" },
  ]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [orderBy, setOrderBy]   = useState("");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit]       = useState(100);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<QueryResult | null>(null);
  const [error, setError]       = useState("");

  const allColNames = ["id", ...columns.map(c => c.name), "created_at"];

  const addCondition = () =>
    setConditions(c => [...c, { field: columns[0]?.name ?? "", op: "contains", value: "", logic: "AND" }]);

  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions(c => c.map((x, j) => j === i ? { ...x, ...patch } : x));

  const runQuery = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/tables/${tableId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: selectedCols.length ? selectedCols : undefined,
          conditions: conditions.filter(c => c.field),
          orderBy: orderBy || undefined,
          orderDir,
          limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Query failed"); return; }
      setResult({ ...data, elapsed: Date.now() - t0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  };

  const resultCols = result?.rows[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div className="border-t-2 border-violet-200 bg-white flex flex-col" style={{ height: 360 }}>
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-violet-50 border-b border-violet-100 flex-shrink-0">
        <Terminal size={14} className="text-violet-500" />
        <span className="text-xs font-bold text-violet-700">Query Builder</span>
        <div className="flex-1" />
        <button
          onClick={runQuery}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Run
        </button>
        <button onClick={onClose} className="p-1 rounded hover:bg-violet-100 text-violet-400">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: query config ─────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-100 overflow-y-auto px-4 py-3 space-y-4">

          {/* SELECT */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">SELECT</p>
            <div className="flex flex-wrap gap-1.5">
              {allColNames.map(c => {
                const active = selectedCols.includes(c) || selectedCols.length === 0;
                return (
                  <button key={c}
                    onClick={() => setSelectedCols(prev =>
                      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                    )}
                    className={`text-xs px-2 py-0.5 rounded-md border font-mono transition-all ${active ? "bg-violet-50 border-violet-300 text-violet-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {selectedCols.length === 0 ? "All columns selected" : `${selectedCols.length} column${selectedCols.length > 1 ? "s" : ""} selected`}
            </p>
          </div>

          {/* WHERE */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">WHERE</p>
            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <div key={i} className="space-y-1">
                  {i > 0 && (
                    <select value={cond.logic} onChange={e => updateCondition(i, { logic: e.target.value as "AND" | "OR" })}
                      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-violet-600 font-bold outline-none bg-white w-14">
                      <option>AND</option>
                      <option>OR</option>
                    </select>
                  )}
                  <div className="flex items-center gap-1">
                    <select value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white flex-1 min-w-0 font-mono">
                      {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <button onClick={() => setConditions(c => c.filter((_, j) => j !== i))}
                      className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0">
                      <X size={11} />
                    </button>
                  </div>
                  <select value={cond.op} onChange={e => updateCondition(i, { op: e.target.value })}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white">
                    {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {cond.op !== "is_empty" && cond.op !== "is_not_empty" && (
                    <input value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })}
                      placeholder="value…"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
                    />
                  )}
                </div>
              ))}
            </div>
            <button onClick={addCondition}
              className="flex items-center gap-1 text-xs text-violet-600 font-medium mt-2 hover:text-violet-800">
              <Plus size={11} /> Add condition
            </button>
          </div>

          {/* ORDER BY + LIMIT */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ORDER BY / LIMIT</p>
            <div className="flex gap-2 mb-2">
              <select value={orderBy} onChange={e => setOrderBy(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white font-mono min-w-0">
                <option value="">— none —</option>
                {allColNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={orderDir} onChange={e => setOrderDir(e.target.value as "asc" | "desc")}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white">
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">LIMIT</span>
              <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={5000}
                className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400"
              />
              <span className="text-xs text-gray-400">rows (max 5000)</span>
            </div>
          </div>
        </div>

        {/* ── Right: results ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="m-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {!result && !running && !error && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Terminal size={28} className="text-gray-200" />
              <p className="text-sm">Configure and run a query</p>
              <p className="text-xs">Results will appear here</p>
            </div>
          )}
          {result && (
            <>
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex-shrink-0">
                <span className="font-semibold text-gray-700">{result.total_matched} row{result.total_matched !== 1 ? "s" : ""}</span>
                <span>matched</span>
                <span className="text-gray-300">·</span>
                <span>{result.total_scanned} scanned</span>
                <span className="text-gray-300">·</span>
                <span>{result.elapsed}ms</span>
              </div>
              {result.rows.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-xs text-gray-400">No rows match your query</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr>
                      {resultCols.map(c => (
                        <th key={c} className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wider text-[10px] border-r border-gray-100 font-mono whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        {resultCols.map(c => (
                          <td key={c} className="px-3 py-2 border-r border-gray-50 max-w-[200px]">
                            <span className="truncate block text-gray-700">
                              {row[c] === null || row[c] === undefined ? (
                                <span className="text-gray-300 italic">null</span>
                              ) : typeof row[c] === "object" ? (
                                <span className="font-mono text-gray-500">{JSON.stringify(row[c])}</span>
                              ) : String(row[c])}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main grid page ───────────────────────────────────────────────────────────

export default function TableGridPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [table, setTable]     = useState<UserTable | null>(null);
  const [rows, setRows]       = useState<Row[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const PAGE_SIZE = 100;

  // editing state
  const [editCell, setEditCell]   = useState<{ rowId: string; col: string } | null>(null);
  const [expandRow, setExpandRow] = useState<Row | null>(null);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [newRowDraft, setNewRowDraft] = useState<Record<string, string> | null>(null);

  // toolbar state
  const [search, setSearch]       = useState("");
  const [sort, setSort]           = useState<SortConfig>(null);
  const [filter, setFilter]       = useState<FilterConfig>(null);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [showSchema, setShowSchema]       = useState(false);
  const [showQuery, setShowQuery]         = useState(false);
  const [showBulkEdit, setShowBulkEdit]   = useState(false);

  // column widths (resizable)
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  // ── Load table + rows ────────────────────────────────────────────────────────

  const loadRows = useCallback(async (p = 0) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${id}/rows?limit=${PAGE_SIZE}&offset=${p * PAGE_SIZE}`);
      const d = await res.json();
      setRows(d.rows ?? []);
      setTotal(d.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tables/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setTable(d);
          // initialise widths only for columns not already sized
          setColWidths(prev => {
            const next: Record<string, number> = { ...prev };
            for (const col of (d.columns ?? [])) {
              if (!(col.name in next)) next[col.name] = COL_WIDTHS[col.type] ?? 200;
            }
            return next;
          });
        } else {
          router.push("/tables");
        }
      });
    loadRows(0);
  }, [id, loadRows, router]);

  const onResizeStart = useCallback((e: React.MouseEvent, colName: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      col: colName,
      startX: e.clientX,
      startWidth: colWidths[colName] ?? 200,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const w = Math.max(60, resizingRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: w }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // ── Computed rows (search + filter + sort) ───────────────────────────────────

  const displayed = (() => {
    let result = [...rows];

    // search across all columns
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        Object.values(row.data).some(v => String(v ?? "").toLowerCase().includes(q))
      );
    }

    // filter
    if (filter?.col) {
      result = result.filter(row => {
        const v = String(row.data[filter.col] ?? "").toLowerCase();
        if (filter.op === "empty")     return v === "" || v === "null";
        if (filter.op === "not_empty") return v !== "" && v !== "null";
        if (filter.op === "equals")    return v === filter.value.toLowerCase();
        return v.includes(filter.value.toLowerCase()); // contains
      });
    }

    // sort
    if (sort?.col) {
      result.sort((a, b) => {
        const av = a.data[sort.col] ?? "";
        const bv = b.data[sort.col] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  })();

  // ── CRUD operations ──────────────────────────────────────────────────────────

  const commitCellEdit = async (rowId: string, colName: string, value: unknown) => {
    setEditCell(null);
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const newData = { ...row.data, [colName]: value };
    // optimistic update
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: newData } : r));
    await fetch(`/api/tables/${id}/rows?rowId=${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: newData }),
    });
  };

  const saveExpandRow = async (rowId: string, data: Record<string, unknown>) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, data } : r));
    await fetch(`/api/tables/${id}/rows?rowId=${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  };

  const deleteRows = async (ids: string[]) => {
    setRows(prev => prev.filter(r => !ids.includes(r.id)));
    setTotal(t => t - ids.length);
    setSelected(new Set());
    await Promise.all(ids.map(rid =>
      fetch(`/api/tables/${id}/rows?rowId=${rid}`, { method: "DELETE" })
    ));
  };

  const bulkEdit = async (patch: Record<string, unknown>) => {
    const rowIds = Array.from(selected);
    const res = await fetch(`/api/tables/${id}/rows`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIds, patch }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Bulk update failed");
    }
    // optimistic: merge patch into all selected rows in local state
    setRows(prev => prev.map(r =>
      selected.has(r.id) ? { ...r, data: { ...r.data, ...patch } } : r
    ));
    setSelected(new Set());
  };

  const commitNewRow = async () => {
    if (!newRowDraft || !table) return;
    const typed: Record<string, unknown> = {};
    for (const col of table.columns) {
      const raw = newRowDraft[col.name] ?? "";
      if (raw === "") continue;
      if (col.type === "number")  typed[col.name] = Number(raw);
      else if (col.type === "boolean") typed[col.name] = raw === "true";
      else if (col.type === "json") { try { typed[col.name] = JSON.parse(raw); } catch { typed[col.name] = raw; } }
      else typed[col.name] = raw;
    }
    const res = await fetch(`/api/tables/${id}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: typed }),
    });
    if (res.ok) {
      const newRow = await res.json();
      setRows(prev => [newRow, ...prev]);
      setTotal(t => t + 1);
    }
    setNewRowDraft(null);
  };

  const saveSchema = async (cols: UserTableColumn[]) => {
    if (!table) return;
    const res = await fetch(`/api/tables/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: table.name, description: table.description, columns: cols }),
    });
    if (!res.ok) throw new Error("Failed to save schema");
    const updated = await res.json();
    setTable(updated);
  };

  const exportCSV = () => {
    if (!table || rows.length === 0) return;
    const cols = table.columns.map(c => c.name);
    const header = ["id", ...cols, "created_at"].join(",");
    const csvRows = rows.map(r =>
      [r.id, ...cols.map(c => JSON.stringify(r.data[c] ?? "")), r.created_at].join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${table.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !table) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const cols = table.columns.map(c => c.name);
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const data: Record<string, unknown> = {};
        headers.forEach((h, idx) => { if (cols.includes(h)) data[h] = vals[idx] ?? ""; });
        await fetch(`/api/tables/${id}/rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
      }
      loadRows(page);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleSelect = (rowId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === displayed.length ? new Set() : new Set(displayed.map(r => r.id)));
  };

  if (!table) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      </AppShell>
    );
  }

  const hasActiveFilters = !!(sort || filter || search);

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0 min-h-[52px]">

          {/* Left: back + title */}
          <Link href="/tables" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>
          <div className="flex items-center gap-2 min-w-0 mr-1">
            <span className="text-sm font-bold text-gray-900 truncate max-w-[140px]">{table.name}</span>
            {table.description && (
              <span className="text-xs text-gray-400 truncate hidden lg:block max-w-[200px]">— {table.description}</span>
            )}
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">
              {total.toLocaleString()} row{total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1" />

          {/* Center: search */}
          <div className="relative flex-shrink-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rows…"
              className="text-xs border border-gray-200 rounded-lg pl-7 pr-7 py-1.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-44 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Filter / Sort */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowFilterBar(o => !o)}
              title="Filter & Sort"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${hasActiveFilters ? "border-violet-400 bg-violet-50 text-violet-600" : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}
            >
              <Filter size={13} />
              <span>Filter</span>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
            </button>
            {showFilterBar && (
              <FilterBar
                columns={table.columns}
                sort={sort} filter={filter}
                onSort={setSort} onFilter={setFilter}
                onClear={() => { setSort(null); setFilter(null); setShowFilterBar(false); }}
              />
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadRows(page)}
            title="Refresh"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all flex-shrink-0"
          >
            <RefreshCw size={13} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Import / Export — icon only with tooltip */}
          <label title="Import CSV" className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 cursor-pointer transition-all flex-shrink-0">
            <FileInput size={14} />
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>

          <button onClick={exportCSV} title="Export CSV"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all flex-shrink-0">
            <FileOutput size={14} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Schema */}
          <button onClick={() => setShowSchema(true)}
            title="Edit schema"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-all flex-shrink-0">
            <Settings2 size={13} /> Schema
          </button>

          {/* Query */}
          <button
            onClick={() => setShowQuery(q => !q)}
            title="Query Builder"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all flex-shrink-0 ${showQuery ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700"}`}
          >
            <Terminal size={13} /> Query
          </button>

          {/* Add row — primary CTA */}
          <button
            onClick={() => setNewRowDraft(Object.fromEntries((table.columns ?? []).map(c => [c.name, ""])))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 active:scale-95 transition-all shadow-sm flex-shrink-0"
          >
            <Plus size={13} /> Add row
          </button>
        </div>

        {/* ── Bulk action bar ───────────────────────────────────────────────── */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 bg-violet-50 border-b border-violet-100 flex-shrink-0">
            <span className="text-xs font-semibold text-violet-700">{selected.size} row{selected.size !== 1 ? "s" : ""} selected</span>
            <button
              onClick={() => setShowBulkEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-white border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Settings2 size={12} /> Bulk edit
            </button>
            <button
              onClick={() => deleteRows(Array.from(selected))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} /> Delete selected
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-violet-400 hover:text-violet-600 ml-auto">
              Clear selection
            </button>
          </div>
        )}

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto" onClick={() => { if (showFilterBar) setShowFilterBar(false); }}>
          {loading ? (
            <div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : (
            <table className="w-full border-collapse text-xs" style={{ minWidth: `${80 + 48 + table.columns.reduce((a, c) => a + (colWidths[c.name] ?? COL_WIDTHS[c.type] ?? 200), 0) + 48}px` }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  {/* Checkbox */}
                  <th className="w-10 px-3 py-2.5 border-r border-gray-200">
                    <input
                      type="checkbox"
                      checked={displayed.length > 0 && selected.size === displayed.length}
                      onChange={toggleAll}
                      className="accent-violet-600 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  {/* Row # */}
                  <th className="w-12 px-3 py-2.5 text-gray-400 font-medium text-right border-r border-gray-200">#</th>
                  {/* Column headers */}
                  {table.columns.map(col => {
                    const w = colWidths[col.name] ?? COL_WIDTHS[col.type] ?? 200;
                    return (
                      <th
                        key={col.name}
                        style={{ width: w, minWidth: w }}
                        className="relative px-3 py-2.5 text-left border-r border-gray-200 cursor-pointer select-none group"
                        onClick={() => setSort(s =>
                          s?.col === col.name
                            ? s.dir === "asc" ? { col: col.name, dir: "desc" } : null
                            : { col: col.name, dir: "asc" }
                        )}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <ColTypeIcon type={col.type} />
                          <span className="font-semibold text-gray-600 text-xs truncate">{col.name}</span>
                          {sort?.col === col.name ? (
                            sort.dir === "asc" ? <ChevronUp size={11} className="text-violet-500 flex-shrink-0" /> : <ChevronDown size={11} className="text-violet-500 flex-shrink-0" />
                          ) : (
                            <ChevronsUpDown size={11} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                        {/* Resize handle */}
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-10 flex items-center justify-center opacity-0 group-hover:opacity-100"
                          onMouseDown={e => onResizeStart(e, col.name)}
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="w-0.5 h-4 bg-violet-400 rounded-full" />
                        </div>
                      </th>
                    );
                  })}
                  {/* Expand col */}
                  <th className="w-12 border-r border-gray-200" />
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-100">
                {/* New row draft */}
                {newRowDraft && (
                  <tr className="bg-violet-50/60">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-gray-300 text-right font-mono">new</td>
                    {table.columns.map(col => (
                      <td key={col.name} className="border-r border-gray-100 p-0 h-9">
                        <CellEditor
                          value={newRowDraft[col.name]}
                          type={col.type}
                          col={col}
                          onCommit={v => setNewRowDraft(d => ({ ...d!, [col.name]: String(v ?? "") }))}
                          onCancel={() => setNewRowDraft(null)}
                        />
                      </td>
                    ))}
                    <td className="px-2">
                      <div className="flex items-center gap-1">
                        <button onClick={commitNewRow} className="p-1 text-green-500 hover:text-green-700"><Check size={13} /></button>
                        <button onClick={() => setNewRowDraft(null)} className="p-1 text-gray-300 hover:text-red-400"><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={table.columns.length + 3} className="py-20 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <SortAsc size={28} className="text-gray-200" />
                        <p>{search || filter ? "No rows match your filter" : "No rows yet"}</p>
                        {!search && !filter && (
                          <button
                            onClick={() => setNewRowDraft(Object.fromEntries((table.columns ?? []).map(c => [c.name, ""])))}
                            className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-xs font-semibold rounded-xl hover:bg-violet-700"
                          >
                            <Plus size={12} /> Add first row
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayed.map((row, i) => {
                    const isSelected = selected.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`group hover:bg-gray-50/80 transition-colors ${isSelected ? "bg-violet-50/60" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-0 border-r border-gray-100 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.id)}
                            className="accent-violet-600 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        {/* Row # */}
                        <td className="px-3 py-2 text-gray-300 text-right font-mono border-r border-gray-100 w-12 select-none">
                          {page * PAGE_SIZE + i + 1}
                        </td>
                        {/* Data cells */}
                        {table.columns.map(col => {
                          const isEditing = editCell?.rowId === row.id && editCell?.col === col.name;
                          const w = colWidths[col.name] ?? COL_WIDTHS[col.type] ?? 200;
                          return (
                            <td
                              key={col.name}
                              style={{ width: w, maxWidth: w }}
                              className={`border-r border-gray-100 p-0 h-9 relative ${isEditing ? "ring-2 ring-violet-400 ring-inset z-10" : "cursor-cell"}`}
                              onClick={() => !isEditing && setEditCell({ rowId: row.id, col: col.name })}
                            >
                              {isEditing ? (
                                <CellEditor
                                  value={row.data[col.name]}
                                  type={col.type}
                                  col={col}
                                  onCommit={v => commitCellEdit(row.id, col.name, v)}
                                  onCancel={() => setEditCell(null)}
                                />
                              ) : (
                                <div className="px-3 py-2 h-full flex items-center overflow-hidden">
                                  <CellDisplay value={row.data[col.name]} type={col.type} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                        {/* Expand + delete */}
                        <td className="px-1 border-r border-gray-100 w-12">
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setExpandRow(row)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              title="Expand row"
                            >
                              <Maximize2 size={11} />
                            </button>
                            <button
                              onClick={() => deleteRows([row.id])}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"
                              title="Delete row"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Add row inline button */}
                {displayed.length > 0 && !newRowDraft && (
                  <tr className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setNewRowDraft(Object.fromEntries((table.columns ?? []).map(c => [c.name, ""])))}>
                    <td colSpan={table.columns.length + 3} className="px-5 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      <span className="flex items-center gap-1.5"><Plus size={12} /> Add row</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Query Builder panel ──────────────────────────────────────────── */}
        {showQuery && table.columns.length > 0 && (
          <QueryBuilder
            tableId={id}
            columns={table.columns}
            onClose={() => setShowQuery(false)}
          />
        )}

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200 bg-white flex-shrink-0 text-xs text-gray-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => { setPage(p => p - 1); loadRows(page - 1); }}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => { setPage(p => p + 1); loadRows(page + 1); }}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals / panels ───────────────────────────────────────────────── */}
      {expandRow && (
        <ExpandPanel
          row={expandRow}
          columns={table.columns}
          onClose={() => setExpandRow(null)}
          onSave={saveExpandRow}
        />
      )}
      {showSchema && (
        <SchemaModal
          table={table}
          onSave={saveSchema}
          onClose={() => setShowSchema(false)}
        />
      )}
      {showBulkEdit && table && (
        <BulkEditModal
          columns={table.columns}
          selectedCount={selected.size}
          onSave={bulkEdit}
          onClose={() => setShowBulkEdit(false)}
        />
      )}
    </AppShell>
  );
}
