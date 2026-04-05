"use client";

import { use, useEffect, useState, useRef } from "react";
import {
  ChevronDown, Star, CheckSquare, Check, Loader2, AlertCircle,
  ArrowRight, RotateCcw, Zap,
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
  options?: string[];
  allow_other?: boolean;
  option_logic?: Record<string, string>; // option value -> question id | "end" | ""
  max_rating?: number;
  accepted_types?: string;
};

type FormSettings = {
  accent_color: string;
  bg_color: string;
  text_color?: string;
  font: string;
  show_progress: boolean;
  progress_style?: "bar" | "dots" | "steps";
  show_question_numbers?: boolean;
  show_branding: boolean;
  button_label?: string;
  submit_label?: string;
  show_welcome?: boolean;
  welcome_title?: string;
  welcome_description?: string;
  welcome_button_text?: string;
  submit_message: string;
  redirect_url?: string;
};

type FormData = {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  settings: FormSettings;
};

// ── Question input components ──────────────────────────────────────────────────

function ShortTextInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <input
      type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : q.type === "number" ? "number" : q.type === "url" ? "url" : "text"}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={q.placeholder ?? "Type your answer here…"}
      autoFocus
      className="w-full text-lg bg-transparent border-b-2 border-gray-300 pb-2 outline-none transition-colors placeholder:text-gray-300"
      style={{ borderColor: value ? accent : undefined }}
    />
  );
}

function LongTextInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={q.placeholder ?? "Type your answer here…"}
      rows={4}
      autoFocus
      className="w-full text-lg bg-transparent border-b-2 border-gray-300 pb-2 outline-none transition-colors resize-none placeholder:text-gray-300"
      style={{ borderColor: value ? accent : undefined }}
    />
  );
}

function DateInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      autoFocus
      className="text-lg bg-transparent border-b-2 border-gray-300 pb-2 outline-none transition-colors"
      style={{ borderColor: value ? accent : undefined }}
    />
  );
}

function DropdownInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  // value is either an option, "__other__", or the actual other text (when isOther)
  const isOther = value !== "" && !(q.options ?? []).includes(value) && value !== "__other__";
  const selectValue = isOther ? "__other__" : value;

  return (
    <div className="space-y-3">
      <div className="relative inline-block min-w-[240px]">
        <select
          value={selectValue}
          onChange={e => {
            if (e.target.value === "__other__") onChange("__other__");
            else onChange(e.target.value);
          }}
          autoFocus
          className="w-full text-lg bg-transparent border-b-2 border-gray-300 pb-2 outline-none appearance-none pr-8 cursor-pointer"
          style={{ borderColor: selectValue ? accent : undefined }}>
          <option value="">Choose an option…</option>
          {(q.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          {q.allow_other && <option value="__other__">Other (please specify)</option>}
        </select>
        <ChevronDown size={18} className="absolute right-1 top-2 text-gray-400 pointer-events-none" />
      </div>
      {(selectValue === "__other__" || isOther) && (
        <input
          type="text"
          autoFocus
          placeholder="Please specify…"
          value={isOther ? value : ""}
          onChange={e => onChange(e.target.value || "__other__")}
          className="w-full text-base bg-transparent border-b-2 pb-2 outline-none placeholder:text-gray-300"
          style={{ borderColor: accent }}
        />
      )}
    </div>
  );
}

function MultipleChoiceInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  const isOtherSelected = value !== "" && !(q.options ?? []).includes(value);
  const selectedDisplay = isOtherSelected ? "__other__" : value;

  const allOptions = [...(q.options ?? [])];
  const totalCount = allOptions.length + (q.allow_other ? 1 : 0);

  return (
    <div className="space-y-3 mt-2">
      {allOptions.map((opt, i) => {
        const selected = selectedDisplay === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)}
            className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
            style={{
              borderColor: selected ? accent : "#e5e7eb",
              backgroundColor: selected ? accent + "15" : "transparent",
              color: selected ? accent : "#374151",
            }}>
            <span className="w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ borderColor: selected ? accent : "#d1d5db", backgroundColor: selected ? accent : "transparent", color: selected ? "#fff" : "#9ca3af" }}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-sm font-medium">{opt}</span>
            {selected && <Check size={14} className="ml-auto" style={{ color: accent }} />}
          </button>
        );
      })}

      {q.allow_other && (
        <div>
          <button onClick={() => { if (!isOtherSelected) onChange("__other__"); }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
            style={{
              borderColor: isOtherSelected ? accent : "#e5e7eb",
              backgroundColor: isOtherSelected ? accent + "15" : "transparent",
            }}>
            <span className="w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ borderColor: isOtherSelected ? accent : "#d1d5db", backgroundColor: isOtherSelected ? accent : "transparent", color: isOtherSelected ? "#fff" : "#9ca3af" }}>
              {String.fromCharCode(65 + totalCount - 1)}
            </span>
            <span className="text-sm font-medium text-gray-500 italic">Other</span>
            {isOtherSelected && <Check size={14} className="ml-auto" style={{ color: accent }} />}
          </button>
          {isOtherSelected && (
            <input
              type="text"
              autoFocus
              placeholder="Please specify…"
              value={isOtherSelected && value !== "__other__" ? value : ""}
              onChange={e => onChange(e.target.value || "__other__")}
              className="mt-2 w-full text-base bg-transparent border-b-2 pb-2 outline-none placeholder:text-gray-300"
              style={{ borderColor: accent }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  const allSelected: string[] = value ? value.split("\n").filter(Boolean) : [];
  // Separate known options from "other" text (anything not in q.options)
  const knownOptions = q.options ?? [];
  const otherEntry = allSelected.find(s => !knownOptions.includes(s) && s !== "__other__");
  const otherChecked = allSelected.some(s => !knownOptions.includes(s));

  const toggle = (opt: string) => {
    const next = allSelected.includes(opt)
      ? allSelected.filter(s => s !== opt)
      : [...allSelected, opt];
    onChange(next.join("\n"));
  };

  const toggleOther = () => {
    if (otherChecked) {
      // remove other entry
      onChange(allSelected.filter(s => knownOptions.includes(s)).join("\n"));
    } else {
      onChange([...allSelected, "__other__"].join("\n"));
    }
  };

  const setOtherText = (text: string) => {
    const rest = allSelected.filter(s => knownOptions.includes(s));
    onChange([...rest, text || "__other__"].join("\n"));
  };

  return (
    <div className="space-y-3 mt-2">
      {knownOptions.map(opt => {
        const isSelected = allSelected.includes(opt);
        return (
          <button key={opt} onClick={() => toggle(opt)}
            className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
            style={{
              borderColor: isSelected ? accent : "#e5e7eb",
              backgroundColor: isSelected ? accent + "15" : "transparent",
            }}>
            <span className="w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all"
              style={{ borderColor: isSelected ? accent : "#d1d5db", backgroundColor: isSelected ? accent : "transparent" }}>
              {isSelected && <Check size={11} color="#fff" />}
            </span>
            <span className="text-sm font-medium text-gray-700">{opt}</span>
          </button>
        );
      })}

      {q.allow_other && (
        <div>
          <button onClick={toggleOther}
            className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
            style={{
              borderColor: otherChecked ? accent : "#e5e7eb",
              backgroundColor: otherChecked ? accent + "15" : "transparent",
            }}>
            <span className="w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all"
              style={{ borderColor: otherChecked ? accent : "#d1d5db", backgroundColor: otherChecked ? accent : "transparent" }}>
              {otherChecked && <Check size={11} color="#fff" />}
            </span>
            <span className="text-sm font-medium text-gray-500 italic">Other</span>
          </button>
          {otherChecked && (
            <input
              type="text"
              autoFocus
              placeholder="Please specify…"
              value={otherEntry ?? ""}
              onChange={e => setOtherText(e.target.value)}
              className="mt-2 w-full text-base bg-transparent border-b-2 pb-2 outline-none placeholder:text-gray-300"
              style={{ borderColor: accent }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RatingInput({ q, value, onChange, accent }: { q: Question; value: string; onChange: (v: string) => void; accent: string }) {
  const max = q.max_rating ?? 5;
  const current = Number(value) || 0;
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-2 mt-2">
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => onChange(String(n))}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110">
          <Star size={32}
            fill={(hover || current) >= n ? accent : "none"}
            color={(hover || current) >= n ? accent : "#d1d5db"}
          />
        </button>
      ))}
    </div>
  );
}

function FileUploadInput({ q, formId, value, onChange, accent, onUploadingChange }: {
  q: Question; formId: string; value: string; onChange: (v: string) => void; accent: string;
  onUploadingChange?: (v: boolean) => void;
}) {
  // value is either "" or a JSON string: { url, name, size }
  const parsed = (() => { try { return value ? JSON.parse(value) : null; } catch { return null; } })();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    // Use XHR for progress tracking
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/forms/${formId}/upload`);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      setUploading(false);
      onUploadingChange?.(false);
      if (xhr.status === 200 || xhr.status === 201) {
        const res = JSON.parse(xhr.responseText);
        onChange(JSON.stringify({ url: res.url, name: res.name, size: res.size }));
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error ?? "Upload failed");
        } catch {
          setError("Upload failed");
        }
      }
    };

    xhr.onerror = () => { setUploading(false); onUploadingChange?.(false); setError("Network error during upload"); };
    xhr.send(formData);
  };

  const remove = () => {
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatBytes = (n: number) =>
    n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="mt-2 space-y-2">
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange}
        accept={q.accepted_types || undefined} />

      {!parsed && !uploading && (
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-3 px-6 py-5 rounded-xl border-2 border-dashed transition-all text-sm font-medium w-full hover:opacity-80"
          style={{ borderColor: "#d1d5db", color: "#9ca3af" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Click to choose a file</span>
          <span className="ml-auto text-xs">Max 10 MB</span>
        </button>
      )}

      {uploading && (
        <div className="rounded-xl border-2 border-dashed px-6 py-5 space-y-2" style={{ borderColor: accent + "80" }}>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
            <Loader2 size={15} className="animate-spin flex-shrink-0" />
            Uploading… {progress}%
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-150" style={{ width: `${progress}%`, backgroundColor: accent }} />
          </div>
        </div>
      )}

      {parsed && !uploading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2"
          style={{ borderColor: accent + "60", backgroundColor: accent + "08" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: accent }}>{parsed.name}</p>
            <p className="text-xs text-gray-400">{formatBytes(parsed.size)} · <a href={parsed.url} target="_blank" rel="noreferrer" className="underline hover:text-gray-600">View</a></p>
          </div>
          <button onClick={remove} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
    </div>
  );
}

// ── Question slide ─────────────────────────────────────────────────────────────

function QuestionSlide({
  question, index, total, value, onChange, onNext, onBack, canGoBack,
  settings, isLast, formId,
}: {
  question: Question;
  index: number;
  total: number;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  canGoBack: boolean;
  settings: FormSettings;
  isLast: boolean;
  formId: string;
}) {
  const accent = settings.accent_color;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && question.type !== "long_text") {
      e.preventDefault();
      onNext();
    }
  };

  const [fileUploading, setFileUploading] = useState(false);
  const canProceed = !fileUploading && (!question.required || (question.type === "checkbox" ? value.trim() !== "" : value.trim() !== ""));

  const textColor = settings.text_color ?? "#111827";
  const pct = Math.round(((index + 1) / total) * 100);
  const showNums = settings.show_question_numbers ?? true;
  const btnLabel = isLast ? (settings.submit_label || "Submit") : (settings.button_label || "Continue");
  const progressStyle = settings.progress_style ?? "bar";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: settings.bg_color, fontFamily: settings.font, color: textColor }}>

      {/* ── Progress indicator ── */}
      {settings.show_progress && total > 1 && (
        <>
          {progressStyle === "bar" && (
            <div className="fixed top-0 left-0 right-0 z-20">
              <div className="flex items-center justify-between px-5 py-2.5 bg-white/90 backdrop-blur-sm border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500">Question {index + 1} of {total}</span>
                <span className="text-xs font-bold" style={{ color: accent }}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100">
                <div className="h-full transition-all duration-500 rounded-r-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
              </div>
            </div>
          )}
          {progressStyle === "dots" && (
            <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-center gap-1.5 py-3 bg-white/90 backdrop-blur-sm border-b border-gray-100">
              {Array.from({ length: total }, (_, i) => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{ width: i === index ? 20 : 8, height: 8, backgroundColor: i <= index ? accent : "#e5e7eb" }} />
              ))}
            </div>
          )}
          {progressStyle === "steps" && (
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm" style={{ color: accent }}>
              {index + 1} / {total}
            </div>
          )}
        </>
      )}

      {/* Question */}
      <div className="flex-1 flex items-center justify-center px-6 py-20" onKeyDown={handleKeyDown}>
        <div className="w-full max-w-xl">
          {showNums && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold" style={{ color: accent }}>{index + 1}</span>
              <ArrowRight size={12} style={{ color: accent }} />
            </div>
          )}

          <h2 className="text-2xl font-bold mb-2 leading-snug" style={{ color: textColor }}>
            {question.title || "Untitled question"}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </h2>

          {question.description && (
            <p className="text-sm mb-6" style={{ color: textColor, opacity: 0.6 }}>{question.description}</p>
          )}

          <div className="mt-6">
            {question.type === "statement" ? (
              <p style={{ color: textColor, opacity: 0.7 }} />
            ) : question.type === "long_text" ? (
              <LongTextInput q={question} value={value} onChange={onChange} accent={accent} />
            ) : question.type === "date" ? (
              <DateInput q={question} value={value} onChange={onChange} accent={accent} />
            ) : question.type === "dropdown" ? (
              <DropdownInput q={question} value={value} onChange={onChange} accent={accent} />
            ) : question.type === "multiple_choice" ? (
              <MultipleChoiceInput q={question} value={value} onChange={onChange} accent={accent} />
            ) : question.type === "checkbox" ? (
              <CheckboxInput q={question} value={value} onChange={onChange} accent={accent} />
            ) : question.type === "rating" ? (
              <RatingInput q={question} value={value} onChange={onChange} accent={accent} />
            ) : question.type === "file_upload" ? (
              <FileUploadInput q={question} formId={formId} value={value} onChange={onChange} accent={accent} onUploadingChange={setFileUploading} />
            ) : (
              <ShortTextInput q={question} value={value} onChange={onChange} accent={accent} />
            )}
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button onClick={onNext} disabled={!canProceed}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: accent }}>
              {btnLabel} {!isLast && <ArrowRight size={14} />}
            </button>
            {question.type !== "statement" && question.type !== "multiple_choice" && question.type !== "checkbox" && question.type !== "rating" && (
              <span className="text-xs text-gray-400">press <kbd className="font-mono bg-gray-100 px-1 rounded">Enter</kbd></span>
            )}
          </div>

          {canGoBack && (
            <button onClick={onBack} className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
          )}
        </div>
      </div>

      {settings.show_branding && (
        <div className="fixed bottom-4 right-6 flex items-center gap-1 text-xs text-gray-300">
          <Zap size={10} /> Powered by FlowMake
        </div>
      )}
    </div>
  );
}

// ── Thank you screen ───────────────────────────────────────────────────────────

function ThankYouScreen({ settings, onReset }: { settings: FormSettings; onReset: () => void }) {
  useEffect(() => {
    if (settings.redirect_url) {
      const t = setTimeout(() => {
        window.location.href = settings.redirect_url!;
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [settings.redirect_url]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: settings.bg_color, fontFamily: settings.font }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: settings.accent_color + "20" }}>
          <Check size={28} style={{ color: settings.accent_color }} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {settings.submit_message || "Thanks for submitting!"}
        </h2>
        {settings.redirect_url && (
          <p className="text-sm text-gray-400 mb-4">Redirecting you shortly…</p>
        )}
        <button onClick={onReset}
          className="flex items-center gap-1.5 mx-auto mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <RotateCcw size={12} /> Submit another response
        </button>
      </div>

      {settings.show_branding && (
        <div className="absolute bottom-6 flex items-center gap-1 text-xs text-gray-300">
          <Zap size={10} /> Powered by FlowMake
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [welcomePassed, setWelcomePassed] = useState(false);

  useEffect(() => {
    fetch(`/api/forms/${id}/public`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setNotFound(true); }
        else {
          data.questions = data.questions ?? [];
          data.settings = {
            accent_color: "#6366f1",
            bg_color: "#ffffff",
            font: "Inter, sans-serif",
            show_progress: true,
            show_branding: true,
            submit_message: "Thanks for submitting!",
            ...data.settings,
          };
          setForm(data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Resolve the effective answer value for logic checks (strips __other__ prefix)
  const resolveValue = (q: { type: QuestionType; options?: string[] }, raw: string) => {
    if (raw === "__other__") return "__other__";
    const opts = q.options ?? [];
    if (!opts.includes(raw) && raw !== "") return "__other__"; // other text → treat as __other__ for logic
    return raw;
  };

  const handleNext = async () => {
    if (!form) return;
    const q = form.questions[currentIndex];
    const raw = answers[q.id] ?? "";
    const logicKey = resolveValue(q, raw);

    // Check option_logic for jump
    const jumpTo = q.option_logic?.[logicKey];
    if (jumpTo) {
      if (jumpTo === "end") {
        // skip to submission
      } else {
        const targetIdx = form.questions.findIndex(x => x.id === jumpTo);
        if (targetIdx !== -1) {
          setCurrentIndex(targetIdx);
          return;
        }
      }
    } else if (currentIndex < form.questions.length - 1 && jumpTo !== "end") {
      setCurrentIndex(i => i + 1);
      return;
    }

    // Submit
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const [qid, rawVal] of Object.entries(answers)) {
        const question = form.questions.find(x => x.id === qid);
        if (question?.type === "checkbox") {
          const parts = rawVal.split("\n").filter(Boolean);
          const knownOpts = question.options ?? [];
          payload[qid] = parts.map(p => knownOpts.includes(p) ? p : (p === "__other__" ? "Other" : p));
        } else if (question?.type === "file_upload") {
          try { payload[qid] = JSON.parse(rawVal); } catch { payload[qid] = rawVal; }
        } else if (question?.type === "rating" || question?.type === "number") {
          payload[qid] = Number(rawVal) || rawVal;
        } else if (rawVal === "__other__") {
          payload[qid] = "Other";
        } else {
          payload[qid] = rawVal;
        }
      }

      const res = await fetch(`/api/forms/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to submit");
      }
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentIndex(0);
    setDone(false);
    setSubmitError("");
    setWelcomePassed(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-indigo-500" />
    </div>
  );

  if (notFound || !form) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-center px-6">
      <AlertCircle size={24} className="text-gray-400" />
      <h2 className="text-base font-bold text-gray-700">Form not found</h2>
      <p className="text-sm text-gray-400">This form may not be published or the link is incorrect.</p>
    </div>
  );

  if (form.questions.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-center px-6">
      <AlertCircle size={24} className="text-gray-400" />
      <h2 className="text-base font-bold text-gray-700">Form has no questions</h2>
    </div>
  );

  if (done) return <ThankYouScreen settings={form.settings} onReset={handleReset} />;

  // Welcome screen
  if (form.settings.show_welcome && !welcomePassed) {
    const s = form.settings;
    const accent = s.accent_color;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: s.bg_color, fontFamily: s.font, color: s.text_color ?? "#111827" }}>
        <div className="max-w-lg w-full">
          <h1 className="text-3xl font-bold mb-4 leading-snug">{s.welcome_title || form.name}</h1>
          {(s.welcome_description || form.description) && (
            <p className="text-base mb-8 opacity-60">{s.welcome_description || form.description}</p>
          )}
          <button onClick={() => setWelcomePassed(true)}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: accent }}>
            {s.welcome_button_text || "Get started"} <ArrowRight size={16} />
          </button>
          <p className="text-xs text-gray-400 mt-6">{form.questions.length} question{form.questions.length !== 1 ? "s" : ""}</p>
        </div>
        {s.show_branding && (
          <div className="absolute bottom-6 flex items-center gap-1 text-xs text-gray-300">
            <Zap size={10} /> Powered by FlowMake
          </div>
        )}
      </div>
    );
  }

  const q = form.questions[currentIndex];
  const currentAnswer = answers[q.id] ?? "";
  const currentLogicKey = (() => {
    const opts = q.options ?? [];
    if (currentAnswer === "__other__") return "__other__";
    if (!opts.includes(currentAnswer) && currentAnswer !== "") return "__other__";
    return currentAnswer;
  })();
  const jumpTarget = q.option_logic?.[currentLogicKey];
  const isLast = currentIndex === form.questions.length - 1 || jumpTarget === "end";

  return (
    <>
      <QuestionSlide
        question={q}
        formId={id}
        index={currentIndex}
        total={form.questions.length}
        value={answers[q.id] ?? ""}
        onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
        onNext={handleNext}
        onBack={() => setCurrentIndex(i => Math.max(0, i - 1))}
        canGoBack={currentIndex > 0}
        settings={form.settings}
        isLast={isLast}
      />
      {submitting && (
        <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      )}
      {submitError && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 shadow">
          <AlertCircle size={13} /> {submitError}
        </div>
      )}
    </>
  );
}
