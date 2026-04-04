"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Save, Eye, Loader2, Trash2, GripVertical,
  ChevronDown, ChevronUp, Type, MousePointer, Minus,
  Image as ImageIcon, Mail, Variable, Copy, Send, X, Check, Monitor, Smartphone,
  Settings2, Palette, Layout, AlignLeft, Braces, Zap,
} from "lucide-react";
import {
  Block, TemplateSettings, DEFAULT_SETTINGS,
  BLOCK_DEFAULTS, renderTemplateHtml, renderTemplatePlain,
} from "@/lib/emailTemplateRenderer";

const TemplatePreview = dynamic(() => import("@/components/EmailTemplatePreview"), { ssr: false });

type BlockWithId = Block & { _id: string };
function uid() { return Math.random().toString(36).slice(2, 10); }

const BLOCK_PALETTE = [
  { type: "header",  icon: Layout,        label: "Header",  desc: "Logo & title",      color: "bg-violet-50 text-violet-600 border-violet-100" },
  { type: "text",    icon: Type,          label: "Text",    desc: "Paragraph content", color: "bg-blue-50 text-blue-600 border-blue-100" },
  { type: "button",  icon: MousePointer,  label: "Button",  desc: "CTA link button",   color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { type: "image",   icon: ImageIcon,     label: "Image",   desc: "Photo or banner",   color: "bg-orange-50 text-orange-600 border-orange-100" },
  { type: "divider", icon: Minus,         label: "Divider", desc: "Horizontal rule",   color: "bg-gray-50 text-gray-500 border-gray-100" },
  { type: "spacer",  icon: AlignLeft,     label: "Spacer",  desc: "Empty space",       color: "bg-gray-50 text-gray-400 border-gray-100" },
  { type: "footer",  icon: AlignLeft,     label: "Footer",  desc: "Copyright & links", color: "bg-slate-50 text-slate-500 border-slate-100" },
];

const CATEGORIES = ["custom", "esign", "workflow"];

const ESIGN_VARS = [
  { key: "signer_name",    label: "Signer Name" },
  { key: "signer_email",   label: "Signer Email" },
  { key: "document_title", label: "Document Title" },
  { key: "signing_url",    label: "Signing URL" },
  { key: "sender_name",    label: "Sender Name" },
  { key: "org_name",       label: "Organization" },
];

const WORKFLOW_VARS = [
  { key: "workflow_name", label: "Workflow Name" },
  { key: "org_name",      label: "Organization" },
  { key: "trigger_data",  label: "Trigger Data" },
];

// ── Shared form primitives ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{children}</p>;
}

function Inp({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white" />
  );
}

function Txta({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea value={value} rows={rows} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white" />
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        <div className="w-8 h-8 rounded-lg border-2 border-white shadow-md ring-1 ring-gray-200 cursor-pointer"
          style={{ backgroundColor: value }} />
      </div>
      <Inp value={value} onChange={onChange} placeholder="#000000" />
    </div>
  );
}

