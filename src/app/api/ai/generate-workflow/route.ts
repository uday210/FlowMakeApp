import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { NodeType } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

type WFNode = {
  id: string;
  type: "workflowNode";
  position: { x: number; y: number };
  data: { label: string; type: NodeType; config: Record<string, unknown>; status: "idle" };
};

type WFEdge = { id: string; source: string; target: string; type: "makeEdge" };

type Blueprint = {
  name: string;
  description: string;
  nodes: WFNode[];
  edges: WFEdge[];
};

// ─── Claude-powered generator ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a workflow automation assistant. Given a plain-English description, produce a minimal, accurate workflow JSON.

## Available node types

### Triggers (use exactly ONE as the first node)
- trigger_form       – user submits a web form
- trigger_webhook    – incoming HTTP request / webhook
- trigger_schedule   – cron schedule (config: { cron: "0 9 * * *" })
- trigger_interval   – repeating interval (config: { every: "15", unit: "minutes" })
- trigger_manual     – manual button click
- trigger_email_inbound – incoming email
- trigger_rss_poll   – RSS/Atom feed polling
- trigger_github_event – GitHub push / PR / issue

### Actions (include ONLY what the user explicitly asks for)
**Data & Storage**
- action_user_table  – read/write custom database tables (config: { action:"insert", table_id:"", data:"{}" })
- action_data_store  – key-value data store (config: { action:"set", key:"", value:"" })
- action_csv_generate – create a CSV file (config: { filename:"output.csv", data:"{{node_trigger}}" })
- action_csv_parse   – parse an incoming CSV string
- action_sheets      – Google Sheets append/read
- action_airtable    – Airtable create/read/update
- action_notion      – Notion create/update page
- action_s3          – Amazon S3 upload/download
- action_google_drive – Google Drive file operations

**Email**
- action_email       – send email (config: { to:"{{node_trigger.email}}", subject:"", body:"" })
- action_sendgrid    – SendGrid email
- action_resend      – Resend email
- action_smtp        – SMTP email

**Messaging**
- action_slack       – Slack message (config: { webhook_url:"", message:"" })
- action_discord     – Discord message
- action_telegram    – Telegram message
- action_twilio      – Twilio SMS

**HTTP & Code**
- action_http        – HTTP request (config: { method:"GET", url:"" })
- action_code        – run JavaScript (config: { language:"javascript", code:"return input;" })
- action_formatter   – format / transform a value

**AI**
- action_openai      – OpenAI GPT (config: { model:"gpt-4o-mini", prompt:"" })
- action_claude      – Anthropic Claude (config: { model:"claude-haiku-4-5-20251001", prompt:"" })

**Flow Control**
- action_if_else     – conditional branch
- action_filter      – stop execution if condition fails
- action_delay       – wait N seconds/minutes
- action_transform   – map / reshape data

**CRM & Payments**
- action_salesforce  – Salesforce record operations
- action_hubspot     – HubSpot contact/deal operations
- action_stripe      – Stripe payment / customer operations

**Databases**
- action_postgres    – PostgreSQL query
- action_mysql       – MySQL query
- action_mongodb     – MongoDB operation
- action_supabase_db – Supabase table query

## Important notes on node selection

