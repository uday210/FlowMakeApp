"use client";

import { useState } from "react";
import { Zap, CheckCircle, Loader2 } from "lucide-react";

// Public renderer for a workflow whose trigger node is `trigger_form`.
// The form URL shown in the workflow builder is /form/<workflowId>, so this
// renders alongside the standalone Forms module which shares the same route.

export type WorkflowFormConfig = {
  id: string;
  title: string;
  submit_label: string;
  fields: string;
  is_active: boolean;
};

type FormField = {
  name: string;
  type: "text" | "email" | "textarea" | "select" | "date" | "datetime" | "time" | "number" | "checkbox" | "radio" | "tel" | "url" | "password";
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[] | string;
};

export function parseWorkflowFields(raw: string): FormField[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as FormField[])
        .filter(f => f && f.name)
        .map(f => ({
          ...f,
          type: f.type ?? "text",
          // the builder stores select options as a comma-separated string
          options: typeof f.options === "string"
            ? f.options.split(",").map(o => o.trim()).filter(Boolean)
            : f.options,
        }));
    }
  } catch {
    // fallback: comma-separated plain names → text fields
    return raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => ({ name: s, type: "text" as const, label: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") }));
  }
  return [];
}

const inputClass = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

function Field({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  const label = field.label || field.name;
  const options = Array.isArray(field.options) ? field.options : [];

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
        <select className={inputClass} required={field.required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select {label}...</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );

    case "radio":
      return (
        <div className="space-y-2 pt-1">
          {options.map((opt) => (
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

    default:
      return (
        <input
          type={field.type === "datetime" ? "datetime-local" : field.type}
          className={inputClass}
          placeholder={field.placeholder}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function WorkflowForm({ form }: { form: WorkflowFormConfig }) {
  const fields = parseWorkflowFields(form.fields || "");
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.name, ""]))
  );
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/webhook/${form.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, _trigger: "form" }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const resetForm = () => {
    setStatus("idle");
    setErrorMsg("");
    setValues(Object.fromEntries(fields.map((f) => [f.name, ""])));
  };

  if (fields.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-2 text-center px-6">
        <h2 className="text-base font-bold text-gray-700">Form has no fields</h2>
        <p className="text-sm text-gray-400">Add fields to the Form Submission trigger in the workflow builder.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-blue-200" />
            <span className="text-blue-200 text-xs font-medium">Powered by FlowMake</span>
          </div>
          <h1 className="text-xl font-bold text-white">{form.title}</h1>
        </div>

        <div className="p-6">
          {status === "success" ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-gray-800">Submitted!</h2>
              <p className="text-sm text-gray-500 mt-1">Your response has been recorded.</p>
              <button onClick={resetForm} className="mt-4 text-xs text-blue-600 hover:underline">
                Submit another response
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!form.is_active && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This workflow is paused — submissions won&apos;t be processed until it&apos;s turned on.
                </p>
              )}

              {fields.map((field) => (
                <div key={field.name}>
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

              {status === "error" && <p className="text-xs text-red-500">{errorMsg}</p>}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {status === "submitting" ? (
                  <><Loader2 size={14} className="animate-spin" /> Submitting...</>
                ) : (
                  form.submit_label
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
