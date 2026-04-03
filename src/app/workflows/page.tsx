"use client";

import { useEffect, useState, Suspense } from "react";
import { useAutoTour } from "@/components/AppTour";
import { PAGE_TOURS } from "@/lib/tours";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Plus, Search, Zap, PlayCircle, PauseCircle, Trash2, Loader2,
  Clock, Sparkles, AlertCircle, Star, Layers,
  Mail, MessageSquare, Database, Bot, Globe, FileText, BarChart3, Shield, RefreshCw,
  Download, Upload, FileDown,
} from "lucide-react";
import { useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workflow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  folder?: string | null;
  tags?: string[];
  nodes?: object[];
  edges?: object[];
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icons: string[];
  usedCount: number;
  featured?: boolean;
  nodes: object[];
  edges: object[];
}

// ─── Template data ─────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: "chatgpt-slack",
    name: "ChatGPT-Powered Slack Bot",
    description: "Receive messages in Slack, send them to ChatGPT and post the AI response back automatically",
    category: "AI", icons: ["MessageSquare", "Bot"], usedCount: 38096, featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Slack Event", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_openai", label: "ChatGPT", config: { model: "gpt-4o-mini", prompt: "{{trigger.text}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_slack", label: "Reply to Slack", config: { message: "{{n2.text}}" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }, { id: "e2", source: "n2", target: "n3", animated: true }],
  },
  {
    id: "webhook-to-sheets",
    name: "Save webhook data to Google Sheets",
    description: "Every time your webhook receives data, append a new row to a Google Spreadsheet",
    category: "Webhook", icons: ["Globe", "Database"], usedCount: 39037, featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Webhook", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_sheets", label: "Append to Sheets", config: { values: '[[\"{{trigger.name}}\",\"{{trigger.email}}\"]]', range: "Sheet1!A1" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "chatgpt-sheets",
    name: "Generate ChatGPT completions from Google Sheets",
    description: "Run a GPT prompt for each row in a Google Sheet and write the AI output back",
    category: "AI", icons: ["Database", "Bot"], usedCount: 105317, featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_schedule", label: "Daily Schedule", config: { cron: "0 9 * * *" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_openai", label: "ChatGPT", config: { model: "gpt-4o-mini", prompt: "Summarise: {{trigger.row}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_sheets", label: "Write result", config: {}, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }, { id: "e2", source: "n2", target: "n3", animated: true }],
  },
  {
    id: "email-to-sheets",
    name: "Add new emails to Google Sheets",
    description: "When an inbound email arrives, parse it and append the data to a spreadsheet",
    category: "Email", icons: ["Mail", "Database"], usedCount: 22038, featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_email_inbound", label: "Inbound Email", config: { provider: "sendgrid" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_sheets", label: "Append to Sheets", config: {}, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "form-to-email",
    name: "Auto-respond to form submissions",
    description: "When someone submits your form, send them a personalised thank-you email via SendGrid",
    category: "Email", icons: ["FileText", "Mail"], usedCount: 18500,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_form", label: "Form Submission", config: { title: "Contact Us" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_sendgrid", label: "Send Thank-you Email", config: { to: "{{trigger.email}}", subject: "Thanks {{trigger.name}}!", body: "<p>Hi {{trigger.name}},</p><p>Thanks for reaching out!</p>" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "rss-to-slack",
    name: "Monitor RSS feed and notify Slack",
    description: "Poll an RSS feed every 15 minutes and post new articles to a Slack channel",
    category: "Messaging", icons: ["Globe", "MessageSquare"], usedCount: 15200,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_rss_poll", label: "RSS Poll", config: { url: "https://feeds.example.com/rss", cron: "*/15 * * * *" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_slack", label: "Post to Slack", config: { message: "*{{trigger.title}}*\n{{trigger.link}}" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "github-to-jira",
    name: "Sync GitHub Issues to Jira",
    description: "When a new GitHub issue is created, automatically create a matching Jira ticket",
    category: "Sync", icons: ["Globe", "Database"], usedCount: 12800,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "GitHub Webhook", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_jira", label: "Create Jira Issue", config: { action: "create_issue", summary: "{{trigger.issue.title}}", description: "{{trigger.issue.body}}" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "stripe-to-mailchimp",
    name: "Stripe payment → Mailchimp subscriber",
    description: "When a Stripe payment succeeds, add the customer to your Mailchimp audience",
    category: "Email", icons: ["Shield", "Mail"], usedCount: 9400,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_stripe", label: "Payment Succeeded", config: { event_type: "payment_intent.succeeded" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_mailchimp", label: "Add to Mailchimp", config: { status: "subscribed", email: "{{trigger.customer_email}}" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "daily-report",
    name: "Daily summary email report",
    description: "Every morning, query your database, format results with Claude AI, and email a summary report",
    category: "Scheduling", icons: ["Clock", "Bot", "Mail"], usedCount: 8200,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_schedule", label: "Daily 8am", config: { cron: "0 8 * * *" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_supabase_db", label: "Fetch data", config: { action: "select", table: "orders", limit: "100" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_claude", label: "Summarise with Claude", config: { model: "claude-haiku-4-5-20251001", prompt: "Summarise these orders as a daily report: {{n2.rows}}" }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 200 }, data: { type: "action_email", label: "Email Report", config: { subject: "Daily Report", body: "{{n3.text}}" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }, { id: "e2", source: "n2", target: "n3", animated: true }, { id: "e3", source: "n3", target: "n4", animated: true }],
  },
  {
    id: "ai-content-moderation",
    name: "AI content moderation pipeline",
    description: "Receive user content via webhook, moderate it with OpenAI, then approve or reject",
    category: "AI", icons: ["Globe", "Bot", "Shield"], usedCount: 6300,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Content submitted", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_openai", label: "Moderate", config: { model: "gpt-4o-mini", prompt: "Classify as SAFE or UNSAFE:\n\n{{trigger.content}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_if_else", label: "Is it safe?", config: { field: "n2.text", operator: "contains", value: "SAFE" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }, { id: "e2", source: "n2", target: "n3", animated: true }],
  },
  {
    id: "qr-pdf",
    name: "Generate QR code PDF on demand",
    description: "Accept a URL via webhook, generate a QR code, embed it in a PDF and return a public link",
    category: "Documents", icons: ["Globe", "FileText"], usedCount: 4100,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Receive URL", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_qrcode", label: "Generate QR", config: { text: "{{trigger.url}}", format: "png", width: "400" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_pdf", label: "Build PDF", config: { title: "QR Code", content: "Scan to visit: {{trigger.url}}", image_base64: "{{n2.base64}}" }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 200 }, data: { type: "action_webhook_response", label: "Return PDF URL", config: { status: "200", body: '{"pdf_url":"{{n3.pdf_url}}"}' }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }, { id: "e2", source: "n2", target: "n3", animated: true }, { id: "e3", source: "n3", target: "n4", animated: true }],
  },
  {
    id: "lead-scoring",
    name: "AI lead scoring and CRM entry",
    description: "Score inbound leads with Claude, add high-score leads to HubSpot, notify sales on Slack",
    category: "AI", icons: ["Globe", "Bot", "Database", "MessageSquare"], usedCount: 3600,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_form", label: "Lead Form", config: { title: "Get a demo" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_claude", label: "Score lead", config: { model: "claude-haiku-4-5-20251001", prompt: "Score this lead 1-10 based on company size. Reply ONLY with the number.\nName: {{trigger.name}}\nCompany: {{trigger.company}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_hubspot", label: "Create HubSpot Contact", config: { action: "create_contact", properties: '{"email":"{{trigger.email}}","firstname":"{{trigger.name}}"}' }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 200 }, data: { type: "action_slack", label: "Notify sales", config: { message: "New lead: *{{trigger.name}}* (score: {{n2.text}})" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }, { id: "e2", source: "n2", target: "n3", animated: true }, { id: "e3", source: "n3", target: "n4", animated: true }],
  },
];

const TEMPLATE_CATEGORIES = ["All", "AI", "Email", "Messaging", "Webhook", "Scheduling", "Documents", "Sync", "Analytics", "Security"];
const EXAMPLE_PROMPTS = [
  "Webhook → save to table → send email",
  "Daily report from API → Slack notification",
  "Form submission → CRM + confirmation email",
  "New lead → AI qualify → notify sales",
];

// Suppress unused import warnings — icons are referenced by name in template data
void [Mail, MessageSquare, Database, Bot, Globe, FileText, BarChart3, Shield, RefreshCw];

// ─── Template card ─────────────────────────────────────────────────────────────

function NodeDots({ count }: { count: number }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-violet-100 flex items-center justify-center -ml-1.5 first:ml-0 shadow-sm">
          <Zap size={10} className="text-violet-600" />
        </div>
      ))}
      {count > 4 && (
        <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center -ml-1.5 shadow-sm">
          <span className="text-[8px] text-gray-500 font-bold">+{count - 4}</span>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ t, onUse, loading }: { t: Template; onUse: (t: Template) => void; loading: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-violet-200 transition-all flex flex-col">
      <NodeDots count={t.nodes.length} />
      <h3 className="text-sm font-semibold text-gray-900 mt-3 mb-1.5 line-clamp-2">{t.name}</h3>
      <p className="text-xs text-gray-500 flex-1 line-clamp-2 mb-4">{t.description}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-xs text-gray-400">Used {t.usedCount.toLocaleString()}×</span>
        <button
          onClick={() => onUse(t)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Use template
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function WorkflowsPageInner() {
  useAutoTour(PAGE_TOURS["/workflows"].steps, PAGE_TOURS["/workflows"].key);
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"scenarios" | "templates">(
    params.get("tab") === "templates" ? "templates" : "scenarios"
  );

  // Scenarios state
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  // Templates state
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("All");
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workflows")
      .then(r => r.json())
      .then(d => setWorkflows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const allFolders = [...new Set(workflows.map((w) => w.folder).filter(Boolean))] as string[];

  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = folderFilter === null || w.folder === folderFilter;
    return matchesSearch && matchesFolder;
  });

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearch.toLowerCase());
    const matchCat = templateCategory === "All" || t.category === templateCategory;
    return matchSearch && matchCat;
  });
  const featuredTemplates = filteredTemplates.filter(t => t.featured);
  const restTemplates = filteredTemplates.filter(t => !t.featured);

  async function setWorkflowFolder(id: string, folder: string | null) {
    await fetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
    setWorkflows((ws) => ws.map((w) => w.id === id ? { ...w, folder } : w));
  }

  async function addTag(id: string, tag: string) {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const existing = wf.tags ?? [];
    if (existing.includes(tag)) return;
    const tags = [...existing, tag];
    await fetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setWorkflows((ws) => ws.map((w) => w.id === id ? { ...w, tags } : w));
  }

  async function removeTag(id: string, tag: string) {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const tags = (wf.tags ?? []).filter((t) => t !== tag);
    await fetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setWorkflows((ws) => ws.map((w) => w.id === id ? { ...w, tags } : w));
  }

  function handleExport(w: Workflow, e: React.MouseEvent) {
    e.stopPropagation();
    const payload = { name: w.name, nodes: w.nodes ?? [], edges: w.edges ?? [] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${w.name.replace(/[^a-z0-9]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { name?: string; nodes?: object[]; edges?: object[] };
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name ? `${data.name} (imported)` : "Imported Scenario",
          nodes: data.nodes ?? [],
          edges: data.edges ?? [],
        }),
      });
      if (res.ok) {
        const wf = await res.json() as { id: string };
        router.push(`/workflows/${wf.id}`);
      }
    } catch {
      // malformed JSON — silently ignore, user sees nothing happened
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Scenario", nodes: [], edges: [] }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/workflows/${id}`);
    } else {
      const json = await res.json().catch(() => ({}));
      setCreateError(json.error ?? "Failed to create scenario");
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setAiError("");
    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      router.push(`/workflows/${data.id}`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  };

  const toggleActive = async (w: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/workflows/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !w.is_active }),
    });
    setWorkflows(prev => prev.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleDelete = async (w: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${w.name}"?`)) return;
    await fetch(`/api/workflows/${w.id}`, { method: "DELETE" });
    setWorkflows(prev => prev.filter(x => x.id !== w.id));
  };

  const useTemplate = async (t: Template) => {
    setUsingTemplate(t.id);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: t.name, description: t.description, nodes: t.nodes, edges: t.edges }),
    });
    const data = await res.json();
    setUsingTemplate(null);
    if (data.id) router.push(`/workflows/${data.id}`);
  };

  const switchTab = (t: "scenarios" | "templates") => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "templates") url.searchParams.set("tab", "templates");
    else url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AppShell>
      <PageHeader
        title="Scenarios"
        subtitle="Build and manage your automation workflows"
        action={
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <button
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
              >
                <FileDown size={14} /> Import
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                New Scenario
              </button>
            </div>
            {createError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle size={12} /> {createError}
              </p>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-gray-100 bg-white">
        <button
          onClick={() => switchTab("scenarios")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            tab === "scenarios"
              ? "border-violet-600 text-violet-700 bg-violet-50"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Zap size={14} />
          My Scenarios
          {workflows.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
              {workflows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab("templates")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            tab === "templates"
              ? "border-violet-600 text-violet-700 bg-violet-50"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Layers size={14} />
          Templates
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
            {TEMPLATES.length}
          </span>
        </button>
      </div>

      {/* ── My Scenarios tab ── */}
      {tab === "scenarios" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Folder sidebar */}
          {allFolders.length > 0 && (
            <div className="w-44 border-r border-gray-100 bg-gray-50/50 flex-shrink-0 overflow-y-auto p-3 space-y-0.5">
              <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Folders</p>
              <button
                onClick={() => setFolderFilter(null)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                  folderFilter === null ? "bg-violet-50 text-violet-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                All Scenarios
                <span className="ml-auto text-xs text-gray-400">{workflows.length}</span>
              </button>
              {allFolders.map((f) => (
                <button
                  key={f}
                  onClick={() => setFolderFilter(f === folderFilter ? null : f)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                    folderFilter === f ? "bg-violet-50 text-violet-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  📁 {f}
                  <span className="ml-auto text-xs text-gray-400">
                    {workflows.filter((w) => w.folder === f).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Build with AI */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-violet-200" />
              <h2 className="text-sm font-bold">Build with AI</h2>
            </div>
            <p className="text-xs text-violet-200 mb-4">
              Describe your automation in plain English and AI will generate the workflow — nodes, connections, and logic.
            </p>
            <div className="flex gap-2 mb-3">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                placeholder="e.g. When a webhook is received, save the data to my table and send a Slack notification..."
                rows={2}
                className="flex-1 text-sm bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 placeholder-violet-300 text-white outline-none focus:bg-white/20 resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !aiPrompt.trim()}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white text-violet-700 text-sm font-semibold rounded-xl hover:bg-violet-50 transition-colors disabled:opacity-50 self-start"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => setAiPrompt(p)}
                  className="text-xs bg-white/15 hover:bg-white/25 text-violet-100 px-3 py-1 rounded-full transition-all border border-white/10"
                >
                  {p}
                </button>
              ))}
            </div>
            {aiError && (
              <p className="mt-3 text-xs text-red-300 flex items-center gap-1.5">
                <AlertCircle size={12} /> {aiError}
              </p>
            )}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search scenarios..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading...
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <Zap size={28} className="text-gray-200" />
              <p className="font-medium text-gray-500">
                {search ? "No scenarios match your search" : "No scenarios yet — create one above or pick a template"}
              </p>
              {!search && (
                <button
                  onClick={() => switchTab("templates")}
                  className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Layers size={12} /> Browse templates
                </button>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-4">
                Your Scenarios
                <span className="ml-2 text-xs font-medium text-gray-400">({filteredWorkflows.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWorkflows.map(w => (
                  <div
                    key={w.id}
                    onClick={() => router.push(`/workflows/${w.id}`)}
                    className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed22, #ec489922)" }}>
                        <Zap size={17} className="text-violet-600" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => toggleActive(w, e)}
                          title={w.is_active ? "Deactivate" : "Activate"}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {w.is_active
                            ? <PauseCircle size={15} className="text-amber-500" />
                            : <PlayCircle size={15} className="text-green-500" />}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingTagsId(w.id); setTagInput(""); }}
                          title="Add tag"
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-xs text-gray-400 font-bold"
                        >
                          #
                        </button>
                        <button
                          onClick={e => handleExport(w, e)}
                          title="Export as JSON"
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Download size={15} className="text-gray-400" />
                        </button>
                        <button
                          onClick={e => handleDelete(w, e)}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{w.name}</h3>
                    {/* Tags */}
                    {(w.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2" onClick={e => e.stopPropagation()}>
                        {(w.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-0.5 text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full"
                          >
                            {tag}
                            <button onClick={() => removeTag(w.id, tag)} className="hover:text-red-500 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        w.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${w.is_active ? "bg-green-400" : "bg-gray-300"}`} />
                        {w.is_active ? "Active" : "Inactive"}
                      </span>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {/* Folder picker */}
                        <select
                          value={w.folder ?? ""}
                          onChange={e => {
                            if (e.target.value === "__new__") {
                              const name = prompt("Folder name:");
                              if (name?.trim()) setWorkflowFolder(w.id, name.trim());
                            } else {
                              setWorkflowFolder(w.id, e.target.value || null);
                            }
                          }}
                          className="text-xs text-gray-400 border-none bg-transparent outline-none cursor-pointer hover:text-gray-600"
                          title="Assign folder"
                        >
                          <option value="">No folder</option>
                          {allFolders.map(f => <option key={f} value={f}>{f}</option>)}
                          <option value="__new__">+ New folder…</option>
                        </select>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={9} />
                          {new Date(w.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {/* Tag input — shown when editing tags for this card */}
                    {editingTagsId === w.id && (
                      <div className="mt-2" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              addTag(w.id, tagInput.trim());
                              setTagInput("");
                            }
                            if (e.key === "Escape") setEditingTagsId(null);
                          }}
                          onBlur={() => { setEditingTagsId(null); setTagInput(""); }}
                          placeholder="Type a tag and press Enter"
                          className="w-full text-xs border border-violet-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>{/* end main content */}
        </div>
      )}

      {/* ── Templates tab ── */}
      {tab === "templates" && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search + categories */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    templateCategory === cat
                      ? "bg-violet-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              No templates found for &ldquo;{templateSearch}&rdquo;
            </div>
          ) : (
            <>
              {featuredTemplates.length > 0 && (
                <section className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <h2 className="text-sm font-semibold text-gray-700">Featured</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {featuredTemplates.map(t => (
                      <TemplateCard key={t.id} t={t} onUse={useTemplate} loading={usingTemplate === t.id} />
                    ))}
                  </div>
                </section>
              )}
              {restTemplates.length > 0 && (
                <section>
                  {featuredTemplates.length > 0 && (
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">All templates</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {restTemplates.map(t => (
                      <TemplateCard key={t.id} t={t} onUse={useTemplate} loading={usingTemplate === t.id} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

export default function WorkflowsPage() {
  return (
    <Suspense>
      <WorkflowsPageInner />
    </Suspense>
  );
}
