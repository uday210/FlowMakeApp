"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Save, Eye, EyeOff, Loader2, Trash2, GripVertical,
  ChevronDown, ChevronUp, Settings, Type, MousePointer, Minus, AlignLeft,
  Image as ImageIcon, Mail, Variable, Copy, Send, X, Check, Monitor, Smartphone,
} from "lucide-react";
import {
  Block, TemplateSettings, DEFAULT_SETTINGS,
  BLOCK_DEFAULTS, renderTemplateHtml, renderTemplatePlain,
} from "@/lib/emailTemplateRenderer";

// Dynamically import the preview to avoid SSR issues with iframe
const TemplatePreview = dynamic(() => import("@/components/EmailTemplatePreview"), { ssr: false });

type BlockWithId = Block & { _id: string };

function uid() { return Math.random().toString(36).slice(2, 10); }

const BLOCK_PALETTE = [
  { type: "header",  icon: Mail,          label: "Header" },
  { type: "text",    icon: Type,          label: "Text" },
  { type: "button",  icon: MousePointer,  label: "Button" },
  { type: "image",   icon: ImageIcon,     label: "Image" },
  { type: "divider", icon: Minus,         label: "Divider" },
  { type: "spacer",  icon: AlignLeft,     label: "Spacer" },
  { type: "footer",  icon: AlignLeft,     label: "Footer" },
];

const CATEGORIES = ["custom", "esign", "workflow"];

const ESIGN_VARS = [
  { key: "signer_name",     label: "Signer Name" },
  { key: "signer_email",    label: "Signer Email" },
  { key: "document_title",  label: "Document Title" },
  { key: "signing_url",     label: "Signing URL" },
  { key: "sender_name",     label: "Sender Name" },
  { key: "org_name",        label: "Organization Name" },
];

const WORKFLOW_VARS = [
  { key: "workflow_name",   label: "Workflow Name" },
  { key: "org_name",        label: "Organization Name" },
  { key: "trigger_data",    label: "Trigger Data" },
];

// ── Block editors ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    />
  );
}

