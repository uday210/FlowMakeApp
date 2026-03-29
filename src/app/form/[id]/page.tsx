"use client";

import { use, useEffect, useState } from "react";
import type { Workflow, WorkflowNode } from "@/lib/types";
import { Zap, CheckCircle, Loader2 } from "lucide-react";

interface FormField {
  name: string;
  type: "text" | "email" | "textarea" | "select" | "date" | "datetime" | "time" | "number" | "checkbox" | "radio" | "tel" | "url" | "password";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

function parseFields(raw: string): FormField[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FormField[];
  } catch {
    // fallback: comma-separated plain names → text fields
    return raw.split(",").map((s) => ({ name: s.trim(), type: "text" as const, label: s.trim().charAt(0).toUpperCase() + s.trim().slice(1).replace(/_/g, " ") })).filter((f) => f.name);
  }
  return [];
}

const inputClass = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

function Field({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = field.label || field.name;

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className={`${inputClass} resize-none`}
          rows={4}
          placeholder={field.placeholder}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <select
          className={inputClass}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {label}...</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case "radio":
      return (
        <div className="space-y-2 pt-1">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name={field.name}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                required={field.required}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
            </label>
          ))}
        </div>
      );

    case "checkbox":
      return (
        <label className="flex items-center gap-2.5 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            required={field.required}
            className="accent-blue-600 w-4 h-4 rounded"
          />
          <span className="text-sm text-gray-700">{label}</span>
        </label>
      );

    case "date":
      return (
        <input
          type="date"
          className={inputClass}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "datetime":
      return (
        <input
          type="datetime-local"
          className={inputClass}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "time":
      return (
        <input
          type="time"
          className={inputClass}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return (
        <input
          type={field.type}
          className={inputClass}
          placeholder={field.placeholder}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [title, setTitle] = useState("Form");
  const [submitLabel, setSubmitLabel] = useState("Submit");
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/workflows/${id}`)
      .then((r) => r.json())
      .then((data: Workflow) => {
        setWorkflow(data);
        const triggerNode = (data.nodes as WorkflowNode[]).find(
          (n) => n.data?.type === "trigger_form"
        );
        if (triggerNode) {
          const cfg = triggerNode.data.config;
          setTitle((cfg.title as string) || data.name);
          setSubmitLabel((cfg.submit_label as string) || "Submit");
          const parsed = parseFields((cfg.fields as string) || "");
          setFields(parsed);
          setValues(Object.fromEntries(parsed.map((f) => [f.name, ""])));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch(`/api/webhook/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, _trigger: "form" }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  const resetForm = () => {
    setStatus("idle");
    setValues(Object.fromEntries(fields.map((f) => [f.name, ""])));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  if (!workflow || fields.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Form not found or not configured.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-blue-200" />
            <span className="text-blue-200 text-xs font-medium">Powered by FlowMake</span>
          </div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>

        <div className="p-6">
          {status === "success" ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-gray-800">Submitted!</h2>
              <p className="text-sm text-gray-500 mt-1">Your response has been recorded.</p>
              <button
                onClick={resetForm}
                className="mt-4 text-xs text-blue-600 hover:underline"
              >
                Submit another response
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {fields.map((field) => (
                <div key={field.name}>
                  {/* Label — skip for checkbox (it renders inline) */}
                  {field.type !== "checkbox" && (
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      {field.label || field.name}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                  )}
                  <Field
                    field={field}
                    value={values[field.name] ?? ""}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
                  />
                </div>
              ))}

              {status === "error" && (
                <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {status === "submitting" ? (
                  <><Loader2 size={14} className="animate-spin" /> Submitting...</>
                ) : (
                  submitLabel
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
