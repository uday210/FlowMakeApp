"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Globe, Lock,
  Settings, Eye, BarChart2, Check, Loader2, X, AlertCircle,
  ChevronUp, ChevronDown, Copy, ExternalLink, ToggleLeft,
  ToggleRight, Hash, AlignLeft, Mail, Phone, Calendar, List,
  CheckSquare, Star, Upload, Link2, Type, GitFork,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type QuestionType =
  | "short_text" | "long_text" | "email" | "phone" | "number"
  | "date" | "dropdown" | "multiple_choice" | "checkbox"
  | "rating" | "file_upload" | "url" | "statement";

type Question = {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  options?: string[];         // for dropdown / multiple_choice / checkbox
  allow_other?: boolean;      // show "Other (please specify)" option
  option_logic?: Record<string, string>; // option value -> question id | "end" | ""
  max_rating?: number;        // for rating (default 5)
  max_files?: number;         // for file_upload
  accepted_types?: string;    // for file_upload
};

type FormSettings = {
  accent_color: string;
  bg_color: string;
  text_color: string;
  font: string;
  show_progress: boolean;
  progress_style: "bar" | "dots" | "steps";
  show_question_numbers: boolean;
  show_branding: boolean;
  button_label: string;
  submit_label: string;
  show_welcome: boolean;
  welcome_title: string;
  welcome_description: string;
  welcome_button_text: string;
  submit_message: string;
  redirect_url?: string;
};

type Form = {
  id: string;
  name: string;
  description: string;
  is_published: boolean;
  questions: Question[];
  settings: FormSettings;
  response_count: number;
  created_at: string;
  updated_at: string;
};

type FormResponse = {
  id: string;
  answers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  submitted_at: string;
  created_at: string;
};

// ── Question type catalog ──────────────────────────────────────────────────────

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; description: string }[] = [
  { type: "short_text",       label: "Short Text",       icon: Type,         description: "Single line answer" },
  { type: "long_text",        label: "Long Text",        icon: AlignLeft,    description: "Multi-line answer" },
  { type: "email",            label: "Email",            icon: Mail,         description: "Email address" },
  { type: "phone",            label: "Phone",            icon: Phone,        description: "Phone number" },
  { type: "number",           label: "Number",           icon: Hash,         description: "Numeric value" },
  { type: "date",             label: "Date",             icon: Calendar,     description: "Date picker" },
  { type: "dropdown",         label: "Dropdown",         icon: List,         description: "Single choice from list" },
  { type: "multiple_choice",  label: "Multiple Choice",  icon: CheckSquare,  description: "Pick one option" },
  { type: "checkbox",         label: "Checkboxes",       icon: CheckSquare,  description: "Pick multiple options" },
  { type: "rating",           label: "Rating",           icon: Star,         description: "Star rating" },
  { type: "file_upload",      label: "File Upload",      icon: Upload,       description: "Upload a file" },
  { type: "url",              label: "URL",              icon: Link2,        description: "Website link" },
  { type: "statement",        label: "Statement",        icon: AlignLeft,    description: "Display text (no answer)" },
];

const TYPE_COLORS: Record<QuestionType, string> = {
  short_text:      "bg-blue-50 border-blue-100 text-blue-600",
  long_text:       "bg-violet-50 border-violet-100 text-violet-600",
  email:           "bg-emerald-50 border-emerald-100 text-emerald-600",
  phone:           "bg-teal-50 border-teal-100 text-teal-600",
  number:          "bg-orange-50 border-orange-100 text-orange-600",
  date:            "bg-pink-50 border-pink-100 text-pink-600",
  dropdown:        "bg-indigo-50 border-indigo-100 text-indigo-600",
  multiple_choice: "bg-purple-50 border-purple-100 text-purple-600",
  checkbox:        "bg-rose-50 border-rose-100 text-rose-600",
  rating:          "bg-amber-50 border-amber-100 text-amber-600",
  file_upload:     "bg-cyan-50 border-cyan-100 text-cyan-600",
  url:             "bg-lime-50 border-lime-100 text-lime-600",
  statement:       "bg-gray-50 border-gray-200 text-gray-500",
};