function Textarea({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value} rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5" />
      <Input value={value} onChange={onChange} placeholder="#000000" />
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function BlockEditor({ block, onChange }: { block: BlockWithId; onChange: (b: Block) => void }) {
  const update = (patch: Partial<Block>) => onChange({ ...block, ...patch } as Block);

  switch (block.type) {
    case "header":
      return (
        <div className="space-y-4">
          <Field label="Title"><Input value={block.title} onChange={(v) => update({ title: v })} /></Field>
          <Field label="Subtitle"><Input value={block.subtitle} onChange={(v) => update({ subtitle: v })} /></Field>
          <Field label="Logo URL"><Input value={block.logoUrl} onChange={(v) => update({ logoUrl: v })} placeholder="https://..." /></Field>
          <Field label="Background Color"><ColorInput value={block.bgColor} onChange={(v) => update({ bgColor: v })} /></Field>
          <Field label="Text Color"><ColorInput value={block.textColor} onChange={(v) => update({ textColor: v })} /></Field>
        </div>
      );

    case "text":
      return (
        <div className="space-y-4">
          <Field label="Content">
            <Textarea value={block.content} onChange={(v) => update({ content: v })} rows={6} />
            <p className="text-[11px] text-gray-400 mt-1">Use {"{{variable}}"} to insert dynamic values</p>
          </Field>
          <Field label="Font Size">
            <input type="range" min={11} max={28} value={block.fontSize}
              onChange={(e) => update({ fontSize: +e.target.value })}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-gray-500 text-right">{block.fontSize}px</p>
          </Field>
          <Field label="Color"><ColorInput value={block.color} onChange={(v) => update({ color: v })} /></Field>
          <Field label="Alignment">
            <Select value={block.align} onChange={(v) => update({ align: v as "left" | "center" | "right" })}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
          </Field>
          <Field label="Bold">
            <button onClick={() => update({ bold: !block.bold })}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${block.bold ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              Bold
            </button>
          </Field>
        </div>
      );

    case "button":
      return (
        <div className="space-y-4">
          <Field label="Label"><Input value={block.label} onChange={(v) => update({ label: v })} /></Field>
          <Field label="URL">
            <Input value={block.url} onChange={(v) => update({ url: v })} placeholder="https:// or {{signing_url}}" />
          </Field>
          <Field label="Alignment">
            <Select value={block.align} onChange={(v) => update({ align: v as "left" | "center" | "right" })}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
          </Field>
          <Field label="Button Color"><ColorInput value={block.bgColor} onChange={(v) => update({ bgColor: v })} /></Field>
          <Field label="Text Color"><ColorInput value={block.textColor} onChange={(v) => update({ textColor: v })} /></Field>
          <Field label="Full Width">
            <button onClick={() => update({ fullWidth: !block.fullWidth })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${block.fullWidth ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {block.fullWidth ? "Full Width On" : "Full Width Off"}
            </button>
          </Field>
        </div>
      );

    case "image":
      return (
        <div className="space-y-4">
          <Field label="Image URL"><Input value={block.src} onChange={(v) => update({ src: v })} placeholder="https://..." /></Field>
          <Field label="Alt Text"><Input value={block.alt} onChange={(v) => update({ alt: v })} /></Field>
          <Field label="Link URL"><Input value={block.linkUrl} onChange={(v) => update({ linkUrl: v })} placeholder="https://..." /></Field>
          <Field label="Width %">
            <input type="range" min={20} max={100} value={block.width}
              onChange={(e) => update({ width: +e.target.value })}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-gray-500 text-right">{block.width}%</p>
          </Field>
          <Field label="Alignment">
            <Select value={block.align} onChange={(v) => update({ align: v as "left" | "center" | "right" })}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
          </Field>
        </div>
      );

    case "divider":
      return (
        <div className="space-y-4">
          <Field label="Color"><ColorInput value={block.color} onChange={(v) => update({ color: v })} /></Field>
          <Field label="Thickness">
            <input type="range" min={1} max={8} value={block.thickness}
              onChange={(e) => update({ thickness: +e.target.value })}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-gray-500 text-right">{block.thickness}px</p>
          </Field>
          <Field label="Margin">
            <input type="range" min={8} max={64} value={block.margin}
              onChange={(e) => update({ margin: +e.target.value })}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-gray-500 text-right">{block.margin}px</p>
          </Field>
        </div>
      );

    case "spacer":
      return (
        <div className="space-y-4">
          <Field label="Height">
            <input type="range" min={8} max={120} value={block.height}
              onChange={(e) => update({ height: +e.target.value })}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-gray-500 text-right">{block.height}px</p>
          </Field>
        </div>
      );

    case "footer":
      return (
        <div className="space-y-4">
          <Field label="Content"><Textarea value={block.content} onChange={(v) => update({ content: v })} rows={3} /></Field>
          <Field label="Color"><ColorInput value={block.color} onChange={(v) => update({ color: v })} /></Field>
          <Field label="Font Size">
            <input type="range" min={10} max={16} value={block.fontSize}
              onChange={(e) => update({ fontSize: +e.target.value })}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-gray-500 text-right">{block.fontSize}px</p>
          </Field>
        </div>
      );

    default:
      return null;
  }
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function EmailTemplateBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const [preview, setPreview]     = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [name, setName]           = useState("Untitled Template");
  const [description, setDescription] = useState("");
  const [category, setCategory]   = useState("custom");
  const [subject, setSubject]     = useState("");
  const [blocks, setBlocks]       = useState<BlockWithId[]>([]);
  const [settings, setSettings]   = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showVars, setShowVars]   = useState(false);
  // Test email
  const [showTest, setShowTest]   = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg]     = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  // Load template
  useEffect(() => {
    fetch(`/api/email-templates/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.name)     setName(d.name);
        if (d.description) setDescription(d.description);
        if (d.category) setCategory(d.category);
        if (d.subject)  setSubject(d.subject);
        if (d.settings && Object.keys(d.settings).length) setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
        if (Array.isArray(d.blocks)) {
          setBlocks(d.blocks.map((b: Block) => ({ ...b, _id: uid() })));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const selectedBlock = blocks.find((b) => b._id === selectedId) ?? null;

  const addBlock = (type: string) => {
    const def = BLOCK_DEFAULTS[type];
    if (!def) return;
    const newBlock: BlockWithId = { ...def, _id: uid() } as BlockWithId;
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(newBlock._id);
  };

  const updateBlock = useCallback((updated: Block) => {
    setBlocks((prev) => prev.map((b) => b._id === selectedId ? { ...updated, _id: b._id } as BlockWithId : b));
  }, [selectedId]);

  const deleteBlock = (bid: string) => {
    setBlocks((prev) => prev.filter((b) => b._id !== bid));
    if (selectedId === bid) setSelectedId(null);
  };

  const duplicateBlock = (bid: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b._id === bid);
      if (idx === -1) return prev;
      const { _id: _, ...rest } = prev[idx];
      const copy: BlockWithId = { ...rest, _id: uid() } as BlockWithId;
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setSelectedId(copy._id);
      return next;
    });
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestMsg("");
    try {
      const res = await fetch(`/api/email-templates/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const d = await res.json();
      setTestMsg(res.ok ? "Test email sent!" : (d.error ?? "Failed to send"));
    } catch {
      setTestMsg("Failed to send");
    } finally {
      setTestSending(false);
    }
  };

  const moveBlock = (from: number, to: number) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const handleDragStart = (i: number) => { dragItem.current = i; };
  const handleDragEnter = (i: number) => { dragOver.current = i; };
  const handleDragEnd   = () => {
    if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
      moveBlock(dragItem.current, dragOver.current);
    }
    dragItem.current = null;
    dragOver.current = null;
  };

  const save = async () => {
    setSaving(true);
    const rawBlocks = blocks.map(({ _id: _, ...rest }) => rest);
    const html = renderTemplateHtml(rawBlocks as Block[], settings);
    const plain = renderTemplatePlain(rawBlocks as Block[]);
    const varKeys = [...html.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)].map((m) => m[1]);
    const unique = [...new Set(varKeys)].map((k) => ({ key: k, label: k.replace(/_/g, " ") }));

    await fetch(`/api/email-templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, category, subject, blocks: rawBlocks, settings, html_body: html, plain_body: plain, variables: unique }),
    });
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  };

  const previewHtml = blocks.length
    ? renderTemplateHtml(blocks.map(({ _id: _, ...rest }) => rest) as Block[], settings)
    : "";

  const varList = category === "esign" ? ESIGN_VARS : category === "workflow" ? WORKFLOW_VARS : [...ESIGN_VARS, ...WORKFLOW_VARS];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-gray-300" size={28} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push("/email-templates")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 font-semibold text-gray-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-indigo-400 px-1 py-0.5 min-w-0"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <button onClick={() => setShowVars((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showVars ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <Variable size={13} /> Variables
        </button>
        <button onClick={() => { setShowTest((v) => !v); setTestMsg(""); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showTest ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <Send size={13} /> Test
        </button>
        <button onClick={() => setPreview((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${preview ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          {preview ? <EyeOff size={13} /> : <Eye size={13} />} {preview ? "Edit" : "Preview"}
        </button>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${saveOk ? "bg-green-600 hover:bg-green-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : saveOk ? <Check size={13} /> : <Save size={13} />}
          {saveOk ? "Saved!" : "Save"}
        </button>
      </div>

      {/* ── Test email panel ── */}
      {showTest && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 flex items-center gap-3">
          <Send size={14} className="text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-700 flex-shrink-0">Send test to:</span>
          <input
            type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            onKeyDown={(e) => e.key === "Enter" && sendTest()}
            className="flex-1 max-w-xs border border-emerald-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          />
          <button onClick={sendTest} disabled={testSending || !testEmail.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors">
            {testSending ? <Loader2 size={12} className="animate-spin" /> : "Send"}
          </button>
          {testMsg && <span className={`text-xs font-medium ${testMsg.includes("sent") ? "text-emerald-600" : "text-red-500"}`}>{testMsg}</span>}
          <button onClick={() => setShowTest(false)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      )}

      {preview ? (
        /* ── Preview mode ── */
        <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
          {/* Mobile/Desktop toggle */}
          <div className="flex items-center gap-2 mb-4 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setMobilePreview(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!mobilePreview ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Monitor size={13} /> Desktop
            </button>
            <button onClick={() => setMobilePreview(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mobilePreview ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Smartphone size={13} /> Mobile
            </button>
          </div>
          <div className={`w-full ${mobilePreview ? "max-w-sm" : "max-w-2xl"} transition-all`}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500">Subject:</p>
                <p className="text-sm text-gray-800">{subject || "(no subject)"}</p>
              </div>
              <TemplatePreview html={previewHtml} />
            </div>
          </div>
        </div>
      ) : (
        /* ── Editor mode ── */
        <div className="flex flex-1 overflow-hidden">

          {/* Left — Block palette */}
          <div className="w-52 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Add Blocks</p>
            </div>
            <div className="p-3 space-y-1.5 flex-1">
              {BLOCK_PALETTE.map(({ type, icon: Icon, label }) => (
                <button key={type} onClick={() => addBlock(type)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors group">
                  <Icon size={14} className="text-gray-400 group-hover:text-indigo-500" />
                  {label}
                </button>
              ))}
            </div>

            {/* Design settings toggle */}
            <div className="border-t border-gray-100">
              <button onClick={() => { setShowSettings((v) => !v); setSelectedId(null); }}
                className={`w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors ${showSettings ? "text-indigo-600 bg-indigo-50" : "text-gray-600 hover:bg-gray-50"}`}>
                <Settings size={13} /> Design Settings
                {showSettings ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
              </button>
            </div>
          </div>

          {/* Center — Canvas */}
          <div className="flex-1 overflow-auto p-6" onClick={() => setSelectedId(null)}>
            {/* Subject line */}
            <div className="max-w-xl mx-auto mb-4">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <span className="text-xs font-semibold text-gray-400 flex-shrink-0">Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line..."
                  className="flex-1 text-sm text-gray-800 bg-transparent outline-none" />
              </div>
            </div>

            {/* Email canvas */}
            <div className="max-w-xl mx-auto">
              <div className="rounded-xl overflow-hidden shadow-md border border-gray-200"
                style={{ backgroundColor: settings.bgColor }}>
                <div className="mx-auto rounded-xl overflow-hidden"
                  style={{ backgroundColor: settings.contentBgColor, maxWidth: settings.maxWidth }}>
                  {blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                      <Mail size={32} className="text-gray-300 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Add blocks from the left panel</p>
                      <p className="text-xs text-gray-300 mt-1">Click any block type to add it to your email</p>
                    </div>
                  ) : (
                    blocks.map((block, i) => (
                      <div key={block._id}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragEnter={() => handleDragEnter(i)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(block._id); setShowSettings(false); }}
                        className={`relative group cursor-pointer transition-all ${selectedId === block._id ? "ring-2 ring-indigo-500 ring-offset-0" : "hover:ring-1 hover:ring-gray-300"}`}
                      >
                        {/* Block controls */}
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white border border-gray-200 rounded-lg flex items-center shadow-sm">
                            <button className="p-1.5 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                              <GripVertical size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); moveBlock(i, i - 1); }}
                              disabled={i === 0}
                              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                              <ChevronUp size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); moveBlock(i, i + 1); }}
                              disabled={i === blocks.length - 1}
                              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                              <ChevronDown size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block._id); }}
                              title="Duplicate block"
                              className="p-1.5 text-gray-400 hover:text-indigo-600">
                              <Copy size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteBlock(block._id); }}
                              className="p-1.5 text-red-400 hover:text-red-600">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Block preview - rendered inline */}
                        <BlockPreviewRenderer block={block} settings={settings} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right — Properties / Variables / Settings */}
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex flex-col">
            {showVars ? (
              /* Variables panel */
              <div className="flex-1 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Available Variables</p>
                <p className="text-xs text-gray-400 mb-4">Click to copy. Paste into any text or button URL field.</p>
                <div className="space-y-1.5">
                  {varList.map((v) => (
                    <button key={v.key}
                      onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors group text-left">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700 font-mono">{`{{${v.key}}}`}</p>
                        <p className="text-[11px] text-gray-400">{v.label}</p>
                      </div>
                      <span className="text-[10px] text-gray-300 group-hover:text-indigo-400">copy</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : showSettings ? (
              /* Design settings panel */
              <div className="flex-1 p-4 space-y-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Design Settings</p>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                  <Textarea value={description} onChange={setDescription} rows={2} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Background Color</label>
                  <ColorInput value={settings.bgColor} onChange={(v) => setSettings((s) => ({ ...s, bgColor: v }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Content Background</label>
                  <ColorInput value={settings.contentBgColor} onChange={(v) => setSettings((s) => ({ ...s, contentBgColor: v }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Accent Color</label>
                  <ColorInput value={settings.accentColor} onChange={(v) => setSettings((s) => ({ ...s, accentColor: v }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Max Width</label>
                  <input type="range" min={400} max={800} step={20} value={settings.maxWidth}
                    onChange={(e) => setSettings((s) => ({ ...s, maxWidth: +e.target.value }))}
                    className="w-full accent-indigo-600" />
                  <p className="text-xs text-gray-500 text-right">{settings.maxWidth}px</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Font</label>
                  <Select value={settings.fontFamily}
                    onChange={(v) => setSettings((s) => ({ ...s, fontFamily: v }))}
                    options={[
                      { value: "Arial, sans-serif", label: "Arial" },
                      { value: "Georgia, serif", label: "Georgia" },
                      { value: "'Helvetica Neue', sans-serif", label: "Helvetica Neue" },
                      { value: "Verdana, sans-serif", label: "Verdana" },
                      { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
                    ]}
                  />
                </div>
              </div>
            ) : selectedBlock ? (
              /* Block properties panel */
              <div className="flex-1 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">
                  {selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1)} Block
                </p>
                <BlockEditor block={selectedBlock} onChange={updateBlock} />
              </div>
            ) : (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div>
                  <Settings size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Click a block to edit its properties</p>
                  <p className="text-xs text-gray-300 mt-1">or click Design Settings to change global styles</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline block preview renderer (no iframe, same-origin) ──────────────────

function BlockPreviewRenderer({ block, settings }: { block: Block; settings: TemplateSettings }) {
  const font = settings.fontFamily;

  switch (block.type) {
    case "header": return (
      <div style={{ background: block.bgColor, padding: "28px 32px", textAlign: "center" }}>
        {block.logoUrl && <img src={block.logoUrl} alt="logo" style={{ maxHeight: 40, margin: "0 auto 12px", display: "block" }} />}
        <h2 style={{ margin: 0, fontFamily: font, fontSize: 22, fontWeight: 700, color: block.textColor }}>{block.title || "Header Title"}</h2>
        {block.subtitle && <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 14, color: block.textColor, opacity: 0.85 }}>{block.subtitle}</p>}
      </div>
    );

    case "text": return (
      <div style={{ padding: "10px 32px" }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: block.fontSize, color: block.color, textAlign: block.align, fontWeight: block.bold ? 700 : 400, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {block.content || "Text block"}
        </p>
      </div>
    );

    case "button": return (
      <div style={{ padding: "14px 32px", textAlign: block.align }}>
        <span style={{ display: "inline-block", background: block.bgColor, color: block.textColor, padding: "12px 28px", borderRadius: 8, fontFamily: font, fontSize: 14, fontWeight: 700, width: block.fullWidth ? "100%" : undefined, textAlign: "center", boxSizing: "border-box" }}>
          {block.label || "Button"}
        </span>
      </div>
    );

    case "image": return block.src ? (
      <div style={{ padding: "10px 32px", textAlign: block.align }}>
        <img src={block.src} alt={block.alt} style={{ maxWidth: `${block.width}%`, height: "auto", display: "block", margin: block.align === "center" ? "0 auto" : block.align === "right" ? "0 0 0 auto" : undefined }} />
      </div>
    ) : (
      <div style={{ padding: "10px 32px" }}>
        <div style={{ background: "#f3f4f6", border: "2px dashed #d1d5db", borderRadius: 8, padding: "24px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#9ca3af", fontFamily: font, fontSize: 13 }}>Image URL not set</p>
        </div>
      </div>
    );

    case "divider": return (
      <div style={{ padding: `${block.margin}px 32px` }}>
        <hr style={{ border: "none", borderTop: `${block.thickness}px solid ${block.color}`, margin: 0 }} />
      </div>
    );

    case "spacer": return <div style={{ height: block.height }} />;

    case "footer": return (
      <div style={{ padding: "20px 32px", textAlign: "center" }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: block.fontSize, color: block.color, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {block.content || "Footer text"}
        </p>
      </div>
    );

    default: return null;
  }
}
