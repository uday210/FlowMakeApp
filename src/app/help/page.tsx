"use client";

import { useState } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  BookOpen,
  Zap,
  GitBranch,
  Code2,
  KeyRound,
  Database,
  Globe,
  Plug,
  ChevronRight,
  Copy,
  CheckCheck,
  Play,
  ArrowRight,
} from "lucide-react";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "variables", label: "Variable Interpolation", icon: Code2 },
  { id: "nodes", label: "Node Types", icon: Zap },
  { id: "triggers", label: "Triggers", icon: Play },
  { id: "flow", label: "Flow Control", icon: GitBranch },
  { id: "secrets", label: "Secrets", icon: KeyRound },
  { id: "datastores", label: "Data Stores", icon: Database },
  { id: "webhooks", label: "Webhooks", icon: Globe },
  { id: "mcp", label: "MCP Toolboxes", icon: Plug },
];

function CodeBlock({ code, lang = "text" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group mt-2 mb-3">
      <pre className={`text-xs font-mono bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto leading-relaxed`}>
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
      {lang !== "text" && (
        <span className="absolute top-2.5 left-4 text-[10px] text-gray-500 font-mono">{lang}</span>
      )}
    </div>
  );
}

function Callout({ type = "info", children }: { type?: "info" | "tip" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    tip: "bg-violet-50 border-violet-200 text-violet-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
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
    <section id={id} className="mb-12">
      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
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
        <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[180px]">
          {outputs.map((o) => (
            <span key={o} className="text-[10px] font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{o}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppShell>
      <PageHeader
        title="Documentation"
        subtitle="Learn how to build powerful automations with this platform"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* TOC sidebar */}
        <nav className="w-52 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0 py-4 px-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">Contents</p>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors text-left ${
                activeSection === id
                  ? "bg-violet-50 text-violet-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-10 py-8 max-w-3xl">

          <Section id="overview" title="Overview">
            <p>
              This platform lets you build visual automation workflows — connect triggers to actions,
              pass data between steps, and run logic without writing backend code.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: Play, label: "1. Add a Trigger", desc: "Every workflow starts with a trigger — a webhook, schedule, form, or manual button." },
                { icon: ArrowRight, label: "2. Chain Actions", desc: "Drag action nodes from the sidebar. Connect them in sequence or with conditional branches." },
                { icon: Zap, label: "3. Run & Monitor", desc: "Click Run to execute, or activate the workflow for automatic scheduling. View logs in real time." },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center mb-2">
                    <Icon size={16} className="text-violet-600" />
                  </div>
                  <p className="text-xs font-semibold text-gray-800 mb-1">{label}</p>
                  <p className="text-[11px] text-gray-500">{desc}</p>
                </div>
              ))}
            </div>

            <Callout type="tip">
              Use the <strong>Templates</strong> page to start from a pre-built workflow instead of building from scratch.
            </Callout>
          </Section>

          <Section id="variables" title="Variable Interpolation">
            <p>
              Any text field in a node config can reference data from previous nodes using double-curly-brace syntax:
            </p>

            <CodeBlock lang="template" code={`{{node-id.field}}`} />

            <p>
              When you&apos;re editing a node config and type <code className="bg-gray-100 px-1 rounded font-mono text-xs">{"{{"}  </code>,
              a dropdown appears with all available variables from upstream nodes. Use <kbd className="border border-gray-300 rounded px-1 text-[10px]">↑↓</kbd> to navigate,
              <kbd className="border border-gray-300 rounded px-1 text-[10px] ml-1">Enter</kbd> or <kbd className="border border-gray-300 rounded px-1 text-[10px] ml-1">Tab</kbd> to insert.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Examples</h3>

            <CodeBlock lang="examples" code={`# Use the text from an OpenAI node labelled "ai-1"
{{ai-1.text}}

# Use the HTTP response status
{{http-node.status}}

# QR code base64 image data
{{qr-node.base64}}

# Form submission email field
{{trigger.email}}

# Webhook request body
{{trigger.body}}

# Built-in helpers
{{now}}    → 2024-01-15T09:30:00Z
{{date}}   → 2024-01-15
{{uuid}}   → a1b2c3d4-...`} />

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Nested fields with dot notation</h3>
            <p>Access nested objects using dot notation:</p>
            <CodeBlock lang="template" code={`{{http-node.body.user.email}}
{{openai-node.usage.total_tokens}}
{{trigger.headers.authorization}}`} />

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Mixing variables with static text</h3>
            <CodeBlock lang="template" code={`Hello {{trigger.name}}, your order #{{shopify.id}} is confirmed!

Subject: AI Summary for {{date}}`} />

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Secret references</h3>
            <CodeBlock lang="template" code={`# Reference a stored secret by name
{{secret.OPENAI_API_KEY}}
{{secret.STRIPE_SECRET}}`} />

            <Callout type="warning">
              Variable paths are case-sensitive. <code className="font-mono text-xs">{"{{trigger.Email}}"}</code> is different from <code className="font-mono text-xs">{"{{trigger.email}}"}</code>.
            </Callout>
          </Section>

          <Section id="nodes" title="Node Types">
            <p>Nodes are grouped into <strong>Triggers</strong> and <strong>Actions</strong>. Drag them from the left sidebar onto the canvas.</p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Common outputs by category</h3>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <NodeRow name="action_openai / action_claude" desc="Chat completion" outputs={[".text", ".usage.total_tokens"]} />
              <NodeRow name="action_http" desc="HTTP request to any URL" outputs={[".status", ".body", ".headers"]} />
              <NodeRow name="action_qrcode" desc="Generate QR code image" outputs={[".base64", ".svg", ".url"]} />
              <NodeRow name="action_pdf" desc="Generate PDF document" outputs={[".base64", ".pdf_url"]} />
              <NodeRow name="action_sheets" desc="Read/append Google Sheets" outputs={[".values", ".rowCount"]} />
              <NodeRow name="action_data_store" desc="Key/value store read/write" outputs={[".value", ".ok", ".key"]} />
              <NodeRow name="action_code" desc="Run custom JavaScript" outputs={[".result", ".output"]} />
              <NodeRow name="action_transform" desc="JSON template mapper" outputs={[".result"]} />
              <NodeRow name="action_iterator" desc="Loop over array items" outputs={[".item", ".index", ".total"]} />
              <NodeRow name="action_csv_parse" desc="Parse CSV string" outputs={[".rows", ".headers", ".rowCount"]} />
              <NodeRow name="action_datetime" desc="Date/time formatting" outputs={[".iso", ".unix", ".formatted"]} />
            </div>
          </Section>

          <Section id="triggers" title="Triggers">
            <p>Every workflow must start with exactly one trigger node.</p>

            <div className="space-y-3 mt-2">
              {[
                { name: "Manual Trigger", desc: "Run the workflow by clicking the Run button in the editor. Useful for testing.", outputs: [] },
                { name: "Webhook", desc: "Receives HTTP POST/GET requests. A unique URL is auto-generated for each workflow.", outputs: ["body", "headers", "method", "query"] },
                { name: "Schedule", desc: "Run on a cron schedule. Use the visual cron builder to set daily, weekly, or custom intervals.", outputs: ["triggered_at"] },
                { name: "Interval", desc: "Run every N minutes/hours/days.", outputs: ["triggered_at"] },
                { name: "Form Submission", desc: "A hosted web form is generated. Configure fields as JSON. On submit, the workflow runs.", outputs: ["name", "email", "message", "submitted_at"] },
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
                        {outputs.map((o) => (
                          <span key={o} className="text-[10px] font-mono bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{`{{trigger.${o}}}`}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="flow" title="Flow Control">
            <p>Control how data moves through your workflow.</p>

            <div className="space-y-3 mt-2">
              {[
                { name: "If / Else", desc: "Branch based on a condition. Connect the true/false handles to different downstream nodes." },
                { name: "Switch", desc: "Match a field against up to 4 case values and route to the matching branch." },
                { name: "Filter", desc: "Stop execution unless a condition is true. Like an If/Else with no false branch." },
                { name: "Iterator", desc: "Loop over every item in an array. Downstream nodes run once per item. Use {{iterator.item}} and {{iterator.index}}." },
                { name: "Delay", desc: "Pause execution for N seconds before continuing." },
                { name: "Transform", desc: "Reshape data using a JSON template. Reference any upstream variable inside the template." },
                { name: "Set Variable / Get Variable", desc: "Store a named value in workflow memory and retrieve it later, even after branches." },
                { name: "Merge", desc: "Wait for all incoming parallel branches to complete, then combine their outputs." },
                { name: "Sub-workflow", desc: "Trigger another saved workflow and receive its output." },
                { name: "Webhook Response", desc: "Send a custom HTTP response back to the webhook caller. Must come after a Webhook trigger." },
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

            <h3 className="text-sm font-semibold text-gray-800 mt-6 mb-2">Iterator example</h3>
            <CodeBlock lang="config" code={`# Iterator node — Array Path
{{http-node.body.items}}

# Inside downstream nodes, reference the current item:
{{iterator-node.item.name}}
{{iterator-node.item.email}}
{{iterator-node.index}}   → 0, 1, 2, ...
{{iterator-node.total}}   → total items`} />
          </Section>

          <Section id="secrets" title="Secrets">
            <p>
              Store API keys and sensitive values in the <strong>Secrets</strong> page (sidebar). They are stored encrypted
              and never exposed in logs or UI — only the name is shown.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Adding a secret</h3>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
              <li>Go to <strong>Secrets</strong> in the sidebar</li>
              <li>Click <strong>Add secret</strong></li>
              <li>Enter a name (e.g. <code className="font-mono bg-gray-100 px-1 rounded">OPENAI_API_KEY</code>) and the value</li>
              <li>Click Save — the value is write-only and cannot be retrieved</li>
            </ol>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Using secrets in workflows</h3>
            <CodeBlock lang="template" code={`# In any config field, reference a secret by name:
{{secret.OPENAI_API_KEY}}
{{secret.STRIPE_SECRET_KEY}}
{{secret.SMTP_PASSWORD}}`} />

            <Callout type="info">
              Secret values are resolved at execution time — they are never stored in workflow config.
            </Callout>
          </Section>

          <Section id="datastores" title="Data Stores">
            <p>
              Data stores are persistent key-value stores shared across all workflow runs.
              Use them to track state, cache values, or pass data between separate workflows.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Using the Data Store node</h3>
            <p>Add an <strong>action_data_store</strong> node to read or write values:</p>
            <CodeBlock lang="config" code={`# Write operation — store a value
Store name: my-store
Key:  last_run_id
Value: {{trigger.id}}

# Read operation — retrieve a stored value
Store name: my-store
Key: last_run_id
→ {{data-store-node.value}}`} />

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Managing from the UI</h3>
            <p>The <strong>Data stores</strong> page in the sidebar lets you browse, add, edit, and delete records manually across named stores.</p>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p>
              The <strong>Webhooks</strong> page shows all webhook trigger URLs across all your scenarios — useful when you need to
              configure a third-party service (Stripe, GitHub, etc.) to call your workflow.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Webhook trigger URL format</h3>
            <CodeBlock lang="url" code={`POST https://yourapp.com/api/webhook/{workflow-id}

# Query params are available as:
{{trigger.query.param_name}}

# Request body (JSON):
{{trigger.body.field_name}}

# Headers:
{{trigger.headers.authorization}}`} />

            <Callout type="tip">
              Use the <strong>Webhook Response</strong> action node to send a custom HTTP response back to the caller — useful for building APIs.
            </Callout>
          </Section>

          <Section id="mcp" title="MCP Toolboxes">
            <p>
              MCP (Model Context Protocol) toolboxes connect AI agent nodes to external tools, APIs, and data sources.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Adding an MCP server</h3>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
              <li>Go to <strong>MCP Toolboxes</strong> in the sidebar</li>
              <li>Click <strong>Create toolbox</strong></li>
              <li>Enter the server name, SSE URL (e.g. <code className="font-mono bg-gray-100 px-1 rounded">https://mcp.example.com/sse</code>), and optional auth key</li>
            </ol>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">Using in a workflow</h3>
            <p>Add an <strong>action_mcp_tool</strong> node and select the toolbox. The node will call the tool and return <code className="font-mono bg-gray-100 px-1 rounded">{"{{mcp-node.result}}"}</code>.</p>

            <Callout type="info">
              MCP is an open protocol — any server that implements the MCP spec can be connected here.
            </Callout>
          </Section>

        </main>
      </div>
    </AppShell>
  );
}