- When the user says "save to database", "insert into my table", "store data", "DB save" — ALWAYS use action_user_table (the platform's built-in database). Only use action_postgres/action_mysql/action_mongodb if the user explicitly names that specific external database.
- When the user says "fetch from API", "call an API", "HTTP request", "fetch data" — use action_http.
- When the user says "post to Slack", "notify on Slack", "send a message to Slack", "post a summary to Slack" — use action_slack.
- When the user says "summarize with AI", "AI summary", "use AI to summarize" — use action_openai or action_claude.
- "parse the payload" / "process the data" does NOT need an extra node — just reference {{node_trigger.field}} in later nodes.

## Rules (follow strictly)

1. ONLY include nodes that are explicitly or obviously implied by the description. Never guess or add "nice to have" extras.
2. The workflow name must be a SHORT, DESCRIPTIVE title (3–6 words, Title Case). Do NOT use the raw user prompt as the name.
   Good examples: "Lead Capture Form", "Daily Slack Digest", "Stripe Payment Alert", "Webhook to DB"
3. Node labels must be human-readable action descriptions, not just the type name.
   Good: "Save Lead to Table", "Send Welcome Email", "Fetch Weather API", "Post Summary to Slack"
   Bad:  "action_user_table", "Save to Table", "HTTP Request", "Slack Message"
4. Space nodes 240px apart horizontally: x = 100, 340, 580, 820 ...  All at y = 200.
5. Node IDs: "node_trigger" for the trigger, "node_1", "node_2" ... for actions.
6. Edge IDs: "edge_0", "edge_1" ...
7. Variables follow the pattern {{node_trigger.field_name}} or {{node_1.field_name}}.
8. For action_user_table config.data, use a JSON string with interpolated values, e.g.:
   "{\\"first_name\\": \\"{{node_trigger.first_name}}\\", \\"email\\": \\"{{node_trigger.email}}\\"}"
9. For action_http, set config.method to "GET" unless the prompt says POST/PUT/PATCH. Leave config.url empty if no URL is given.

## Output format

Output ONLY a valid JSON object — no markdown fences, no explanation, no extra text.

{
  "name": "Short Descriptive Name",
  "description": "One sentence describing what this workflow does.",
  "nodes": [ ... ],
  "edges": [ ... ]
}`;

async function buildWithClaude(prompt: string): Promise<Blueprint> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();

  // Strip markdown fences if Claude wraps anyway
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(jsonText) as Blueprint;

  // Validate minimal shape
  if (!parsed.nodes?.length || !parsed.edges) throw new Error("Invalid blueprint shape");

  return parsed;
}

// ─── Rule-based fallback (only fires when no API key) ─────────────────────────
const TRIGGER_RULES: { phrases: string[]; type: NodeType; label: string; config: Record<string, unknown> }[] = [
  { phrases: ["form submit", "form trigger", "form submission", "web form", "someone submits", "contact form", "submitted", "form is filled", "fill out a form"], type: "trigger_form", label: "Form Submission", config: { title: "Form", submit_label: "Submit", fields: "[]" } },
  { phrases: ["webhook", "incoming webhook", "webhook trigger", "http trigger", "api trigger", "receives a request", "webhook is received", "a webhook arrives", "webhook payload", "http post"], type: "trigger_webhook", label: "Webhook Received", config: {} },
  { phrases: ["on a schedule", "cron", "every day at", "every morning", "every night", "daily at", "daily at", "weekly on", "run daily", "run weekly", "run monthly", "scheduled", "each day", "each morning", "every weekday", "once a day", "once a week"], type: "trigger_schedule", label: "Daily Schedule", config: { cron: "0 9 * * *" } },
  { phrases: ["every 15 minutes", "every hour", "every 5 minutes", "every n minutes", "run every", "on interval", "at interval", "every few minutes", "every few hours", "repeating"], type: "trigger_interval", label: "Interval", config: { every: "15", unit: "minutes" } },
  { phrases: ["incoming email", "email received", "inbound email", "when an email arrives", "new email"], type: "trigger_email_inbound", label: "Email Received", config: {} },
  { phrases: ["rss feed", "new rss item", "atom feed", "blog feed"], type: "trigger_rss_poll", label: "RSS Feed", config: {} },
  { phrases: ["github push", "github event", "pull request opened", "new issue on github"], type: "trigger_github_event", label: "GitHub Event", config: {} },
  { phrases: ["manually", "run once", "manual trigger", "button click"], type: "trigger_manual", label: "Manual Trigger", config: {} },
];

const ACTION_RULES: { phrases: string[]; type: NodeType; label: string; config: Record<string, unknown> }[] = [
  // Storage
  { phrases: ["save to table", "insert into table", "store in table", "save to my table", "add to table", "write to table", "custom table", "my table", "insert a row", "insert row", "add a row", "row into my", "into my table", "into the table", "save the data", "store the data", "database table"], type: "action_user_table", label: "Save to Table", config: { action: "insert", table_id: "" } },
  { phrases: ["generate csv", "export as csv", "create csv", "csv file", "csv output", "download as csv"], type: "action_csv_generate", label: "Generate CSV", config: { filename: "output.csv", data: "{{node_trigger}}" } },
  { phrases: ["parse csv", "read csv", "import csv", "csv input"], type: "action_csv_parse", label: "Parse CSV", config: { input: "{{node_trigger.csv}}" } },
  { phrases: ["google sheets", "append to sheet", "write to sheet", "update sheet"], type: "action_sheets", label: "Google Sheets", config: {} },
  { phrases: ["airtable"], type: "action_airtable", label: "Airtable", config: {} },
  { phrases: ["notion"], type: "action_notion", label: "Notion", config: {} },
  { phrases: ["amazon s3", "s3 bucket", "upload to s3"], type: "action_s3", label: "Amazon S3", config: {} },
  { phrases: ["google drive", "upload to drive", "save to drive"], type: "action_google_drive", label: "Google Drive", config: {} },
  // Email
  { phrases: ["send an email", "send email", "email notification", "email the user", "email them", "notify by email", "notify via email", "confirmation email", "welcome email", "send a confirmation", "send a notification"], type: "action_email", label: "Send Email", config: { to: "{{node_trigger.email}}", subject: "Notification", body: "{{node_trigger}}" } },
  { phrases: ["sendgrid"], type: "action_sendgrid", label: "SendGrid", config: {} },
  { phrases: ["resend email", "via resend"], type: "action_resend", label: "Resend", config: {} },
  // Messaging
  { phrases: ["slack", "to slack", "on slack", "slack message", "send to slack", "post to slack", "slack notification", "slack channel", "post.*slack"], type: "action_slack", label: "Post to Slack", config: { webhook_url: "", message: "{{node_1.output}}" } },
  { phrases: ["discord message", "send to discord", "discord channel", "to discord"], type: "action_discord", label: "Discord Message", config: {} },
  { phrases: ["telegram message", "send telegram", "via telegram"], type: "action_telegram", label: "Telegram", config: {} },
  { phrases: ["send sms", "twilio sms", "text message", "sms notification"], type: "action_twilio", label: "SMS via Twilio", config: {} },
  // HTTP
  { phrases: ["http request", "api call", "api request", "call an api", "fetch from api", "fetch data", "fetch from", "post request", "get request", "rest api", "http api", "an http", "from an api", "from an http", "call the api", "hit an api", "make a request", "make an api"], type: "action_http", label: "Fetch from API", config: { method: "GET", url: "" } },
  // AI
  { phrases: ["openai", "chatgpt", "gpt-4", "gpt-3", "ask gpt", "use openai"], type: "action_openai", label: "OpenAI GPT", config: { model: "gpt-4o-mini", prompt: "{{node_trigger}}" } },
  { phrases: ["claude ai", "ask claude", "use claude", "anthropic"], type: "action_claude", label: "Claude AI", config: { model: "claude-haiku-4-5-20251001", prompt: "{{node_trigger}}" } },
  { phrases: ["summarize", "ai summary", "summarise", "ai summarize", "post a summary", "generate a summary", "create a summary", "write a summary"], type: "action_openai", label: "Summarize with AI", config: { model: "gpt-4o-mini", prompt: "Summarize the following concisely:\n\n{{node_1.output}}" } },
  // Flow Control
  { phrases: ["if else", "if condition", "branch based on", "check if", "conditional branch"], type: "action_if_else", label: "If / Else", config: {} },
  { phrases: ["filter out", "only proceed if", "skip if", "stop if"], type: "action_filter", label: "Filter", config: {} },
  { phrases: ["wait for", "delay by", "pause for"], type: "action_delay", label: "Delay", config: { duration: 5, unit: "seconds" } },
  { phrases: ["run code", "javascript", "custom code", "execute script"], type: "action_code", label: "Run Code", config: { language: "javascript", code: "return input;" } },
  // CRM
  { phrases: ["salesforce"], type: "action_salesforce", label: "Salesforce", config: {} },
  { phrases: ["hubspot"], type: "action_hubspot", label: "HubSpot", config: {} },
  // Payments
  { phrases: ["stripe payment", "stripe charge", "create stripe", "stripe customer"], type: "action_stripe", label: "Stripe", config: {} },
  // DBs
  { phrases: ["postgres query", "postgresql", "query postgres"], type: "action_postgres", label: "PostgreSQL", config: {} },
  { phrases: ["mysql query", "query mysql"], type: "action_mysql", label: "MySQL", config: {} },
  { phrases: ["mongodb"], type: "action_mongodb", label: "MongoDB", config: {} },
  { phrases: ["supabase"], type: "action_supabase_db", label: "Supabase DB", config: {} },
];

function titleCase(str: string) {
  // Capitalise each word, strip leading/trailing
  return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function generateName(prompt: string): string {
  const lower = prompt.toLowerCase();
  // Detect trigger type from prompt
  const triggerPhrases: [string[], string][] = [
    [["form submit", "form submission", "web form", "someone submits", "submitted", "form is filled"], "Form"],
    [["webhook", "http post", "webhook payload"], "Webhook"],
    [["every day", "daily", "every morning", "each day", "once a day", "every weekday", "schedule"], "Daily"],
    [["every hour", "every 15 minutes", "every 5 minutes", "run every", "interval", "repeating"], "Recurring"],
    [["incoming email", "email received", "new email"], "Email"],
    [["rss feed", "blog feed"], "RSS"],
    [["github"], "GitHub"],
  ];
  const actionPhrases: [string[], string][] = [
    [["slack", "to slack"], "Slack Alert"],
    [["csv"], "CSV Export"],
    [["my table", "into my table", "insert a row", "save the data", "database table"], "DB Save"],
    [["send email", "confirmation email", "welcome email"], "Email"],
    [["google sheets", "append to sheet"], "Sheets"],
    [["openai", "chatgpt", "summarize", "summarise", "ai summary"], "AI Summary"],
    [["claude ai", "ask claude"], "Claude AI"],
    [["notion"], "Notion"],
    [["airtable"], "Airtable"],
    [["http api", "from an api", "fetch data", "api call", "http request"], "API Fetch"],
    [["stripe"], "Stripe"],
    [["discord"], "Discord"],
  ];

  const trig = triggerPhrases.find(([phrases]) => phrases.some(p => lower.includes(p)))?.[1];
  const act  = actionPhrases.find(([phrases]) => phrases.some(p => lower.includes(p)))?.[1];

  if (trig && act) return `${trig} → ${act}`;
  if (trig) return `${trig} Workflow`;
  if (act) return `${act} Automation`;

  // Fallback: title-case first 5 words
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
  return titleCase(words);
}

function extractCronFromPrompt(lower: string): string {
  // "at 9am" / "at 9:30am" / "at 14:00"
  const timeMatch = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3];
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    if (lower.includes("weekly") || lower.includes("every week") || lower.includes("on monday") || lower.includes("on friday")) {
      return `${m} ${h} * * 1`;
    }
    return `${m} ${h} * * *`;
  }
  return "0 9 * * *";
}

function buildWithRules(prompt: string): Blueprint {
  const lower = prompt.toLowerCase();

  // Match trigger
  const triggerMatch = TRIGGER_RULES.find(r => r.phrases.some(p => lower.includes(p)));
  // Enrich schedule trigger with parsed time
  let triggerConfig = triggerMatch ? { ...triggerMatch.config } : {};
  if (triggerMatch?.type === "trigger_schedule") {
    triggerConfig = { ...triggerConfig, cron: extractCronFromPrompt(lower) };
  }
  const trigger = triggerMatch
    ? { type: triggerMatch.type, label: triggerMatch.label, config: triggerConfig }
    : { type: "trigger_manual" as NodeType, label: "Manual Trigger", config: {} };

  // Match actions — phrases must appear in prompt
  const seen = new Set<string>();
  const actions: { type: NodeType; label: string; config: Record<string, unknown> }[] = [];
  for (const rule of ACTION_RULES) {
    if (seen.has(rule.type)) continue;
    if (rule.phrases.some(p => lower.includes(p))) {
      seen.add(rule.type);
      actions.push({ type: rule.type, label: rule.label, config: rule.config });
    }
  }

  const nodes: WFNode[] = [];
  const edges: WFEdge[] = [];

  // Trigger node
  nodes.push({
    id: "node_trigger",
    type: "workflowNode",
    position: { x: 100, y: 200 },
    data: { label: trigger.label, type: trigger.type, config: { ...trigger.config }, status: "idle" },
  });

  let prevId = "node_trigger";
  actions.forEach((action, i) => {
    const nodeId = `node_${i + 1}`;
    nodes.push({
      id: nodeId,
      type: "workflowNode",
      position: { x: 100 + (i + 1) * 240, y: 200 },
      data: { label: action.label, type: action.type, config: { ...action.config }, status: "idle" },
    });
    edges.push({ id: `edge_${i}`, source: prevId, target: nodeId, type: "makeEdge" });
    prevId = nodeId;
  });

  return {
    name: generateName(prompt),
    description: prompt,
    nodes,
    edges,
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  let blueprint: Blueprint;
  let source: "claude" | "rules" = "claude";

  try {
    blueprint = await buildWithClaude(prompt.trim());
  } catch (err) {
    console.warn("[generate-workflow] Claude failed, using rule-based fallback:", err instanceof Error ? err.message : err);
    source = "rules";
    blueprint = buildWithRules(prompt.trim());
  }

  // Persist to DB
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      name: blueprint.name,
      description: blueprint.description,
      nodes: blueprint.nodes,
      edges: blueprint.edges,
      is_active: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, workflow: data, source }, { status: 201 });
}
