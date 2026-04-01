"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, Tag, Loader2, Save, Play, Download,
  RefreshCw, BookOpen, AlertTriangle, Check, ChevronDown, ChevronRight,
  Zap, Clock, Trash2, RotateCcw,
} from "lucide-react";

interface DetectedField {
  key: string;
  path: string;
  formatter: string;
  kind: "field" | "loop_start" | "loop_end" | "condition_if" | "condition_else";
}

interface DocTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  file_name: string;
  file_size: number;
  detected_fields: DetectedField[];
  field_mappings: Record<string, string>;
  sample_data: Record<string, unknown>;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  field:           { label: "Field",       color: "bg-blue-100 text-blue-700" },
  loop_start:      { label: "Loop ▶",      color: "bg-violet-100 text-violet-700" },
  loop_end:        { label: "Loop ■",      color: "bg-violet-100 text-violet-700" },
  condition_if:    { label: "If",          color: "bg-amber-100 text-amber-700" },
  condition_else:  { label: "Else",        color: "bg-orange-100 text-orange-700" },
};

export default function DocTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [tpl, setTpl] = useState<DocTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [redetecting, setRedetecting] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sampleJson, setSampleJson] = useState("{}");
  const [sampleErr, setSampleErr] = useState("");
  const [activeTab, setActiveTab] = useState<"fields" | "test" | "history">("fields");

  // Test / generate
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [genOk, setGenOk] = useState("");

  // History
  const [history, setHistory] = useState<{ id: string; name: string; created_at: string; file_size: number }[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/doc-templates/${id}`);
    const d = await r.json();
    if (d.id) {
      setTpl(d);
      setName(d.name);
      setDescription(d.description ?? "");
      setSampleJson(JSON.stringify(d.sample_data ?? {}, null, 2));
    }
    setLoading(false);
  }

  async function loadHistory() {
    setHistLoading(true);
    // We'll query generated_docs via a simple fetch — filter by template_id
    const r = await fetch(`/api/doc-templates/${id}/history`);
    if (r.ok) {
      const d = await r.json();
      setHistory(Array.isArray(d) ? d : []);
    }
    setHistLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    let parsedSample: Record<string, unknown> = {};
    try { parsedSample = JSON.parse(sampleJson); } catch { /* keep empty */ }
    await fetch(`/api/doc-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, sample_data: parsedSample }),
    });
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  }

  async function handleRedetect() {
    setRedetecting(true);
    const r = await fetch(`/api/doc-templates/${id}/fields`);
    const d = await r.json();
    if (Array.isArray(d)) {
      setTpl(prev => prev ? { ...prev, detected_fields: d } : prev);
    }
    setRedetecting(false);
  }

  async function handleGenerate(preview: boolean) {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(sampleJson);
      setSampleErr("");
    } catch {
      setSampleErr("Invalid JSON — fix before generating");
      return;
    }

    setGenerating(true);
    setGenErr("");
    setGenOk("");

    const res = await fetch(`/api/doc-templates/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, preview, output_name: `${name}.docx` }),
    });

    if (preview) {
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}_preview.docx`;
        a.click();
        URL.revokeObjectURL(url);
        setGenOk("Preview downloaded!");
      } else {
        const d = await res.json();
        setGenErr(d.error ?? "Failed to generate");
      }
    } else {
      const d = await res.json();
      if (res.ok) {
        setGenOk("Document generated successfully!");
        if (d.document_url) {
          window.open(d.document_url, "_blank");
        }
      } else {
        setGenErr(d.error ?? "Failed to generate");
      }
    }
    setGenerating(false);
  }

  const fields = tpl?.detected_fields ?? [];
  const mergeFields  = fields.filter(f => f.kind === "field");
  const loopFields   = fields.filter(f => f.kind === "loop_start");
  const condFields   = fields.filter(f => f.kind === "condition_if" || f.kind === "condition_else");

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 size={24} className="animate-spin text-gray-300" />
    </div>
  );

  if (!tpl) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Template not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.push("/doc-templates")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={15} /> Templates
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
          <FileText size={15} className="text-violet-600" />
        </div>
        <input value={name} onChange={e => setName(e.target.value)}
          className="flex-1 font-semibold text-gray-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-violet-400 px-1 py-0.5 min-w-0" />
        <span className="text-xs text-gray-400">{tpl.file_name} · {formatBytes(tpl.file_size)}</span>
        <button onClick={() => router.push("/doc-templates/guide")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <BookOpen size={12} /> Guide
        </button>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${saveOk ? "bg-green-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"}`}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : saveOk ? <Check size={12} /> : <Save size={12} />}
          {saveOk ? "Saved!" : "Save"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — template info */}
        <div className="w-64 bg-white border-r border-gray-100 flex flex-col overflow-y-auto p-4 gap-4 flex-shrink-0">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="What is this template for?"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 resize-none" />
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Merge fields</span>
              <span className="font-semibold text-gray-800">{mergeFields.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Loops</span>
              <span className="font-semibold text-gray-800">{loopFields.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Conditions</span>
              <span className="font-semibold text-gray-800">{condFields.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Generated</span>
              <span className="font-semibold text-gray-800">{tpl.usage_count}×</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="font-semibold text-gray-800">
                {new Date(tpl.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          </div>

          <button onClick={handleRedetect} disabled={redetecting}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-600 transition-colors disabled:opacity-50">
            {redetecting ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            Re-detect fields
          </button>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="bg-white border-b border-gray-100 px-6 flex items-center gap-1">
            {(["fields", "test", "history"] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); if (tab === "history") loadHistory(); }}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? "border-violet-500 text-violet-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {tab === "fields" ? `Merge Fields (${mergeFields.length})` : tab === "test" ? "Test & Generate" : "History"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── Fields tab ── */}
            {activeTab === "fields" && (
              <div className="space-y-4 max-w-2xl">
                {fields.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <Tag size={28} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500">No fields detected</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">
                      Make sure your Word doc uses <code className="bg-gray-100 px-1 rounded">{"{field_name}"}</code> syntax
                    </p>
                    <button onClick={handleRedetect} disabled={redetecting}
                      className="text-xs font-semibold text-violet-600 hover:text-violet-700">
                      {redetecting ? "Detecting…" : "Run field detection →"}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Merge fields */}
                    {mergeFields.length > 0 && (
                      <section>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Merge Fields</h3>
                        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                          {mergeFields.map(f => (
                            <div key={f.key} className="px-4 py-3 flex items-center gap-3">
                              <code className="text-xs font-mono bg-violet-50 text-violet-700 px-2 py-1 rounded flex-1 truncate">
                                {"{" + f.key + "}"}
                              </code>
                              {f.formatter && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 font-mono px-1.5 py-0.5 rounded">
                                  | {f.formatter}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{f.path}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Loops */}
                    {loopFields.length > 0 && (
                      <section>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Array Loops</h3>
                        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                          {loopFields.map(f => (
                            <div key={f.key} className="px-4 py-3 flex items-center gap-3">
                              <RefreshCw size={12} className="text-violet-400 flex-shrink-0" />
                              <code className="text-xs font-mono bg-violet-50 text-violet-700 px-2 py-1 rounded flex-1">
                                {"{#" + f.path + "}"} … {"{/" + f.path + "}"}
                              </code>
                              <span className="text-[10px] text-gray-400">iterates over <code className="font-mono">{f.path}</code> array</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Conditions */}
                    {condFields.length > 0 && (
                      <section>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Conditionals</h3>
                        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                          {condFields.map(f => (
                            <div key={f.key} className="px-4 py-3 flex items-center gap-3">
                              <ChevronDown size={12} className="text-amber-400 flex-shrink-0" />
                              <code className="text-xs font-mono bg-amber-50 text-amber-700 px-2 py-1 rounded">
                                {f.kind === "condition_else" ? "{^" + f.path + "}" : "{#" + f.path + "}"}
                              </code>
                              <span className="text-[10px] text-gray-400">
                                {f.kind === "condition_else" ? "shown when falsy / empty" : "shown when truthy"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {/* Quick cheatsheet */}
                <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono">
                  <p className="text-gray-400 mb-2 font-sans font-semibold text-[10px] uppercase tracking-wide">Quick Reference</p>
                  {[
                    ["{field_name}", "Simple merge field"],
                    ["{amount | currency}", "Format as $1,234.56"],
                    ["{date | date}", "Format as January 15, 2025"],
                    ["{#items}…{/items}", "Loop over array"],
                    ["{#flag}…{/flag}", "Show if truthy"],
                    ["{^flag}…{/flag}", "Show if falsy"],
                  ].map(([code, desc]) => (
                    <div key={code} className="flex items-baseline gap-3 py-0.5">
                      <span className="text-violet-400 min-w-[200px]">{code}</span>
                      <span className="text-gray-500">{desc}</span>
                    </div>
                  ))}
                  <button onClick={() => router.push("/doc-templates/guide")}
                    className="mt-3 text-[10px] text-violet-400 hover:text-violet-300 font-sans flex items-center gap-1">
                    Full reference guide <ChevronRight size={10} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Test & Generate tab ── */}
            {activeTab === "test" && (
              <div className="max-w-2xl space-y-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">
                    Sample Data (JSON)
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Paste the JSON payload that matches your template's merge fields. This is also used as default data when the template is triggered from a scenario.
                  </p>
                  <textarea
                    value={sampleJson}
                    onChange={e => { setSampleJson(e.target.value); setSampleErr(""); }}
                    rows={16}
                    spellCheck={false}
                    className="w-full font-mono text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-violet-400 resize-none bg-gray-50"
                    placeholder={'{\n  "customer_name": "Acme Corp",\n  "amount": 50000,\n  "items": [\n    { "name": "Service A", "price": 25000 }\n  ]\n}'}
                  />
                  {sampleErr && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertTriangle size={11} /> {sampleErr}
                    </p>
                  )}
                </div>

                {genErr && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {genErr}
                  </div>
                )}
                {genOk && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <Check size={14} /> {genOk}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button onClick={() => handleGenerate(true)} disabled={generating}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Preview Download
                  </button>
                  <button onClick={() => handleGenerate(false)} disabled={generating}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50">
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Generate & Save
                  </button>
                </div>

                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700">
                  <strong>Preview Download</strong> — generates and downloads without saving a record. Use for testing.<br />
                  <strong>Generate & Save</strong> — generates, saves to history, and returns a download URL. Use in production.
                </div>
              </div>
            )}

            {/* ── History tab ── */}
            {activeTab === "history" && (
              <div className="max-w-2xl">
                {histLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-gray-300" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                    <Zap size={28} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No documents generated yet</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                        <FileText size={14} className="text-gray-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{h.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={9} /> {new Date(h.created_at).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                            })}
                            {h.file_size ? ` · ${(h.file_size / 1024).toFixed(1)} KB` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