function newQuestion(type: QuestionType): Question {
  const base: Question = {
    id: crypto.randomUUID(),
    type,
    title: "",
    required: false,
  };
  if (["dropdown", "multiple_choice", "checkbox"].includes(type)) {
    base.options = ["Option 1", "Option 2"];
  }
  if (type === "rating") base.max_rating = 5;
  return base;
}

// ── Responses tab ──────────────────────────────────────────────────────────────

function renderAnswerCell(answer: unknown): React.ReactNode {
  if (answer === null || answer === undefined || answer === "") return <span className="text-gray-300">—</span>;
  if (Array.isArray(answer)) return <span>{answer.join(", ")}</span>;
  if (typeof answer === "object") {
    const f = answer as { url?: string; name?: string };
    if (f.url) return (
      <a href={f.url} target="_blank" rel="noreferrer"
        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline">
        <ExternalLink size={11} />{f.name ?? "View file"}
      </a>
    );
  }
  return <span>{String(answer)}</span>;
}

function ResponsesTab({ formId, questions }: { formId: string; questions: Question[] }) {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/forms/${formId}/responses`)
      .then(r => r.json())
      .then(d => setResponses(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={20} className="animate-spin text-indigo-500" />
    </div>
  );

  if (responses.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
        <BarChart2 size={24} className="text-indigo-500" />
      </div>
      <h3 className="text-sm font-bold text-gray-800 mb-1">No responses yet</h3>
      <p className="text-xs text-gray-400">Share your form to start collecting responses.</p>
    </div>
  );

  // Only show questions that actually have at least one answer
  const answeredQuestions = questions.filter(q =>
    responses.some(r => r.answers[q.id] !== undefined && r.answers[q.id] !== "")
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400">{responses.length} response{responses.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 whitespace-nowrap w-8">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 whitespace-nowrap">Submitted</th>
                {answeredQuestions.map(q => (
                  <th key={q.id} className="text-left px-4 py-3 font-semibold text-gray-500 max-w-[180px]">
                    <span className="block truncate" title={q.title}>{q.title || "Untitled"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responses.map((r, i) => {
                const isExpanded = expandedRow === r.id;
                return (
                  <>
                    <tr key={r.id}
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-medium">{responses.length - i}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(r.submitted_at ?? r.created_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      {answeredQuestions.map(q => (
                        <td key={q.id} className="px-4 py-3 text-gray-700 max-w-[180px]">
                          <div className="truncate">{renderAnswerCell(r.answers[q.id])}</div>
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-expanded`} className="bg-indigo-50/40 border-b border-indigo-100">
                        <td colSpan={2 + answeredQuestions.length} className="px-4 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {answeredQuestions.map(q => (
                              <div key={q.id}>
                                <p className="text-[11px] font-semibold text-gray-400 mb-0.5 truncate">{q.title || "Untitled"}</p>
                                <div className="text-sm text-gray-800 break-words">{renderAnswerCell(r.answers[q.id])}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Question editor ────────────────────────────────────────────────────────────

