"use client";

import { useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  BookOpen, Zap, GitBranch, Code2, KeyRound, Database, Globe,
  Server, FileText, PenLine, Play, ArrowRight, ChevronRight,
  Copy, CheckCheck, Wrench, Link2, ShieldCheck, History,
} from "lucide-react";

// ── Shared components ─────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "text" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group mt-2 mb-3">
      <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
      {lang !== "text" && (
        <span className="absolute top-2.5 left-4 text-xs text-gray-500 font-mono">{lang}</span>
      )}
    </div>
  );
}

function Callout({ type = "info", children }: { type?: "info" | "tip" | "warning"; children: React.ReactNode }) {
  const styles = { info: "bg-blue-50 border-blue-200 text-blue-800", tip: "bg-violet-50 border-violet-200 text-violet-800", warning: "bg-amber-50 border-amber-200 text-amber-800" };
  const labels = { info: "ℹ️ Note", tip: "💡 Tip", warning: "⚠️ Warning" };
  return (
    <div className={`border rounded-xl px-4 py-3 my-3 text-sm ${styles[type]}`}>
      <span className="font-semibold text-xs uppercase tracking-wide block mb-1">{labels[type]}</span>
      {children}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function NodeRow({ name, desc, outputs }: { name: string; desc: string; outputs?: string[] }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-800 font-mono bg-gray-100 px-2 py-0.5 rounded">{name}</span>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      {outputs && (
        <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[200px]">
          {outputs.map((o) => <span key={o} className="text-xs font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{o}</span>)}
        </div>
      )}
    </div>
  );
}

function ApiMethod({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = { GET: "bg-green-100 text-green-700", POST: "bg-blue-100 text-blue-700", DELETE: "bg-red-100 text-red-600", PATCH: "bg-amber-100 text-amber-700" };
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono flex-shrink-0 mt-0.5 ${colors[method] ?? "bg-gray-100 text-gray-600"}`}>{method}</span>
      <div>
        <code className="text-xs font-mono text-gray-800">{path}</code>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ── Sections registry ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview",     label: "Overview",              icon: BookOpen },
  { id: "variables",    label: "Variable Interpolation", icon: Code2 },
  { id: "nodes",        label: "Node Types",             icon: Zap },
  { id: "triggers",     label: "Triggers",               icon: Play },
  { id: "flow",         label: "Flow Control",           icon: GitBranch },
  { id: "secrets",      label: "Secrets",                icon: KeyRound },
  { id: "datastores",   label: "Data Stores",            icon: Database },
  { id: "webhooks",     label: "Webhooks",               icon: Globe },
  { id: "mcp",          label: "MCP Toolbox",            icon: Server },
  { id: "doc-composer", label: "Doc Composer",           icon: FileText },
  { id: "esign",        label: "E-Sign",                 icon: PenLine },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppShell>
      <PageHeader
        title="Help & Docs"
        subtitle="Everything you need to build automations, generate documents, sign contracts, and extend with MCP"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* TOC */}
        <nav className="w-52 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0 py-4 px-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">Contents</p>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors text-left ${activeSection === id ? "bg-violet-50 text-violet-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-10 py-8 max-w-3xl">

          {/* ── OVERVIEW ── */}
          <Section id="overview" title="Overview">
            <p>This platform lets you build visual automation workflows, generate documents from templates, send contracts for e-signature, and expose your scenarios as MCP tools callable by AI agents like Cline.</p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: Play,       label: "1. Add a Trigger",  desc: "Every workflow starts with a trigger — a webhook, schedule, form, or manual button." },
                { icon: ArrowRight, label: "2. Chain Actions",  desc: "Drag action nodes from the sidebar. Connect them in sequence or with conditional branches." },
                { icon: Zap,        label: "3. Run & Monitor",  desc: "Click Run to execute, or activate the workflow for automatic scheduling. View logs in real time." },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center mb-2"><Icon size={16} className="text-violet-600" /></div>
                  <p className="text-xs font-semibold text-gray-800 mb-1">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
            <Callout type="tip">Use the <strong>Templates</strong> page to start from a pre-built workflow instead of building from scratch.</Callout>
          </Section>

          {/* ── VARIABLES ── */}
          <Section id="variables" title="Variable Interpolation">
            <p>Any text field in a node config can reference data from previous nodes using double-curly-brace syntax:</p>
            <CodeBlock lang="template" code={`{{node-id.field}}`} />
            <p>Type <code className="bg-gray-100 px-1 rounded font-mono text-xs">{"{{"}</code> in any field to get an autocomplete dropdown of all upstream variables.</p>

            <Sub title="Examples">
              <CodeBlock lang="examples" code={`{{ai-1.text}}                    # OpenAI/Claude output text
{{http-node.status}}             # HTTP response status
{{http-node.body.user.email}}    # Nested JSON field
{{trigger.email}}                # Form/webhook field
{{trigger.body.order_id}}        # Webhook request body
{{trigger.headers.authorization}} # Request headers
{{now}}    → 2024-01-15T09:30:00Z
{{date}}   → 2024-01-15
{{uuid}}   → a1b2c3d4-...`} />
            </Sub>

            <Sub title="Secret references">
              <CodeBlock lang="template" code={`{{secret.OPENAI_API_KEY}}
{{secret.STRIPE_SECRET_KEY}}`} />
            </Sub>

            <Callout type="warning">Variable paths are case-sensitive. <code className="font-mono text-xs">{"{{trigger.Email}}"}</code> is different from <code className="font-mono text-xs">{"{{trigger.email}}"}</code>.</Callout>
          </Section>

          {/* ── NODE TYPES ── */}
          <Section id="nodes" title="Node Types">
            <p>Nodes are grouped into <strong>Triggers</strong> and <strong>Actions</strong>. Drag them from the left sidebar onto the canvas.</p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-3">
              <NodeRow name="action_openai / action_claude" desc="Chat completion with AI models" outputs={[".text", ".usage.total_tokens"]} />
              <NodeRow name="action_http" desc="HTTP request to any URL" outputs={[".status", ".body", ".headers"]} />
              <NodeRow name="action_qrcode" desc="Generate QR code image" outputs={[".base64", ".svg", ".url"]} />
              <NodeRow name="action_pdf" desc="Generate PDF document" outputs={[".base64", ".pdf_url"]} />
              <NodeRow name="action_sheets" desc="Read/append Google Sheets rows" outputs={[".values", ".rowCount"]} />
              <NodeRow name="action_data_store" desc="Key/value persistent store" outputs={[".value", ".ok", ".key"]} />
              <NodeRow name="action_code" desc="Run custom JavaScript" outputs={[".result", ".output"]} />
              <NodeRow name="action_transform" desc="JSON template mapper" outputs={[".result"]} />
              <NodeRow name="action_iterator" desc="Loop over array items" outputs={[".item", ".index", ".total"]} />
              <NodeRow name="action_csv_parse" desc="Parse CSV string to rows" outputs={[".rows", ".headers", ".rowCount"]} />
              <NodeRow name="action_datetime" desc="Date/time formatting and arithmetic" outputs={[".iso", ".unix", ".formatted"]} />
              <NodeRow name="action_generate_document" desc="Generate DOCX/PDF from a Doc Composer template" outputs={[".document_url", ".document_id", ".file_size"]} />
              <NodeRow name="action_send_esign_template" desc="Send a document for e-signature" outputs={[".request_id", ".status", ".signing_url"]} />
              <NodeRow name="action_mcp_tool" desc="Call a tool on an MCP server" outputs={[".result", ".tool", ".raw_content"]} />
            </div>
          </Section>

          {/* ── TRIGGERS ── */}
          <Section id="triggers" title="Triggers">
            <p>Every workflow must start with exactly one trigger node.</p>
            <div className="space-y-3 mt-2">
              {[
                { name: "Manual Trigger", desc: "Run by clicking the Run button in the editor. Useful for testing.", outputs: [] },
                { name: "Webhook", desc: "Receives HTTP POST/GET requests. A unique URL is auto-generated per workflow.", outputs: ["body", "headers", "method", "query"] },
                { name: "Schedule", desc: "Run on a cron schedule. Use the visual builder for daily, weekly, or custom intervals.", outputs: ["triggered_at"] },
                { name: "Interval", desc: "Run every N minutes/hours/days.", outputs: ["triggered_at"] },
                { name: "Form Submission", desc: "A hosted web form is generated. Configure fields as JSON. On submit, workflow runs.", outputs: ["name", "email", "submitted_at"] },
                { name: "GitHub Event", desc: "Receives GitHub webhook events (push, PR, issues). Verify with a shared secret.", outputs: ["event", "ref", "repository", "sender"] },
                { name: "Stripe Webhook", desc: "Triggers on Stripe payment/subscription events.", outputs: ["type", "id", "customer"] },
              ].map(({ name, desc, outputs }) => (
                <div key={name} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    {outputs.length > 0 && (
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {outputs.map((o) => <span key={o} className="text-xs font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{`{{trigger.${o}}}`}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── FLOW CONTROL ── */}
          <Section id="flow" title="Flow Control">
            <p>Control how data moves through your workflow.</p>
            <div className="space-y-1 mt-2">
              {[
                { name: "If / Else", desc: "Branch based on a condition. Connect the true/false handles to different downstream nodes." },
                { name: "Switch", desc: "Match a field against up to 4 case values and route to the matching branch." },
                { name: "Filter", desc: "Stop execution unless a condition is true. Like an If/Else with no false branch." },
                { name: "Iterator", desc: "Loop over every item in an array. Use {{iterator.item}}, {{iterator.index}}, {{iterator.total}}." },
                { name: "Delay", desc: "Pause execution for N seconds before continuing." },
                { name: "Transform", desc: "Reshape data using a JSON template. Reference any upstream variable inside." },
                { name: "Set / Get Variable", desc: "Store a named value in workflow memory and retrieve it later, even across branches." },
                { name: "Merge", desc: "Wait for all parallel branches to complete, then combine their outputs." },
                { name: "Sub-workflow", desc: "Trigger another saved workflow and receive its output." },
                { name: "Webhook Response", desc: "Send a custom HTTP response back to the webhook caller." },
                { name: "Agent Reply", desc: "Return a text response from the workflow — used as MCP tool output and agent chat replies." },
              ].map(({ name, desc }) => (
                <div key={name} className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <ChevronRight size={14} className="text-violet-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Sub title="Iterator example">
              <CodeBlock lang="config" code={`# Iterator node — Array Path
{{http-node.body.items}}

# Inside downstream nodes, reference the current item:
{{iterator-node.item.name}}
{{iterator-node.item.email}}
{{iterator-node.index}}   → 0, 1, 2, ...
{{iterator-node.total}}   → total items`} />
            </Sub>
          </Section>

          {/* ── SECRETS ── */}
          <Section id="secrets" title="Secrets">
            <p>Store API keys and sensitive values in the <strong>Secrets</strong> page. They are encrypted at rest and never shown in logs or UI.</p>
            <Sub title="Adding a secret">
              <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
                <li>Go to <strong>Secrets</strong> in the sidebar</li>
                <li>Click <strong>Add secret</strong></li>
                <li>Enter a name (e.g. <code className="font-mono bg-gray-100 px-1 rounded">OPENAI_API_KEY</code>) and the value</li>
                <li>Save — the value is write-only and cannot be read back</li>
              </ol>
            </Sub>
            <Sub title="Using secrets in workflows">
              <CodeBlock lang="template" code={`{{secret.OPENAI_API_KEY}}
{{secret.STRIPE_SECRET_KEY}}
{{secret.SMTP_PASSWORD}}`} />
            </Sub>
            <Callout type="info">Secret values are resolved at execution time — they are never stored inside workflow node configs.</Callout>
          </Section>

          {/* ── DATA STORES ── */}
          <Section id="datastores" title="Data Stores">
            <p>Data stores are persistent key-value stores shared across all workflow runs. Use them to track state, cache values, or pass data between separate workflows.</p>
            <Sub title="Data Store node config">
              <CodeBlock lang="config" code={`# Write — store a value
Store name: my-store
Key:  last_run_id
Value: {{trigger.id}}

# Read — retrieve a stored value
Store name: my-store
Key: last_run_id
→ output: {{data-store-node.value}}`} />
            </Sub>
            <p>The <strong>Data Stores</strong> page in the sidebar lets you browse, add, edit, and delete records manually across named stores.</p>
          </Section>

          {/* ── WEBHOOKS ── */}
          <Section id="webhooks" title="Webhooks">
            <p>The <strong>Webhooks</strong> page shows all webhook trigger URLs across all your scenarios — useful when configuring Stripe, GitHub, or other services to call your workflow.</p>
            <Sub title="Webhook URL format">
              <CodeBlock lang="url" code={`POST https://yourapp.com/api/webhook/{workflow-id}

# Query params → {{trigger.query.param_name}}
# Request body  → {{trigger.body.field_name}}
# Headers       → {{trigger.headers.authorization}}`} />
            </Sub>
            <Callout type="tip">Add a <strong>Webhook Response</strong> node to send a custom HTTP response back to the caller — useful for building inline APIs.</Callout>
          </Section>

          {/* ── MCP TOOLBOX ── */}
          <Section id="mcp" title="MCP Toolbox">
            <p>The MCP Toolbox lets you do two things: <strong>connect external MCP servers</strong> (to use their tools inside scenarios), and <strong>build your own hosted MCP server</strong> with your scenarios as callable tools.</p>

            <Sub title="Two server types">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-1">External Server</p>
                  <p className="text-xs text-blue-700">Connect to any MCP server by URL. We auto-discover its tools and make them available as <code className="font-mono bg-blue-100 px-1 rounded">action_mcp_tool</code> nodes in your scenarios.</p>
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-violet-800 mb-1">Hosted Server (My Server)</p>
                  <p className="text-xs text-violet-700">Create your own MCP server. Add scenarios as tools — each scenario becomes a callable tool exposed via SSE and HTTP endpoints.</p>
                </div>
              </div>
            </Sub>

            <Sub title="Connect an external server">
              <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
                <li>Go to <strong>MCP Toolbox</strong> → click <strong>Connect External</strong></li>
                <li>Enter the server name and SSE URL (e.g. <code className="font-mono bg-gray-100 px-1 rounded">https://mcp.example.com/sse</code>)</li>
                <li>Add an auth key if required</li>
                <li>Click <strong>Discover Tools</strong> on the card — tools are cached and shown in the expanded panel</li>
              </ol>
              <Callout type="info">Use the <code className="font-mono text-xs">action_mcp_tool</code> node in your scenario and select the server + tool name to call it.</Callout>
            </Sub>

            <Sub title="Build your own MCP server">
              <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
                <li>Click <strong>New Server</strong> → set a name and slug (e.g. <code className="font-mono bg-gray-100 px-1 rounded">my-crm-tools</code>)</li>
                <li>On the server card, click <strong>Add Tool</strong></li>
                <li>Set a tool name (machine-readable, e.g. <code className="font-mono bg-gray-100 px-1 rounded">create_invoice</code>)</li>
                <li>Define input parameters and link a scenario</li>
                <li>The scenario executes when the tool is called — use <code className="font-mono bg-gray-100 px-1 rounded">{"{{trigger.param_name}}"}</code> inside it</li>
                <li>Add an <strong>Agent Reply</strong> node at the end — its text is returned as the tool result</li>
              </ol>
            </Sub>

            <Sub title="Public endpoints">
              <CodeBlock lang="url" code={`# SSE transport (Cline, Claude Desktop)
GET  https://yourapp.com/api/mcp/hosted/{slug}/sse

# Streamable HTTP transport (modern clients)
POST https://yourapp.com/api/mcp/hosted/{slug}`} />
            </Sub>

            <Sub title="Cline config example">
              <CodeBlock lang="json" code={`{
  "mcpServers": {
    "my-server": {
      "type": "sse",
      "url": "https://yourapp.com/api/mcp/hosted/my-server/sse",
      "headers": {
        "Authorization": "Bearer mcp_your_key_here"
      },
      "disabled": false,
      "timeout": 60
    }
  }
}`} />
            </Sub>

            <Sub title="API key authentication">
              <p>On any hosted server card, click <strong>Add API key authentication</strong> to generate a key. The server will then require <code className="font-mono bg-gray-100 px-1 rounded text-xs">Authorization: Bearer &lt;key&gt;</code> on every connection.</p>
            </Sub>

            <Sub title="Execution history">
              <div className="flex gap-3 py-2 text-xs text-gray-600">
                <History size={14} className="text-violet-500 flex-shrink-0 mt-0.5" />
                <span>Every tool call is logged. Expand a server card and click the <strong>History</strong> tab to see tool name, inputs, output, status, duration, and transport for each execution.</span>
              </div>
            </Sub>
          </Section>

          {/* ── DOC COMPOSER ── */}
          <Section id="doc-composer" title="Doc Composer">
            <p>Doc Composer lets you upload Word (.docx) templates with merge field syntax, then generate filled documents (DOCX or PDF) by passing data — from the UI, a workflow node, or the REST API.</p>

            <Sub title="Upload a template">
              <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
                <li>Go to <strong>Doc Composer</strong> in the sidebar</li>
                <li>Click <strong>New Template</strong> and upload a <code className="font-mono bg-gray-100 px-1 rounded">.docx</code> file</li>
                <li>The platform detects all merge fields automatically</li>
                <li>Use the <strong>Test & Preview</strong> tab to fill fields and generate a live preview</li>
              </ol>
              <Callout type="tip">Use Microsoft Word or LibreOffice to author templates. All merge fields use single curly braces <code className="font-mono text-xs bg-violet-50 px-1 rounded">{"{ }"}</code> — different from the double-brace workflow syntax.</Callout>
            </Sub>

            <Sub title="Field syntax">
              <CodeBlock lang="docx-template" code={`{field_name}                   simple field
{customer.address.city}        dot-notation nested path
{amount | currency}            with formatter
{amount | currency:EUR}        formatter with option
{amount | currency | default:0} chained formatters`} />
            </Sub>

            <Sub title="Formatters">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-xs">
                {[
                  ["currency", "currency:USD", "{amount | currency:EUR}", "$1,234.56"],
                  ["number", "number:2", "{count | number:0}", "1,234"],
                  ["percent", "percent:1", "{rate | percent:2}", "12.50%"],
                  ["date", "date:MM/DD/YYYY", "{dob | date}", "January 15, 2024"],
                  ["datetime", "datetime", "{ts | datetime}", "January 15, 2024 9:30 AM"],
                  ["uppercase", "uppercase", "{name | uppercase}", "JOHN DOE"],
                  ["lowercase", "lowercase", "{name | lowercase}", "john doe"],
                  ["capitalize", "capitalize", "{name | capitalize}", "John doe"],
                  ["titlecase", "titlecase", "{name | titlecase}", "John Doe"],
                  ["truncate", "truncate:50", "{bio | truncate:80}", "First 80 chars…"],
                  ["yesno", "yesno", "{active | yesno}", "Yes / No"],
                  ["checkmark", "checkmark", "{done | checkmark}", "✓ / ✗"],
                  ["phone", "phone", "{mobile | phone}", "(555) 123-4567"],
                  ["default", "default:N/A", "{field | default:None}", "value or fallback"],
                ].map(([name, syntax, example, output]) => (
                  <div key={name} className="grid grid-cols-4 gap-2 py-2 px-3 border-b border-gray-100 last:border-0">
                    <code className="font-mono text-violet-700">{name}</code>
                    <code className="font-mono text-gray-500 text-xs">{syntax}</code>
                    <code className="font-mono text-gray-600 text-xs">{example}</code>
                    <span className="text-gray-500 text-xs">{output}</span>
                  </div>
                ))}
              </div>
            </Sub>

            <Sub title="Loops (arrays)">
              <CodeBlock lang="docx-template" code={`{#items}
  {items.name}    {items.qty}    {items.price | currency}
{/items}

# Simple value array (use {.} for current item)
{#tags}{.}  {/tags}

# Nested loop
{#orders}
  Order {orders.id}
  {#orders.lines}{orders.lines.product}{/orders.lines}
{/orders}`} />
            </Sub>

            <Sub title="Conditionals">
              <CodeBlock lang="docx-template" code={`{#is_premium}This content shows only for premium users.{/is_premium}

{^is_premium}Free tier — upgrade to unlock this.{/is_premium}

# If/else pattern
{#paid}Payment received.{/paid}{^paid}Awaiting payment.{/paid}`} />
            </Sub>

            <Sub title="Image fields">
              <CodeBlock lang="docx-template" code={`# In your template, use % prefix for image fields:
{%logo}
{%signature_image}

# Pass as base64 data URI or HTTPS URL in your data:
{
  "logo": "data:image/png;base64,iVBORw0K...",
  "signature_image": "https://cdn.example.com/sig.png"
}`} />
              <Callout type="info">PNG dimensions are auto-detected from the image header. JPEG/GIF/WEBP default to 300×200 px.</Callout>
            </Sub>

            <Sub title="Generate via workflow node">
              <p>Add an <code className="font-mono bg-gray-100 px-1 rounded text-xs">action_generate_document</code> node:</p>
              <CodeBlock lang="config" code={`Template:     select from dropdown
Merge Data:   {"customer": "{{trigger.name}}", "amount": {{trigger.total}}}
Output Name:  Invoice-{{trigger.id}}
Format:       docx  (or pdf)

# Outputs:
{{generate-doc-node.document_url}}   # signed download URL (1 hour)
{{generate-doc-node.document_id}}    # generated_docs record id
{{generate-doc-node.file_size}}      # bytes`} />
            </Sub>

            <Sub title="REST API">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <ApiMethod method="GET"  path="/api/doc-templates"                    desc="List all templates for your org" />
                <ApiMethod method="POST" path="/api/doc-templates"                    desc="Create a new template record (upload file separately)" />
                <ApiMethod method="POST" path="/api/doc-templates/{id}/generate"      desc="Generate a document — body: { data, format?, output_name?, preview? }" />
                <ApiMethod method="GET"  path="/api/doc-templates/{id}/fields"        desc="Return detected merge fields from the uploaded DOCX" />
                <ApiMethod method="GET"  path="/api/doc-templates/{id}/history"       desc="List previously generated documents" />
                <ApiMethod method="GET"  path="/api/v1/documents/generate"            desc="Public API (Bearer token) — same as generate above" />
              </div>
              <CodeBlock lang="json" code={`// POST /api/doc-templates/{id}/generate
{
  "data": {
    "customer_name": "Acme Corp",
    "invoice_date": "2024-01-15",
    "items": [
      { "name": "Widget A", "qty": 3, "price": 29.99 }
    ],
    "total": 89.97
  },
  "format": "pdf",
  "output_name": "Invoice-001",
  "preview": false
}`} />
            </Sub>
          </Section>

          {/* ── E-SIGN ── */}
          <Section id="esign" title="E-Sign">
            <p>Send PDF documents to one or more signers programmatically. Signers receive a link to view and sign in the browser — no account required.</p>

            <Sub title="How it works">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: "1", label: "Upload document", desc: "Upload a PDF to the Documents page to create a signing template with field placements." },
                  { step: "2", label: "Send via API / workflow", desc: "Call the send endpoint with signer details. Each signer gets a unique signing link by email." },
                  { step: "3", label: "Receive callback", desc: "When all signers complete, your callback_url is called with the final status and signed document." },
                ].map(({ step, label, desc }) => (
                  <div key={step} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="w-7 h-7 bg-violet-600 text-white rounded-lg flex items-center justify-center text-xs font-bold mb-2">{step}</div>
                    <p className="text-xs font-semibold text-gray-800 mb-1">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
            </Sub>

            <Sub title="Authentication">
              <p>All API requests require your org API key in the header:</p>
              <CodeBlock lang="http" code={`X-API-Key: sk_live_your_key_here
# or
Authorization: Bearer sk_live_your_key_here`} />
              <p>Generate API keys from the <strong>API Keys</strong> page in the sidebar.</p>
            </Sub>

            <Sub title="Send for signature">
              <ApiMethod method="POST" path="/api/v1/esign/send" desc="Send a document to one or more signers" />
              <CodeBlock lang="json" code={`{
  "document_id": "uuid-of-your-document",
  "signers": [
    {
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "role": "buyer",
      "order": 1
    },
    {
      "name": "Bob Smith",
      "email": "bob@example.com",
      "role": "seller",
      "order": 2
    }
  ],
  "callback_url": "https://yourapp.com/webhooks/esign",
  "metadata": {
    "contract_id": "CTR-001"
  }
}`} />
              <Callout type="info">Signers with the same <code className="font-mono text-xs bg-blue-50 px-1 rounded">order</code> value sign in parallel. Different order values create a sequential signing flow.</Callout>
            </Sub>

            <Sub title="Workflow node">
              <p>Add an <code className="font-mono bg-gray-100 px-1 rounded text-xs">action_send_esign_template</code> node in your scenario:</p>
              <CodeBlock lang="config" code={`Document:     select from dropdown
Signer Name:  {{trigger.customer_name}}
Signer Email: {{trigger.customer_email}}
Callback URL: https://yourapp.com/api/webhook/{{workflow-id}}

# Outputs:
{{esign-node.request_id}}    # signing request ID
{{esign-node.status}}        # pending / signed / declined
{{esign-node.signing_url}}   # direct link to signing page`} />
            </Sub>

            <Sub title="Callback payload">
              <p>When signing is complete your <code className="font-mono bg-gray-100 px-1 rounded text-xs">callback_url</code> receives a POST:</p>
              <CodeBlock lang="json" code={`{
  "event": "esign.completed",
  "request_id": "uuid",
  "status": "signed",
  "signed_at": "2024-01-15T10:22:00Z",
  "signers": [
    { "email": "alice@example.com", "signed_at": "2024-01-15T10:22:00Z" }
  ],
  "metadata": { "contract_id": "CTR-001" }
}`} />
            </Sub>

            <Sub title="E-Sign API reference">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <ApiMethod method="POST"   path="/api/v1/esign/send"              desc="Send document for signature" />
                <ApiMethod method="GET"    path="/api/v1/esign/status/{token}"    desc="Get signing request status" />
                <ApiMethod method="GET"    path="/api/esign/sign/{token}"         desc="Public signing page (no auth needed)" />
                <ApiMethod method="GET"    path="/api/esign/documents"            desc="List your e-sign documents" />
              </div>
            </Sub>

            <Callout type="warning">Documents must be uploaded as PDF and have signature fields placed before sending. Use the <strong>E-Sign</strong> page in the sidebar to manage documents and field placement.</Callout>
          </Section>

        </main>
      </div>
    </AppShell>
  );
}
