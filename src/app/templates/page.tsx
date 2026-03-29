"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Search,
  Plus,
  Loader2,
  Zap,
  Mail,
  MessageSquare,
  Database,
  Bot,
  Globe,
  Clock,
  FileText,
  BarChart3,
  Shield,
  RefreshCw,
  Slack,
  Star,
} from "lucide-react";

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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  AI: Bot,
  Email: Mail,
  Messaging: MessageSquare,
  Database,
  Webhook: Globe,
  Scheduling: Clock,
  Documents: FileText,
  Analytics: BarChart3,
  Security: Shield,
  Sync: RefreshCw,
};

const TEMPLATES: Template[] = [
  {
    id: "chatgpt-slack",
    name: "ChatGPT-Powered Slack Bot",
    description: "Receive messages in Slack, send them to ChatGPT and post the AI response back automatically",
    category: "AI",
    icons: ["MessageSquare", "Bot"],
    usedCount: 38096,
    featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Slack Event", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_openai", label: "ChatGPT", config: { model: "gpt-4o-mini", prompt: "{{trigger.text}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_slack", label: "Reply to Slack", config: { message: "{{n2.text}}" }, status: "idle" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3", animated: true },
    ],
  },
  {
    id: "webhook-to-sheets",
    name: "Save webhook data to Google Sheets",
    description: "Every time your webhook receives data, append a new row to a Google Spreadsheet",
    category: "Webhook",
    icons: ["Globe", "Database"],
    usedCount: 39037,
    featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Webhook", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_sheets", label: "Append to Sheets", config: { values: '[[\"{{trigger.name}}\",\"{{trigger.email}}\",\"{{trigger.message}}\"]]', range: "Sheet1!A1" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "chatgpt-sheets",
    name: "Generate ChatGPT completions from Google Sheets rows",
    description: "Run a GPT prompt for each row in a Google Sheet and write the AI output back",
    category: "AI",
    icons: ["Database", "Bot"],
    usedCount: 105317,
    featured: true,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_schedule", label: "Daily Schedule", config: { cron: "0 9 * * *" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_openai", label: "ChatGPT", config: { model: "gpt-4o-mini", prompt: "Summarise: {{trigger.row}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_sheets", label: "Write result", config: {}, status: "idle" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3", animated: true },
    ],
  },
  {
    id: "email-to-sheets",
    name: "Add new emails to Google Sheets",
    description: "When an inbound email arrives, parse it and append the data to a spreadsheet",
    category: "Email",
    icons: ["Mail", "Database"],
    usedCount: 22038,
    featured: true,
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
    category: "Email",
    icons: ["FileText", "Mail"],
    usedCount: 18500,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_form", label: "Form Submission", config: { title: "Contact Us", fields: JSON.stringify([{ name: "name", type: "text", label: "Name", required: true }, { name: "email", type: "email", label: "Email", required: true }, { name: "message", type: "textarea", label: "Message" }]) }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_sendgrid", label: "Send Thank-you Email", config: { to: "{{trigger.email}}", subject: "Thanks {{trigger.name}}!", body: "<p>Hi {{trigger.name}},</p><p>Thanks for reaching out. We'll get back to you shortly.</p>" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "rss-to-slack",
    name: "Monitor RSS feed and notify Slack",
    description: "Poll an RSS feed every 15 minutes and post new articles to a Slack channel",
    category: "Messaging",
    icons: ["Globe", "MessageSquare"],
    usedCount: 15200,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_rss_poll", label: "RSS Poll", config: { url: "https://feeds.example.com/rss", cron: "*/15 * * * *" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_slack", label: "Post to Slack", config: { message: "*{{trigger.title}}*\n{{trigger.description}}\n{{trigger.link}}" }, status: "idle" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", animated: true }],
  },
  {
    id: "github-to-jira",
    name: "Sync GitHub Issues to Jira",
    description: "When a new GitHub issue is created, automatically create a matching Jira ticket",
    category: "Sync",
    icons: ["Globe", "Database"],
    usedCount: 12800,
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
    category: "Email",
    icons: ["Shield", "Mail"],
    usedCount: 9400,
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
    category: "Scheduling",
    icons: ["Clock", "Bot", "Mail"],
    usedCount: 8200,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_schedule", label: "Daily 8am", config: { cron: "0 8 * * *" }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_supabase_db", label: "Fetch data", config: { action: "select", table: "orders", limit: "100" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_claude", label: "Summarise with Claude", config: { model: "claude-haiku-4-5-20251001", prompt: "Summarise these orders as a brief daily report: {{n2.rows}}" }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 200 }, data: { type: "action_email", label: "Email Report", config: { subject: "Daily Report – {{_system.date}}", body: "{{n3.text}}" }, status: "idle" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3", animated: true },
      { id: "e3", source: "n3", target: "n4", animated: true },
    ],
  },
  {
    id: "ai-content-moderation",
    name: "AI content moderation pipeline",
    description: "Receive user content via webhook, moderate it with OpenAI, then approve or reject",
    category: "AI",
    icons: ["Globe", "Bot", "Shield"],
    usedCount: 6300,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Content submitted", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_openai", label: "Moderate", config: { model: "gpt-4o-mini", prompt: "Classify this content as SAFE or UNSAFE. Reply with only that one word.\n\n{{trigger.content}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_if_else", label: "Is it safe?", config: { field: "n2.text", operator: "contains", value: "SAFE" }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 100 }, data: { type: "action_supabase_db", label: "Approve content", config: { action: "update", table: "posts", data: '{"status":"approved"}' }, status: "idle" } },
      { id: "n5", type: "workflowNode", position: { x: 900, y: 300 }, data: { type: "action_supabase_db", label: "Flag content", config: { action: "update", table: "posts", data: '{"status":"flagged"}' }, status: "idle" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3", animated: true },
      { id: "e3", source: "n3", target: "n4", animated: true },
      { id: "e4", source: "n3", target: "n5", animated: true },
    ],
  },
  {
    id: "qr-pdf",
    name: "Generate QR code PDF on demand",
    description: "Accept a URL via webhook, generate a QR code, embed it in a PDF and return a public link",
    category: "Documents",
    icons: ["Globe", "FileText"],
    usedCount: 4100,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_webhook", label: "Receive URL", config: {}, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_qrcode", label: "Generate QR", config: { text: "{{trigger.url}}", format: "png", width: "400" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_pdf", label: "Build PDF", config: { title: "QR Code", content: "Scan to visit: {{trigger.url}}", image_base64: "{{n2.base64}}", image_width: "300" }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 200 }, data: { type: "action_webhook_response", label: "Return PDF URL", config: { status: "200", body: '{"pdf_url":"{{n3.pdf_url}}"}' }, status: "idle" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3", animated: true },
      { id: "e3", source: "n3", target: "n4", animated: true },
    ],
  },
  {
    id: "lead-scoring",
    name: "AI lead scoring and CRM entry",
    description: "Score inbound leads with Claude, add high-score leads to HubSpot, notify sales team on Slack",
    category: "AI",
    icons: ["Globe", "Bot", "Database", "MessageSquare"],
    usedCount: 3600,
    nodes: [
      { id: "n1", type: "workflowNode", position: { x: 0, y: 200 }, data: { type: "trigger_form", label: "Lead Form", config: { title: "Get a demo", fields: JSON.stringify([{ name: "name", type: "text", label: "Name", required: true }, { name: "email", type: "email", label: "Work email", required: true }, { name: "company", type: "text", label: "Company", required: true }, { name: "size", type: "select", label: "Company size", options: ["1-10", "11-50", "51-200", "200+"] }]) }, status: "idle" } },
      { id: "n2", type: "workflowNode", position: { x: 300, y: 200 }, data: { type: "action_claude", label: "Score lead", config: { model: "claude-haiku-4-5-20251001", prompt: "Score this lead 1-10 based on company size and reply ONLY with the number.\nName: {{trigger.name}}\nCompany: {{trigger.company}}\nSize: {{trigger.size}}" }, status: "idle" } },
      { id: "n3", type: "workflowNode", position: { x: 600, y: 200 }, data: { type: "action_hubspot", label: "Create HubSpot Contact", config: { action: "create_contact", properties: '{"email":"{{trigger.email}}","firstname":"{{trigger.name}}","company":"{{trigger.company}}"}' }, status: "idle" } },
      { id: "n4", type: "workflowNode", position: { x: 900, y: 200 }, data: { type: "action_slack", label: "Notify sales", config: { message: "New lead: *{{trigger.name}}* from {{trigger.company}} (score: {{n2.text}})" }, status: "idle" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3", animated: true },
      { id: "e3", source: "n3", target: "n4", animated: true },
    ],
  },
];

const CATEGORIES = ["All", "AI", "Email", "Messaging", "Webhook", "Scheduling", "Documents", "Sync", "Analytics", "Security"];

function NodeIcons({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <div key={i} className="w-9 h-9 rounded-full border-2 border-white bg-violet-100 flex items-center justify-center -ml-2 first:ml-0 shadow-sm">
          <Zap size={12} className="text-violet-600" />
        </div>
      ))}
      {count > 4 && (
        <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center -ml-2 shadow-sm">
          <span className="text-[9px] text-gray-500 font-bold">+{count - 4}</span>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [creating, setCreating] = useState<string | null>(null);

  const filtered = TEMPLATES.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || t.category === category;
    return matchSearch && matchCat;
  });

  const featured = filtered.filter((t) => t.featured);
  const rest = filtered.filter((t) => !t.featured);

  const useTemplate = async (t: Template) => {
    setCreating(t.id);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: t.name,
        description: t.description,
        nodes: t.nodes,
        edges: t.edges,
      }),
    });
    const data = await res.json();
    setCreating(null);
    if (data.id) router.push(`/workflows/${data.id}`);
  };

  return (
    <AppShell>
      <PageHeader
        title="Templates"
        subtitle="Start faster with pre-built automation templates"
        action={
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> New scenario
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {/* Search + categories */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  category === cat
                    ? "bg-violet-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Star size={14} className="text-amber-400 fill-amber-400" />
              <h2 className="text-sm font-semibold text-gray-700">Featured</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={useTemplate} creating={creating === t.id} />
              ))}
            </div>
          </section>
        )}

        {/* All others */}
        {rest.length > 0 && (
          <section>
            {featured.length > 0 && <h2 className="text-sm font-semibold text-gray-700 mb-4">All templates</h2>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={useTemplate} creating={creating === t.id} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">
            No templates found for "{search}"
          </div>
        )}
      </main>
    </AppShell>
  );
}

function TemplateCard({
  template: t,
  onUse,
  creating,
}: {
  template: Template;
  onUse: (t: Template) => void;
  creating: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-violet-200 transition-all flex flex-col">
      <NodeIcons count={t.nodes.length} />
      <h3 className="text-sm font-semibold text-gray-900 mt-3 mb-1.5 line-clamp-2">{t.name}</h3>
      <p className="text-xs text-gray-500 flex-1 line-clamp-2 mb-4">{t.description}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[10px] text-gray-400">
          Used {t.usedCount.toLocaleString()} times
        </span>
        <button
          onClick={() => onUse(t)}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Use template
        </button>
      </div>
    </div>
  );
}