function Sel({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Slider({ value, onChange, min, max, unit = "px" }: {
  value: number; onChange: (v: number) => void; min: number; max: number; unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
        className="w-full accent-indigo-600 h-1.5 cursor-pointer" />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-300">{min}{unit}</span>
        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{value}{unit}</span>
        <span className="text-[10px] text-gray-300">{max}{unit}</span>
      </div>
    </div>
  );
}

function AlignButtons({ value, onChange }: { value: string; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <div className="flex rounded-xl border border-gray-200 overflow-hidden">
      {(["left", "center", "right"] as const).map(a => (
        <button key={a} onClick={() => onChange(a)}
          className={`flex-1 py-1.5 text-xs font-semibold capitalize transition-colors ${value === a ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          {a}
        </button>
      ))}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ── Block editor ───────────────────────────────────────────────────────────

function BlockEditor({ block, onChange }: { block: BlockWithId; onChange: (b: Block) => void }) {
  const up = (patch: Partial<Block>) => onChange({ ...block, ...patch } as Block);

  const blockIcon = BLOCK_PALETTE.find(p => p.type === block.type);

  return (
    <div className="space-y-4">
      {/* Block type badge */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${blockIcon?.color ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>
        {blockIcon && <blockIcon.icon size={11} />}
        {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block
      </div>

      {block.type === "header" && (
        <>
          <div><Label>Title</Label><Inp value={block.title} onChange={v => up({ title: v })} placeholder="Your Company Name" /></div>
          <div><Label>Subtitle</Label><Inp value={block.subtitle} onChange={v => up({ subtitle: v })} placeholder="Tagline or description" /></div>
          <div><Label>Logo URL</Label><Inp value={block.logoUrl} onChange={v => up({ logoUrl: v })} placeholder="https://..." /></div>
          <SectionDivider label="Colors" />
          <div><Label>Background</Label><ColorPicker value={block.bgColor} onChange={v => up({ bgColor: v })} /></div>
          <div><Label>Text Color</Label><ColorPicker value={block.textColor} onChange={v => up({ textColor: v })} /></div>
        </>
      )}

      {block.type === "text" && (
        <>
          <div>
            <Label>Content</Label>
            <Txta value={block.content} onChange={v => up({ content: v })} rows={6} />
            <p className="text-[10px] text-indigo-400 mt-1.5 flex items-center gap-1"><Braces size={10} />Use {"{{variable}}"} for dynamic values</p>
          </div>
          <SectionDivider label="Style" />
          <div><Label>Font Size</Label><Slider value={block.fontSize} onChange={v => up({ fontSize: v })} min={11} max={28} /></div>
          <div><Label>Color</Label><ColorPicker value={block.color} onChange={v => up({ color: v })} /></div>
          <div><Label>Alignment</Label><AlignButtons value={block.align} onChange={v => up({ align: v })} /></div>
          <div>
            <Label>Weight</Label>
            <button onClick={() => up({ bold: !block.bold })}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-colors ${block.bold ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              Bold
            </button>
          </div>
        </>
      )}

      {block.type === "button" && (
        <>
          <div><Label>Label</Label><Inp value={block.label} onChange={v => up({ label: v })} placeholder="Click Here" /></div>
          <div>
            <Label>URL</Label>
            <Inp value={block.url} onChange={v => up({ url: v })} placeholder="https:// or {{signing_url}}" />
          </div>
          <div><Label>Alignment</Label><AlignButtons value={block.align} onChange={v => up({ align: v })} /></div>
          <SectionDivider label="Style" />
          <div><Label>Button Color</Label><ColorPicker value={block.bgColor} onChange={v => up({ bgColor: v })} /></div>
          <div><Label>Text Color</Label><ColorPicker value={block.textColor} onChange={v => up({ textColor: v })} /></div>
          <div>
            <Label>Width</Label>
            <button onClick={() => up({ fullWidth: !block.fullWidth })}
              className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${block.fullWidth ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {block.fullWidth ? "Full Width ✓" : "Auto Width"}
            </button>
          </div>
        </>
      )}

      {block.type === "image" && (
        <>
          <div><Label>Image URL</Label><Inp value={block.src} onChange={v => up({ src: v })} placeholder="https://..." /></div>
          <div><Label>Alt Text</Label><Inp value={block.alt} onChange={v => up({ alt: v })} /></div>
          <div><Label>Link URL</Label><Inp value={block.linkUrl} onChange={v => up({ linkUrl: v })} placeholder="https://..." /></div>
          <SectionDivider label="Layout" />
          <div><Label>Width</Label><Slider value={block.width} onChange={v => up({ width: v })} min={20} max={100} unit="%" /></div>
          <div><Label>Alignment</Label><AlignButtons value={block.align} onChange={v => up({ align: v })} /></div>
        </>
      )}

      {block.type === "divider" && (
        <>
          <div><Label>Color</Label><ColorPicker value={block.color} onChange={v => up({ color: v })} /></div>
          <div><Label>Thickness</Label><Slider value={block.thickness} onChange={v => up({ thickness: v })} min={1} max={8} /></div>
          <div><Label>Margin</Label><Slider value={block.margin} onChange={v => up({ margin: v })} min={8} max={64} /></div>
        </>
      )}

      {block.type === "spacer" && (
        <div><Label>Height</Label><Slider value={block.height} onChange={v => up({ height: v })} min={8} max={120} /></div>
      )}

      {block.type === "footer" && (
        <>
          <div><Label>Content</Label><Txta value={block.content} onChange={v => up({ content: v })} rows={3} /></div>
          <SectionDivider label="Style" />
          <div><Label>Color</Label><ColorPicker value={block.color} onChange={v => up({ color: v })} /></div>
          <div><Label>Font Size</Label><Slider value={block.fontSize} onChange={v => up({ fontSize: v })} min={10} max={16} /></div>
        </>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

type RightPanel = "block" | "design" | "variables";

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
  const [rightPanel, setRightPanel] = useState<RightPanel>("block");
  const [showTest, setShowTest]   = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg]     = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/email-templates/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.name)     setName(d.name);
        if (d.description) setDescription(d.description);
        if (d.category) setCategory(d.category);
        if (d.subject)  setSubject(d.subject);
        if (d.settings && Object.keys(d.settings).length) setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
        if (Array.isArray(d.blocks)) setBlocks(d.blocks.map((b: Block) => ({ ...b, _id: uid() })));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const selectedBlock = blocks.find(b => b._id === selectedId) ?? null;

  const addBlock = (type: string) => {
    const def = BLOCK_DEFAULTS[type];
    if (!def) return;
    const nb: BlockWithId = { ...def, _id: uid() } as BlockWithId;
    setBlocks(prev => [...prev, nb]);
    setSelectedId(nb._id);
    setRightPanel("block");
  };

  const updateBlock = useCallback((updated: Block) => {
    setBlocks(prev => prev.map(b => b._id === selectedId ? { ...updated, _id: b._id } as BlockWithId : b));
  }, [selectedId]);

  const deleteBlock = (bid: string) => {
    setBlocks(prev => prev.filter(b => b._id !== bid));
    if (selectedId === bid) setSelectedId(null);
  };

  const duplicateBlock = (bid: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b._id === bid);
      if (idx === -1) return prev;
      const { _id: _, ...rest } = prev[idx];
      const copy: BlockWithId = { ...rest, _id: uid() } as BlockWithId;
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setSelectedId(copy._id);
      return next;
    });
  };

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    setBlocks(prev => {
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

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true); setTestMsg("");
    try {
      const res = await fetch(`/api/email-templates/${id}/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const d = await res.json();
      setTestMsg(res.ok ? "Test email sent!" : (d.error ?? "Failed to send"));
    } catch { setTestMsg("Failed to send"); }
    finally { setTestSending(false); }
  };

  const save = async () => {
    setSaving(true);
    const rawBlocks = blocks.map(({ _id: _, ...rest }) => rest);
    const html = renderTemplateHtml(rawBlocks as Block[], settings);
    const plain = renderTemplatePlain(rawBlocks as Block[]);
    const varKeys = [...html.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)].map(m => m[1]);
    const unique = [...new Set(varKeys)].map(k => ({ key: k, label: k.replace(/_/g, " ") }));
    await fetch(`/api/email-templates/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, category, subject, blocks: rawBlocks, settings, html_body: html, plain_body: plain, variables: unique }),
    });
    setSaving(false); setSaveOk(true);
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
    <div className="h-screen bg-[#f5f5f7] flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center gap-3 px-4 flex-shrink-0 shadow-sm z-30">
        <button onClick={() => router.push("/email-templates")}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="w-px h-4 bg-gray-200" />

        {/* Template name */}
        <input value={name} onChange={e => setName(e.target.value)}
          className="text-sm font-semibold text-gray-800 bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-400 px-1 py-0.5 min-w-[160px] max-w-[260px]" />

        {/* Category */}
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-400 text-gray-600 font-medium capitalize">
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowTest(v => !v); setTestMsg(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${showTest ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <Send size={12} /> Test
          </button>

          <button onClick={() => setPreview(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${preview ? "bg-gray-800 text-white border-gray-800 shadow-sm" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <Eye size={12} /> {preview ? "Edit" : "Preview"}
          </button>

          <button onClick={save} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 ${saveOk ? "bg-green-500" : "bg-indigo-600 hover:bg-indigo-700"}`}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : saveOk ? <Check size={12} /> : <Save size={12} />}
            {saveOk ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Test email bar ── */}
      {showTest && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
          <Zap size={13} className="text-emerald-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-700">Send test to:</span>
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
            placeholder="you@example.com" onKeyDown={e => e.key === "Enter" && sendTest()}
            className="flex-1 max-w-xs border border-emerald-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
          <button onClick={sendTest} disabled={testSending || !testEmail.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {testSending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Send
          </button>
          {testMsg && <span className={`text-xs font-medium ${testMsg.includes("sent") ? "text-emerald-600" : "text-red-500"}`}>{testMsg}</span>}
          <button onClick={() => setShowTest(false)} className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60 transition-colors"><X size={13} /></button>
        </div>
      )}

      {preview ? (
        /* ── Preview mode ── */
        <div className="flex-1 overflow-auto bg-[#f5f5f7] p-8 flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-6 bg-white border border-gray-200 rounded-xl p-1 shadow-sm self-center">
            <button onClick={() => setMobilePreview(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!mobilePreview ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              <Monitor size={12} /> Desktop
            </button>
            <button onClick={() => setMobilePreview(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mobilePreview ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              <Smartphone size={12} /> Mobile
            </button>
          </div>

          <div className={`w-full transition-all duration-300 ${mobilePreview ? "max-w-[390px]" : "max-w-[640px]"}`}>
            {/* Email client frame */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-400 w-12">FROM</span>
                    <span className="text-xs text-gray-600">Your App &lt;noreply@yourapp.com&gt;</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-400 w-12">SUBJECT</span>
                    <span className="text-xs font-semibold text-gray-800">{subject || "(no subject)"}</span>
                  </div>
                </div>
              </div>
              <TemplatePreview html={previewHtml} />
            </div>
          </div>
        </div>
      ) : (
        /* ── Editor mode ── */
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Block palette ── */}
          <div className="w-52 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Add Blocks</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {BLOCK_PALETTE.map(({ type, icon: Icon, label, desc, color }) => (
                <button key={type} onClick={() => addBlock(type)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group text-left border border-transparent hover:border-gray-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 group-hover:text-gray-900">{label}</p>
                    <p className="text-[10px] text-gray-400 truncate">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Center: Canvas ── */}
          <div className="flex-1 overflow-auto p-6" onClick={() => setSelectedId(null)}>
            {/* Subject */}
            <div className="max-w-[600px] mx-auto mb-4">
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex-shrink-0">Subject</span>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Enter your email subject line..."
                  className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder:text-gray-300" />
                <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] text-gray-400 font-bold">···</span>
                </div>
              </div>
            </div>

            {/* Email body */}
            <div className="max-w-[600px] mx-auto">
              <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200/80"
                style={{ backgroundColor: settings.bgColor }}>
                <div className="mx-auto" style={{ backgroundColor: settings.contentBgColor, maxWidth: settings.maxWidth }}>
                  {blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-28 px-6 text-center">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
                        <Mail size={24} className="text-indigo-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-400 mb-1">Your email is empty</p>
                      <p className="text-xs text-gray-300">Add blocks from the left panel to start building</p>
                    </div>
                  ) : (
                    blocks.map((block, i) => (
                      <div key={block._id}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragEnter={() => handleDragEnter(i)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => e.preventDefault()}
                        onClick={e => { e.stopPropagation(); setSelectedId(block._id); setRightPanel("block"); }}
                        className={`relative group cursor-pointer transition-all ${selectedId === block._id ? "ring-2 ring-indigo-500 ring-inset" : "hover:ring-1 hover:ring-indigo-200 hover:ring-inset"}`}
                      >
                        {/* Block toolbar */}
                        <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                            <button className="p-1.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors" title="Drag to reorder">
                              <GripVertical size={12} />
                            </button>
                            <div className="w-px h-4 bg-gray-100" />
                            <button onClick={e => { e.stopPropagation(); moveBlock(i, i - 1); }} disabled={i === 0}
                              className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                              <ChevronUp size={12} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); moveBlock(i, i + 1); }} disabled={i === blocks.length - 1}
                              className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                              <ChevronDown size={12} />
                            </button>
                            <div className="w-px h-4 bg-gray-100" />
                            <button onClick={e => { e.stopPropagation(); duplicateBlock(block._id); }}
                              className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Duplicate">
                              <Copy size={12} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteBlock(block._id); }}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Selected indicator */}
                        {selectedId === block._id && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 z-10" />
                        )}

                        <BlockPreviewRenderer block={block} settings={settings} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Properties ── */}
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {([
                { id: "block",     icon: Layout,    label: "Block" },
                { id: "design",    icon: Palette,   label: "Design" },
                { id: "variables", icon: Variable,  label: "Vars" },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setRightPanel(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold border-b-2 transition-colors ${rightPanel === tab.id ? "border-indigo-600 text-indigo-600 bg-indigo-50/40" : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
                  <tab.icon size={12} /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Block properties */}
              {rightPanel === "block" && (
                selectedBlock ? (
                  <div className="p-4">
                    <BlockEditor block={selectedBlock} onChange={updateBlock} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center mb-3">
                      <Settings2 size={20} className="text-gray-300" />
                    </div>
                    <p className="text-xs font-semibold text-gray-400 mb-1">No block selected</p>
                    <p className="text-[11px] text-gray-300">Click any block on the canvas to edit its properties</p>
                  </div>
                )
              )}

              {/* Design settings */}
              {rightPanel === "design" && (
                <div className="p-4 space-y-4">
                  <div><Label>Description</Label><Txta value={description} onChange={setDescription} rows={2} /></div>
                  <SectionDivider label="Colors" />
                  <div><Label>Page Background</Label><ColorPicker value={settings.bgColor} onChange={v => setSettings(s => ({ ...s, bgColor: v }))} /></div>
                  <div><Label>Email Background</Label><ColorPicker value={settings.contentBgColor} onChange={v => setSettings(s => ({ ...s, contentBgColor: v }))} /></div>
                  <div><Label>Accent Color</Label><ColorPicker value={settings.accentColor} onChange={v => setSettings(s => ({ ...s, accentColor: v }))} /></div>
                  <SectionDivider label="Layout" />
                  <div><Label>Max Width</Label><Slider value={settings.maxWidth} onChange={v => setSettings(s => ({ ...s, maxWidth: v }))} min={400} max={800} /></div>
                  <SectionDivider label="Typography" />
                  <div>
                    <Label>Font Family</Label>
                    <Sel value={settings.fontFamily} onChange={v => setSettings(s => ({ ...s, fontFamily: v }))}
                      options={[
                        { value: "Arial, sans-serif",              label: "Arial" },
                        { value: "Georgia, serif",                  label: "Georgia" },
                        { value: "'Helvetica Neue', sans-serif",    label: "Helvetica Neue" },
                        { value: "Verdana, sans-serif",            label: "Verdana" },
                        { value: "'Trebuchet MS', sans-serif",     label: "Trebuchet MS" },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Variables */}
              {rightPanel === "variables" && (
                <div className="p-4">
                  <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">Click to copy. Paste into any text field or button URL.</p>
                  <div className="space-y-1.5">
                    {varList.map(v => (
                      <button key={v.key} onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group text-left">
                        <div>
                          <p className="text-xs font-bold text-gray-700 group-hover:text-indigo-700 font-mono">{`{{${v.key}}}`}</p>
                          <p className="text-[10px] text-gray-400">{v.label}</p>
                        </div>
                        <Copy size={11} className="text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline block preview renderer ──────────────────────────────────────────

function BlockPreviewRenderer({ block, settings }: { block: Block; settings: TemplateSettings }) {
  const font = settings.fontFamily;

  switch (block.type) {
    case "header": return (
      <div style={{ background: block.bgColor, padding: "28px 32px", textAlign: "center" }}>
        {block.logoUrl && <img src={block.logoUrl} alt="logo" style={{ maxHeight: 40, margin: "0 auto 12px", display: "block" }} />}
        <h2 style={{ margin: 0, fontFamily: font, fontSize: 22, fontWeight: 700, color: block.textColor }}>{block.title || "Your Company Name"}</h2>
        {block.subtitle && <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 14, color: block.textColor, opacity: 0.85 }}>{block.subtitle}</p>}
      </div>
    );

    case "text": return (
      <div style={{ padding: "10px 32px" }}>
        <p style={{ margin: 0, fontFamily: font, fontSize: block.fontSize, color: block.color, textAlign: block.align, fontWeight: block.bold ? 700 : 400, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {block.content || "Write your message here. Use {{variable}} to insert dynamic content."}
        </p>
      </div>
    );

    case "button": return (
      <div style={{ padding: "14px 32px", textAlign: block.align }}>
        <span style={{ display: "inline-block", background: block.bgColor, color: block.textColor, padding: "12px 28px", borderRadius: 8, fontFamily: font, fontSize: 14, fontWeight: 700, width: block.fullWidth ? "100%" : undefined, textAlign: "center", boxSizing: "border-box" }}>
          {block.label || "Click Here"}
        </span>
      </div>
    );

    case "image": return block.src ? (
      <div style={{ padding: "10px 32px", textAlign: block.align }}>
        <img src={block.src} alt={block.alt} style={{ maxWidth: `${block.width}%`, height: "auto", display: "block", margin: block.align === "center" ? "0 auto" : block.align === "right" ? "0 0 0 auto" : undefined }} />
      </div>
    ) : (
      <div style={{ padding: "10px 32px" }}>
        <div style={{ background: "#f9fafb", border: "2px dashed #e5e7eb", borderRadius: 10, padding: "28px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#9ca3af", fontFamily: font, fontSize: 12 }}>Image URL not set</p>
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
          {block.content || "© 2025 Your Company. All rights reserved."}
        </p>
      </div>
    );

    default: return null;
  }
}