function QuestionEditor({
  question, onChange, onDelete, onMoveUp, onMoveDown, onDuplicate, isFirst, isLast, allQuestions,
}: {
  question: Question;
  onChange: (q: Question) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  isFirst: boolean;
  isLast: boolean;
  allQuestions: Question[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [showLogic, setShowLogic] = useState(false);
  const qt = QUESTION_TYPES.find(t => t.type === question.type)!;
  const colorClass = TYPE_COLORS[question.type];
  const Icon = qt?.icon ?? Type;

  const hasOptions = ["dropdown", "multiple_choice", "checkbox"].includes(question.type);

  const updateOption = (i: number, val: string) => {
    const opts = [...(question.options ?? [])];
    // If this option had a logic rule under old name, migrate it
    const oldName = opts[i];
    const newLogic = { ...(question.option_logic ?? {}) };
    if (oldName in newLogic) { newLogic[val] = newLogic[oldName]; delete newLogic[oldName]; }
    opts[i] = val;
    onChange({ ...question, options: opts, option_logic: newLogic });
  };
  const addOption = () => onChange({ ...question, options: [...(question.options ?? []), `Option ${(question.options?.length ?? 0) + 1}`] });
  const removeOption = (i: number) => {
    const opt = question.options?.[i];
    const newLogic = { ...(question.option_logic ?? {}) };
    if (opt) delete newLogic[opt];
    onChange({ ...question, options: question.options?.filter((_, idx) => idx !== i), option_logic: newLogic });
  };
  const setJump = (optValue: string, jumpTo: string) => {
    const newLogic = { ...(question.option_logic ?? {}), [optValue]: jumpTo };
    if (!jumpTo) delete newLogic[optValue];
    onChange({ ...question, option_logic: newLogic });
  };

  // All options including "Other" when enabled
  const allOptions = [...(question.options ?? []), ...(question.allow_other ? ["__other__"] : [])];
  const hasLogic = allOptions.some(o => !!(question.option_logic?.[o]));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 transition-all group">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="cursor-grab text-gray-300 hover:text-gray-400 flex-shrink-0"><GripVertical size={14} /></div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border text-xs ${colorClass}`}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">
            {question.title || <span className="text-gray-400 italic">Untitled question</span>}
          </p>
          <p className="text-xs text-gray-400">{qt?.label}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronUp size={13} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronDown size={13} /></button>
          <button onClick={onDuplicate} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Copy size={13} /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
        </div>
        <div className="text-gray-300 flex-shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Question</label>
            <input value={question.title}
              onChange={e => onChange({ ...question, title: e.target.value })}
              placeholder={question.type === "statement" ? "Enter statement text…" : "Type your question here…"}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input value={question.description ?? ""}
              onChange={e => onChange({ ...question, description: e.target.value })}
              placeholder="Add a hint or extra context…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Options */}
          {hasOptions && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Options</label>
              <div className="space-y-1.5">
                {(question.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={opt} onChange={e => updateOption(i, e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                    />
                    <button onClick={() => removeOption(i)} className="p-1 rounded hover:bg-red-50 text-red-300"><X size={12} /></button>
                  </div>
                ))}
                {question.allow_other && (
                  <div className="flex items-center gap-2 opacity-60">
                    <div className="flex-1 text-sm border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-gray-400 italic">Other (please specify)</div>
                  </div>
                )}
                <button onClick={addOption} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium mt-1">
                  <Plus size={12} /> Add option
                </button>
              </div>
            </div>
          )}

          {/* Allow Other */}
          {hasOptions && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Allow "Other" with text input</span>
              <button onClick={() => onChange({ ...question, allow_other: !question.allow_other })}
                className={`transition-colors ${question.allow_other ? "text-indigo-600" : "text-gray-300"}`}>
                {question.allow_other ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
            </div>
          )}

          {/* Logic jumps */}
          {hasOptions && allOptions.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => setShowLogic(l => !l)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="flex items-center gap-1.5"><GitFork size={12} /> Conditional Logic {hasLogic && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">ON</span>}</span>
                {showLogic ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showLogic && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 space-y-2 bg-gray-50/60">
                  <p className="text-xs text-gray-400 mb-2">When a specific option is selected, jump to a different question.</p>
                  {allOptions.map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 flex-shrink-0 w-28 truncate" title={opt === "__other__" ? "Other" : opt}>
                        {opt === "__other__" ? <em>Other</em> : opt}
                      </span>
                      <span className="text-xs text-gray-400">→</span>
                      <select
                        value={question.option_logic?.[opt] ?? ""}
                        onChange={e => setJump(opt, e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 bg-white">
                        <option value="">Default (next question)</option>
                        {allQuestions.filter(q2 => q2.id !== question.id).map(q2 => (
                          <option key={q2.id} value={q2.id}>{q2.title || "Untitled"}</option>
                        ))}
                        <option value="end">End form</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rating max */}
          {question.type === "rating" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Max rating</label>
              <select value={question.max_rating ?? 5}
                onChange={e => onChange({ ...question, max_rating: Number(e.target.value) })}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400">
                {[3, 4, 5, 7, 10].map(n => <option key={n} value={n}>{n} stars</option>)}
              </select>
            </div>
          )}

          {/* Placeholder */}
          {["short_text", "long_text", "email", "phone", "number", "url"].includes(question.type) && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Placeholder <span className="font-normal text-gray-400">(optional)</span></label>
              <input value={question.placeholder ?? ""}
                onChange={e => onChange({ ...question, placeholder: e.target.value })}
                placeholder="e.g. Enter your answer…"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {/* Required toggle */}
          {question.type !== "statement" && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-gray-500">Required</span>
              <button onClick={() => onChange({ ...question, required: !question.required })}
                className={`transition-colors ${question.required ? "text-indigo-600" : "text-gray-300"}`}>
                {question.required ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0" />
        <span className="text-xs text-gray-500 font-mono">{value}</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)} className={`transition-colors flex-shrink-0 ${value ? "text-indigo-600" : "text-gray-300"}`}>
        {value ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pt-3 pb-1 border-t border-gray-100 first:border-0 first:pt-0">{children}</h3>;
}

function SettingsPanel({ settings, onChange }: { settings: FormSettings; onChange: (s: FormSettings) => void }) {
  const s = settings;
  const set = (patch: Partial<FormSettings>) => onChange({ ...s, ...patch });

  return (
    <div className="space-y-4">

      {/* ── Appearance ─────────────────────────────── */}
      <SectionHeading>Appearance</SectionHeading>

      <div className="grid grid-cols-3 gap-3">
        <ColorField label="Accent" value={s.accent_color} onChange={v => set({ accent_color: v })} />
        <ColorField label="Background" value={s.bg_color} onChange={v => set({ bg_color: v })} />
        <ColorField label="Text" value={s.text_color ?? "#111827"} onChange={v => set({ text_color: v })} />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Font</label>
        <select value={s.font} onChange={e => set({ font: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400">
          <option value="Inter, sans-serif">Inter</option>
          <option value="system-ui, sans-serif">System</option>
          <option value="'DM Sans', sans-serif">DM Sans</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
      </div>

      {/* ── Progress ───────────────────────────────── */}
      <SectionHeading>Progress</SectionHeading>

      <ToggleRow label="Show progress indicator" value={s.show_progress} onChange={v => set({ show_progress: v })} />

      {s.show_progress && (
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Style</label>
          <div className="grid grid-cols-3 gap-2">
            {(["bar", "dots", "steps"] as const).map(style => (
              <button key={style} onClick={() => set({ progress_style: style })}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all capitalize ${s.progress_style === style ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                {style}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {s.progress_style === "bar" ? "Smooth fill bar across the top" : s.progress_style === "dots" ? "One dot per question" : 'Shows "Q 2 of 5" text only'}
          </p>
        </div>
      )}

      {/* ── Questions ──────────────────────────────── */}
      <SectionHeading>Questions</SectionHeading>

      <ToggleRow label="Show question numbers" hint="Displays 1→ before each question" value={s.show_question_numbers ?? true} onChange={v => set({ show_question_numbers: v })} />

      {/* ── Welcome screen ─────────────────────────── */}
      <SectionHeading>Welcome Screen</SectionHeading>

      <ToggleRow label="Show welcome screen" hint="Intro page before the first question" value={s.show_welcome ?? false} onChange={v => set({ show_welcome: v })} />

      {s.show_welcome && (
        <div className="space-y-3 pl-2 border-l-2 border-indigo-100">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Headline</label>
            <input value={s.welcome_title ?? ""} onChange={e => set({ welcome_title: e.target.value })}
              placeholder="Welcome to our survey" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea value={s.welcome_description ?? ""} onChange={e => set({ welcome_description: e.target.value })}
              rows={2} placeholder="Takes about 2 minutes."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Start button text</label>
            <input value={s.welcome_button_text ?? "Get started"} onChange={e => set({ welcome_button_text: e.target.value })}
              placeholder="Get started" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400" />
          </div>
        </div>
      )}

      {/* ── Buttons ────────────────────────────────── */}
      <SectionHeading>Button Labels</SectionHeading>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Continue button</label>
          <input value={s.button_label ?? "Continue"} onChange={e => set({ button_label: e.target.value })}
            placeholder="Continue" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Submit button</label>
          <input value={s.submit_label ?? "Submit"} onChange={e => set({ submit_label: e.target.value })}
            placeholder="Submit" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400" />
        </div>
      </div>

      {/* ── Completion ─────────────────────────────── */}
      <SectionHeading>Completion</SectionHeading>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Thank-you message</label>
        <textarea value={s.submit_message ?? ""} onChange={e => set({ submit_message: e.target.value })}
          rows={3} placeholder="Thanks for your submission!"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Redirect URL <span className="font-normal text-gray-400">(optional)</span></label>
        <input value={s.redirect_url ?? ""} onChange={e => set({ redirect_url: e.target.value })}
          placeholder="https://yoursite.com/thank-you"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
      </div>

      {/* ── Branding ───────────────────────────────── */}
      <SectionHeading>Branding</SectionHeading>

      <ToggleRow
        label="Show 'Powered by FlowMake' badge"
        hint="Displays a small badge at the bottom of your form"
        value={s.show_branding}
        onChange={v => set({ show_branding: v })}
      />
    </div>
  );
}

// ── AddQuestionDrawer ──────────────────────────────────────────────────────────

function AddQuestionDrawer({ onAdd, onClose }: { onAdd: (type: QuestionType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Add question</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="overflow-auto p-4 grid grid-cols-2 gap-2">
          {QUESTION_TYPES.map(qt => {
            const Icon = qt.icon;
            const colorClass = TYPE_COLORS[qt.type];
            return (
              <button key={qt.type} onClick={() => { onAdd(qt.type); onClose(); }}
                className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-left group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${colorClass}`}>
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{qt.label}</p>
                  <p className="text-xs text-gray-400">{qt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main builder ───────────────────────────────────────────────────────────────

export default function FormBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"build" | "settings" | "responses">("build");
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/forms/${id}`);
    if (!res.ok) { setError("Form not found"); setLoading(false); return; }
    const data = await res.json();
    // Ensure defaults
    data.questions = data.questions ?? [];
    data.settings = {
      accent_color: "#6366f1",
      bg_color: "#ffffff",
      text_color: "#111827",
      font: "Inter, sans-serif",
      show_progress: true,
      progress_style: "bar",
      show_question_numbers: true,
      show_branding: true,
      button_label: "Continue",
      submit_label: "Submit",
      show_welcome: false,
      welcome_title: "",
      welcome_description: "",
      welcome_button_text: "Get started",
      submit_message: "Thanks for submitting!",
      ...data.settings,
    };
    setForm(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-save with debounce
  const save = useCallback(async (updated: Form) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/forms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updated.name,
          description: updated.description,
          questions: updated.questions,
          settings: updated.settings,
          is_published: updated.is_published,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [id]);

  const update = useCallback((updated: Form) => {
    setForm(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(updated), 800);
  }, [save]);

  const addQuestion = (type: QuestionType) => {
    if (!form) return;
    update({ ...form, questions: [...form.questions, newQuestion(type)] });
  };

  const updateQuestion = (i: number, q: Question) => {
    if (!form) return;
    const qs = [...form.questions];
    qs[i] = q;
    update({ ...form, questions: qs });
  };

  const deleteQuestion = (i: number) => {
    if (!form) return;
    update({ ...form, questions: form.questions.filter((_, idx) => idx !== i) });
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    if (!form) return;
    const qs = [...form.questions];
    const j = i + dir;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    update({ ...form, questions: qs });
  };

  const duplicateQuestion = (i: number) => {
    if (!form) return;
    const qs = [...form.questions];
    const copy = { ...qs[i], id: crypto.randomUUID() };
    qs.splice(i + 1, 0, copy);
    update({ ...form, questions: qs });
  };

  const togglePublish = () => {
    if (!form) return;
    update({ ...form, is_published: !form.is_published });
  };

  if (loading) return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    </AppShell>
  );

  if (error && !form) return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button onClick={() => router.push("/forms")} className="text-sm text-indigo-600 hover:underline">Back to forms</button>
      </div>
    </AppShell>
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AppShell>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <button onClick={() => router.push("/forms")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <ArrowLeft size={15} />
          </button>

          <div className="flex-1 min-w-0">
            <input
              value={form!.name}
              onChange={e => update({ ...form!, name: e.target.value })}
              className="text-sm font-bold text-gray-900 bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-400 transition-colors w-full max-w-xs"
            />
            <input
              value={form!.description}
              onChange={e => update({ ...form!, description: e.target.value })}
              placeholder="Add a description…"
              className="text-xs text-gray-400 bg-transparent outline-none w-full max-w-xs mt-0.5"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            {(["build", "settings", "responses"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {t === "build" ? "Build" : t === "settings" ? <><Settings size={11} className="inline mr-1" />Settings</> : <><BarChart2 size={11} className="inline mr-1" />{form!.response_count} Responses</>}
              </button>
            ))}
          </div>

          {/* Save status */}
          <div className="flex items-center gap-1 text-xs">
            {saving && <><Loader2 size={11} className="animate-spin text-indigo-400" /><span className="text-gray-400">Saving…</span></>}
            {saved && !saving && <><Check size={11} className="text-emerald-500" /><span className="text-emerald-500">Saved</span></>}
          </div>

          {/* Publish toggle */}
          <button onClick={togglePublish}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${form!.is_published ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"}`}>
            {form!.is_published ? <><Globe size={12} /> Published</> : <><Lock size={12} /> Draft</>}
          </button>

          {/* Preview */}
          <a href={`${origin}/form/${id}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
            <Eye size={12} /> Preview <ExternalLink size={10} />
          </a>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {tab === "build" && (
            <div className="max-w-2xl mx-auto px-4 py-8">
              {form!.questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
                    <Plus size={24} className="text-indigo-500" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mb-1.5">No questions yet</h3>
                  <p className="text-xs text-gray-400 mb-6">Add your first question to start building your form.</p>
                  <button onClick={() => setShowAddDrawer(true)}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                    <Plus size={14} /> Add question
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {form!.questions.map((q, i) => (
                      <QuestionEditor key={q.id} question={q}
                        allQuestions={form!.questions}
                        onChange={updated => updateQuestion(i, updated)}
                        onDelete={() => deleteQuestion(i)}
                        onMoveUp={() => moveQuestion(i, -1)}
                        onMoveDown={() => moveQuestion(i, 1)}
                        onDuplicate={() => duplicateQuestion(i)}
                        isFirst={i === 0}
                        isLast={i === form!.questions.length - 1}
                      />
                    ))}
                  </div>
                  <button onClick={() => setShowAddDrawer(true)}
                    className="w-full border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 py-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-gray-400 hover:text-indigo-500 text-xs font-semibold">
                    <Plus size={14} /> Add question
                  </button>
                </>
              )}
            </div>
          )}

          {tab === "settings" && (
            <div className="max-w-lg mx-auto px-4 py-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <SettingsPanel settings={form!.settings} onChange={s => update({ ...form!, settings: s })} />
              </div>
            </div>
          )}

          {tab === "responses" && (
            <div className="px-6 py-6">
              <ResponsesTab formId={id} questions={form!.questions} />
            </div>
          )}
        </div>
      </div>

      {showAddDrawer && <AddQuestionDrawer onAdd={addQuestion} onClose={() => setShowAddDrawer(false)} />}
    </AppShell>
  );
}
