"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { NodeData, ConfigField, Connection, UserTable } from "@/lib/types";
import { NODE_DEF_MAP } from "@/lib/nodeDefinitions";
import { X, Copy, Check, Plus, Trash2, GripVertical, ChevronDown, AlertCircle, Table2, HelpCircle, ChevronRight } from "lucide-react";
import { NODE_HELP_GUIDES } from "@/lib/nodeHelpGuides";

// ─── Email Template Select ────────────────────────────────────────────────────

function EmailTemplateSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  useEffect(() => {
    fetch("/api/email-templates")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {});
  }, []);
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— Select email template —</option>
      {templates.map(t => (
        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
      ))}
    </select>
  );
}

// ─── Esign Template Select ────────────────────────────────────────────────────

function EsignTemplateSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/documents")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDocs(d.filter((doc: { is_template: boolean }) => doc.is_template)); })
      .catch(() => {});
  }, []);
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— Select document template —</option>
      {docs.map(d => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );
}

// ─── Doc Template Select ─────────────────────────────────────────────────────

function DocTemplateSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  useEffect(() => {
    fetch("/api/doc-templates")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {});
  }, []);
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— Select document template —</option>
      {templates.map(t => (
        <option key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ""}</option>
      ))}
    </select>
  );
}

// ─── Node output fields map ────────────────────────────────────────────────────
// Maps node types to the output fields they produce, shown as autocomplete suggestions.

const NODE_OUTPUT_FIELDS: Record<string, { field: string; label: string }[]> = {
  trigger_agent:        [{ field: "message", label: "User message" }, { field: "session_id", label: "Session ID" }],
  trigger_manual:       [{ field: "triggered_at", label: "Trigger timestamp" }],
  trigger_webhook:      [{ field: "body", label: "Request body" }, { field: "headers", label: "Request headers" }, { field: "method", label: "HTTP method" }, { field: "query", label: "Query params" }],
  trigger_form:         [{ field: "name", label: "Name field" }, { field: "email", label: "Email field" }, { field: "message", label: "Message field" }, { field: "submitted_at", label: "Submit time" }],
  trigger_schedule:     [{ field: "triggered_at", label: "Run timestamp" }, { field: "cron", label: "Cron expression" }],
  trigger_interval:     [{ field: "triggered_at", label: "Run timestamp" }],
  trigger_github_event: [{ field: "event", label: "Event type" }, { field: "ref", label: "Branch/tag" }, { field: "repository", label: "Repo name" }, { field: "sender", label: "Actor login" }],
  trigger_stripe:       [{ field: "type", label: "Event type" }, { field: "id", label: "Event ID" }, { field: "customer", label: "Customer ID" }],
  trigger_email_inbound:[{ field: "from", label: "Sender email" }, { field: "subject", label: "Subject" }, { field: "body", label: "Email body" }, { field: "to", label: "Recipient" }],
  trigger_rss_poll:     [{ field: "title", label: "Item title" }, { field: "link", label: "Item URL" }, { field: "description", label: "Item description" }, { field: "pubDate", label: "Publish date" }],
  trigger_salesforce:   [{ field: "id", label: "Record ID" }, { field: "object", label: "Object type" }, { field: "fields", label: "Record fields" }],
  trigger_esign:        [{ field: "document_id", label: "Document ID" }, { field: "signer_email", label: "Signer email" }, { field: "signed_at", label: "Signed timestamp" }],
  action_http:          [{ field: "status", label: "HTTP status" }, { field: "body", label: "Response body" }, { field: "headers", label: "Response headers" }],
  action_openai:        [{ field: "text", label: "Completion text" }, { field: "usage.prompt_tokens", label: "Prompt tokens" }, { field: "usage.total_tokens", label: "Total tokens" }],
  action_claude:        [{ field: "text", label: "Response text" }, { field: "usage.input_tokens", label: "Input tokens" }, { field: "usage.output_tokens", label: "Output tokens" }],
  action_gemini:        [{ field: "text", label: "Response text" }],
  action_groq:          [{ field: "text", label: "Response text" }],
  action_mistral:       [{ field: "text", label: "Response text" }],
  action_whisper:       [{ field: "text", label: "Transcription" }, { field: "language", label: "Detected language" }, { field: "duration", label: "Audio duration" }],
  action_dalle:         [{ field: "url", label: "Image URL" }, { field: "base64", label: "Image base64" }],
  action_email:         [{ field: "message_id", label: "Message ID" }, { field: "status", label: "Send status" }],
  action_smtp:          [{ field: "message_id", label: "Message ID" }, { field: "accepted", label: "Accepted recipients" }],
  action_sendgrid:      [{ field: "message_id", label: "Message ID" }, { field: "status", label: "Send status" }],
  action_resend:        [{ field: "id", label: "Email ID" }],
  action_send_email_template: [{ field: "sent", label: "Sent (true/false)" }, { field: "to", label: "Recipient email" }, { field: "subject", label: "Subject used" }],
  action_mailgun:       [{ field: "id", label: "Message ID" }, { field: "message", label: "Status message" }],
  action_postmark:      [{ field: "message_id", label: "Message ID" }, { field: "submitted_at", label: "Submit time" }],
  action_slack:         [{ field: "ok", label: "Success flag" }, { field: "ts", label: "Message timestamp" }, { field: "channel", label: "Channel ID" }],
  action_discord:       [{ field: "ok", label: "Success flag" }, { field: "id", label: "Message ID" }],
  action_telegram:      [{ field: "ok", label: "Success flag" }, { field: "message_id", label: "Message ID" }],
  action_twilio:        [{ field: "sid", label: "Message SID" }, { field: "status", label: "Message status" }],
  action_whatsapp:      [{ field: "id", label: "Message ID" }, { field: "status", label: "Message status" }],
  action_qrcode:        [{ field: "base64", label: "QR base64 image" }, { field: "svg", label: "SVG markup" }, { field: "url", label: "Image URL" }],
  action_pdf:           [{ field: "base64", label: "PDF base64" }, { field: "pdf_url", label: "Public PDF URL" }],
  action_image:         [{ field: "base64", label: "Image base64" }, { field: "url", label: "Image URL" }, { field: "width", label: "Width" }, { field: "height", label: "Height" }],
  action_sheets:        [{ field: "values", label: "Row values" }, { field: "rowCount", label: "Row count" }, { field: "updates", label: "Cells updated" }],
  action_airtable:      [{ field: "id", label: "Record ID" }, { field: "fields", label: "Record fields" }],
  action_notion:        [{ field: "id", label: "Page ID" }, { field: "url", label: "Page URL" }, { field: "title", label: "Page title" }],
  action_github:        [{ field: "id", label: "Resource ID" }, { field: "url", label: "Resource URL" }, { field: "title", label: "Title" }],
  action_jira:          [{ field: "id", label: "Issue ID" }, { field: "key", label: "Issue key" }, { field: "url", label: "Issue URL" }],
  action_linear:        [{ field: "id", label: "Issue ID" }, { field: "url", label: "Issue URL" }, { field: "identifier", label: "Identifier" }],
  action_hubspot:       [{ field: "id", label: "Object ID" }, { field: "properties", label: "Properties" }],
  action_stripe:        [{ field: "id", label: "Object ID" }, { field: "status", label: "Status" }, { field: "amount", label: "Amount" }],
  action_salesforce:    [{ field: "id", label: "Record ID" }, { field: "success", label: "Success flag" }],
  action_mailchimp:     [{ field: "id", label: "Member ID" }, { field: "status", label: "Subscribe status" }],
  action_data_store:    [{ field: "value", label: "Retrieved value" }, { field: "ok", label: "Success flag" }, { field: "key", label: "Store key" }],
  action_transform:     [{ field: "result", label: "Transformed data" }],
  action_code:          [{ field: "result", label: "Code output" }, { field: "output", label: "Console output" }],
  action_formatter:     [{ field: "result", label: "Formatted result" }],
  action_csv_parse:     [{ field: "rows", label: "Parsed rows" }, { field: "headers", label: "Column headers" }, { field: "rowCount", label: "Row count" }],
  action_csv_generate:  [{ field: "csv", label: "CSV string" }],
  action_datetime:      [{ field: "iso", label: "ISO timestamp" }, { field: "unix", label: "Unix timestamp" }, { field: "formatted", label: "Formatted date" }],
  action_math:          [{ field: "result", label: "Calculation result" }],
  action_set_variable:  [{ field: "variables.yourName", label: "Use in any field: {{variables.yourName}}" }],
  action_get_variable:  [{ field: "value", label: "Variable value" }, { field: "found", label: "Was variable set?" }],
  action_if_else:       [{ field: "result", label: "Condition result" }, { field: "branch", label: "Branch (true/false)" }],
  action_switch:        [{ field: "matched_case", label: "Matched case" }, { field: "value", label: "Input value" }],
  action_iterator:      [{ field: "item", label: "Current item" }, { field: "index", label: "Current index" }, { field: "total", label: "Total items" }],
  action_sub_workflow:  [{ field: "output", label: "Sub-workflow output" }, { field: "status", label: "Sub-workflow status" }],
  action_approval:      [{ field: "approved", label: "Was approved" }, { field: "approver", label: "Approver email" }, { field: "comment", label: "Comment" }],
  action_notification:  [{ field: "sent", label: "Was sent" }, { field: "id", label: "Notification ID" }],
  action_agent:         [{ field: "output", label: "Agent output" }, { field: "steps", label: "Reasoning steps" }],
  action_mcp_tool:      [{ field: "result", label: "Tool result" }, { field: "content", label: "Content" }],
  action_postgres:      [{ field: "rows", label: "Query rows" }, { field: "rowCount", label: "Row count" }, { field: "id", label: "Inserted ID" }],
  action_mysql:         [{ field: "rows", label: "Query rows" }, { field: "rowCount", label: "Rows affected" }],
  action_mongodb:       [{ field: "id", label: "Document ID" }, { field: "docs", label: "Documents" }, { field: "count", label: "Count" }],
  action_redis:         [{ field: "value", label: "Retrieved value" }, { field: "ok", label: "Success flag" }],
  action_supabase_db:   [{ field: "data", label: "Query result" }, { field: "count", label: "Row count" }],
  action_google_calendar:[{ field: "id", label: "Event ID" }, { field: "link", label: "Event URL" }, { field: "title", label: "Event title" }],
  action_google_drive:  [{ field: "id", label: "File ID" }, { field: "name", label: "File name" }, { field: "url", label: "File URL" }],
  action_s3:            [{ field: "url", label: "Object URL" }, { field: "key", label: "S3 key" }, { field: "etag", label: "ETag" }],
  action_esign_request: [{ field: "id", label: "Request ID" }, { field: "status", label: "Signing status" }, { field: "signed_url", label: "Signed doc URL" }],
  action_send_esign_template: [{ field: "session_id", label: "Session ID" }, { field: "document_id", label: "Document ID" }, { field: "mode", label: "Signing mode" }, { field: "signers", label: "Signers array" }, { field: "emails_sent", label: "Emails sent" }],
  action_generate_document: [{ field: "document_url", label: "Download URL" }, { field: "document_id", label: "Generated doc ID" }, { field: "template_id", label: "Template ID" }, { field: "output_name", label: "File name" }, { field: "file_size", label: "File size (bytes)" }],
  action_rss:           [{ field: "title", label: "Feed title" }, { field: "items", label: "Feed items" }, { field: "link", label: "Feed URL" }],
  action_xml:           [{ field: "result", label: "Parsed/built XML" }],
  action_crypto:        [{ field: "result", label: "Crypto output" }],
  action_jwt:           [{ field: "token", label: "JWT token" }, { field: "payload", label: "JWT payload" }],
  action_pinecone:      [{ field: "matches", label: "Matched vectors" }, { field: "ids", label: "Inserted IDs" }],
  action_weaviate:      [{ field: "objects", label: "Matched objects" }, { field: "id", label: "Object ID" }],
  action_ssh:           [{ field: "stdout", label: "Command output" }, { field: "exit_code", label: "Exit code" }],
  action_ftp:           [{ field: "path", label: "Remote path" }, { field: "size", label: "File size" }],
  action_sftp:          [{ field: "path", label: "Remote path" }, { field: "size", label: "File size" }],
  action_kafka:         [{ field: "offset", label: "Message offset" }, { field: "partition", label: "Partition" }],
  action_mqtt:          [{ field: "topic", label: "Topic" }, { field: "message", label: "Message" }, { field: "ok", label: "Success flag" }],
  action_rabbitmq:      [{ field: "ok", label: "Success flag" }, { field: "message_count", label: "Message count" }],
  action_nats:          [{ field: "ok", label: "Success flag" }, { field: "subject", label: "Subject" }],
  action_elasticsearch: [{ field: "hits", label: "Search hits" }, { field: "total", label: "Total matches" }, { field: "id", label: "Document ID" }],
  action_user_table:    [{ field: "rows", label: "Query rows" }, { field: "count", label: "Row count" }, { field: "inserted", label: "Insert success" }, { field: "id", label: "Inserted row ID" }, { field: "data", label: "Inserted row data" }, { field: "updated", label: "Update success" }, { field: "affected_rows", label: "Rows affected" }, { field: "deleted", label: "Delete success" }],
  action_webhook_response: [{ field: "sent", label: "Response sent" }],
  action_agent_reply:   [{ field: "reply", label: "Agent reply text" }],
  action_merge:         [{ field: "merged", label: "Merged outputs" }],
  action_delay:         [{ field: "delayed_ms", label: "Actual delay ms" }],
  action_filter:        [{ field: "passed", label: "Filter passed" }],
  action_logger:        [{ field: "label", label: "Log label" }, { field: "timestamp", label: "Timestamp" }, { field: "data", label: "Logged data" }],
};

// ─── Upstream node resolution ─────────────────────────────────────────────────

function getUpstreamNodes(currentId: string, allNodes: Node[], allEdges: Edge[]): Node[] {
  const visited = new Set<string>();
  const result: Node[] = [];
  const queue = [currentId];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const edge of allEdges) {
      if (edge.target === id) {
        const src = allNodes.find((n) => n.id === edge.source);
        if (src && !visited.has(src.id)) {
          result.push(src);
          queue.push(src.id);
        }
      }
    }
  }
  return result;
}

type Suggestion = { label: string; value: string; group: string };

function buildSuggestions(upstreamNodes: Node[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  for (const node of upstreamNodes) {
    const data = node.data as unknown as NodeData;
    const nodeType = data?.type;
    const nodeLabel = data?.label || node.id;
    const outputFields = NODE_OUTPUT_FIELDS[nodeType] ?? [];
    for (const f of outputFields) {
      suggestions.push({
        value: `${node.id}.${f.field}`,
        label: `${nodeLabel} → ${f.label}`,
        group: nodeLabel,
      });
    }
    // Always add the generic .output wildcard
    suggestions.push({ value: `${node.id}.output`, label: `${nodeLabel} → full output`, group: nodeLabel });
  }
  // Built-in special vars
  suggestions.push({ value: "trigger.body", label: "Trigger body", group: "Trigger" });
  suggestions.push({ value: "trigger.headers", label: "Trigger headers", group: "Trigger" });
  suggestions.push({ value: "trigger.query", label: "Trigger query params", group: "Trigger" });
  suggestions.push({ value: "now", label: "Current ISO timestamp", group: "Built-in" });
  suggestions.push({ value: "date", label: "Current date (YYYY-MM-DD)", group: "Built-in" });
  suggestions.push({ value: "uuid", label: "Random UUID", group: "Built-in" });
  return suggestions;
}

// ─── Cron Builder ────────────────────────────────────────────────────────────

type Frequency = "every_minute" | "every_n_minutes" | "hourly" | "every_n_hours" | "daily" | "weekly" | "monthly" | "custom";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function cronToState(cron: string): { freq: Frequency; minute: string; hour: string; dayOfWeek: string; dayOfMonth: string; interval: string } {
  const defaults = { freq: "daily" as Frequency, minute: "00", hour: "09", dayOfWeek: "1", dayOfMonth: "1", interval: "5" };
  if (!cron || cron === "* * * * *") return { ...defaults, freq: "every_minute" };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return defaults;
  const [min, hr, dom, , dow] = parts;
  if (min === "*" && hr === "*") return { ...defaults, freq: "every_minute" };
  if (min.startsWith("*/")) return { ...defaults, freq: "every_n_minutes", interval: min.slice(2) };
  if (min === "0" && hr.startsWith("*/")) return { ...defaults, freq: "every_n_hours", interval: hr.slice(2) };
  if (min === "0" && hr !== "*" && dom === "*" && dow === "*") return { ...defaults, freq: "hourly", minute: "00", hour: hr };
  if (dom === "*" && dow === "*") return { ...defaults, freq: "daily", minute: min.padStart(2, "0"), hour: hr.padStart(2, "0") };
  if (dom === "*" && dow !== "*") return { ...defaults, freq: "weekly", minute: min.padStart(2, "0"), hour: hr.padStart(2, "0"), dayOfWeek: dow };
  if (dow === "*" && dom !== "*") return { ...defaults, freq: "monthly", minute: min.padStart(2, "0"), hour: hr.padStart(2, "0"), dayOfMonth: dom };
  return { ...defaults, freq: "custom" };
}

function stateToCron(freq: Frequency, minute: string, hour: string, dayOfWeek: string, dayOfMonth: string, interval: string): string {
  const m = minute || "0";
  const h = hour || "0";
  switch (freq) {
    case "every_minute":   return "* * * * *";
    case "every_n_minutes": return `*/${interval || 5} * * * *`;
    case "hourly":         return `${m} * * * *`;
    case "every_n_hours":  return `0 */${interval || 2} * * *`;
    case "daily":          return `${m} ${h} * * *`;
    case "weekly":         return `${m} ${h} * * ${dayOfWeek}`;
    case "monthly":        return `${m} ${h} ${dayOfMonth} * *`;
    default:               return "0 9 * * *";
  }
}

function CronBuilder({ value, onChange }: { value: string; onChange: (cron: string) => void }) {
  const init = cronToState(value);
  const [freq, setFreq] = useState<Frequency>(init.freq);
  const [minute, setMinute] = useState(init.minute);
  const [hour, setHour] = useState(init.hour);
  const [dayOfWeek, setDayOfWeek] = useState(init.dayOfWeek);
  const [dayOfMonth, setDayOfMonth] = useState(init.dayOfMonth);
  const [interval, setInterval] = useState(init.interval);
  const [custom, setCustom] = useState(freq === "custom" ? value : "");

  useEffect(() => {
    const s = cronToState(value);
    setFreq(s.freq);
    setMinute(s.minute);
    setHour(s.hour);
    setDayOfWeek(s.dayOfWeek);
    setDayOfMonth(s.dayOfMonth);
    setInterval(s.interval);
    setCustom(s.freq === "custom" ? value : "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const cron = freq === "custom" ? custom : stateToCron(freq, minute, hour, dayOfWeek, dayOfMonth, interval);

  useEffect(() => { onChange(cron); }, [cron]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = "text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Run</label>
        <select className={`${sel} w-full`} value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
          <option value="every_minute">Every minute</option>
          <option value="every_n_minutes">Every N minutes</option>
          <option value="hourly">Every hour at minute…</option>
          <option value="every_n_hours">Every N hours</option>
          <option value="daily">Daily at…</option>
          <option value="weekly">Weekly on…</option>
          <option value="monthly">Monthly on day…</option>
          <option value="custom">Custom cron expression</option>
        </select>
      </div>
      {freq === "every_n_minutes" && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Every</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={59} className={`${sel} w-20`} value={interval} onChange={(e) => setInterval(e.target.value)} />
            <span className="text-xs text-gray-500">minutes</span>
          </div>
        </div>
      )}
      {freq === "every_n_hours" && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Every</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={23} className={`${sel} w-20`} value={interval} onChange={(e) => setInterval(e.target.value)} />
            <span className="text-xs text-gray-500">hours</span>
          </div>
        </div>
      )}
      {freq === "hourly" && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">At minute</label>
          <select className={`${sel} w-full`} value={minute} onChange={(e) => setMinute(e.target.value)}>
            {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}
      {(freq === "daily" || freq === "weekly" || freq === "monthly") && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">At time</label>
          <div className="flex items-center gap-1.5">
            <select className={`${sel} flex-1`} value={hour} onChange={(e) => setHour(e.target.value)}>
              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-xs text-gray-400">:</span>
            <select className={`${sel} flex-1`} value={minute} onChange={(e) => setMinute(e.target.value)}>
              {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}
      {freq === "weekly" && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">On day</label>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => setDayOfWeek(String(i))}
                className={`text-[10px] py-1 rounded-lg font-medium transition-colors ${dayOfWeek === String(i) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                {d.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
      )}
      {freq === "monthly" && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">On day of month</label>
          <select className={`${sel} w-full`} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}
      {freq === "custom" && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Cron expression</label>
          <input className={`${sel} w-full font-mono`} placeholder="0 9 * * 1" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
      )}
      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Cron expression</p>
        <p className="text-xs font-mono text-blue-600 font-semibold">{cron}</p>
      </div>
    </div>
  );
}

// ─── Remote Select — fetches options dynamically from an integration API ────────

function RemoteSelectField({ field, value, onChange, config, base }: {
  field: ConfigField;
  value: string;
  onChange: (v: string) => void;
  config: Record<string, string>;
  base: string;
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(false);

  const fetchOptions = async () => {
    if (field.fetch_action === "salesforce_objects") {
      setLoading(true); setError("");
      try {
        const res = await fetch("/api/integrations/salesforce/objects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_flow: config.auth_flow,
            environment: config.environment,
            login_url: config.login_url,
            client_id: config.client_id,
            client_secret: config.client_secret,
            username: config.username,
            password: config.password,
            security_token: config.security_token,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load objects");
        setOptions(data.objects ?? []);
        setFetched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        {fetched && options.length > 0 ? (
          <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
            {value && !options.find(o => o.value === value) && (
              <option value={value}>{value}</option>
            )}
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            className={`${base} flex-1`}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? "e.g. Contact, Account, My_Object__c"}
          />
        )}
        <button
          type="button"
          onClick={fetchOptions}
          disabled={loading}
          className="flex-shrink-0 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap"
          title="Connect to Salesforce and load all available objects"
        >
          {loading ? "Loading…" : fetched ? "↺ Reload" : "Browse"}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {fetched && <p className="text-[10px] text-gray-400">{options.length} objects loaded — or type any API name</p>}
    </div>
  );
}

// ─── Field Input with {{ autocomplete ─────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  suggestions = [],
  config = {},
}: {
  field: ConfigField;
  value: string;
  onChange: (v: string) => void;
  suggestions?: Suggestion[];
  config?: Record<string, string>;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const base = "w-full text-xs rounded-lg border border-gray-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 placeholder-gray-300";

  const detectContext = (val: string, cursor: number) => {
    const before = val.slice(0, cursor);
    const match = before.match(/\{\{([^}]*)$/);
    if (match) {
      setFilter(match[1].toLowerCase());
      setDropdownOpen(true);
      setSelectedIdx(0);
    } else {
      setDropdownOpen(false);
    }
  };

  const handleChange = (newVal: string, cursor?: number) => {
    onChange(newVal);
    detectContext(newVal, cursor ?? newVal.length);
  };

  const insertSuggestion = (suggValue: string) => {
    const el = inputRef.current ?? textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const match = before.match(/\{\{([^}]*)$/);
    if (match) {
      const start = cursor - match[0].length;
      const newVal = value.slice(0, start) + "{{" + suggValue + "}}" + after;
      onChange(newVal);
    }
    setDropdownOpen(false);
    setTimeout(() => el?.focus(), 0);
  };

  const filtered = suggestions
    .filter((s) => !filter || s.label.toLowerCase().includes(filter) || s.value.toLowerCase().includes(filter))
    .slice(0, 14);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && dropdownOpen) { e.preventDefault(); insertSuggestion(filtered[selectedIdx]?.value ?? ""); }
    else if (e.key === "Escape") setDropdownOpen(false);
    else if (e.key === "Tab" && dropdownOpen) { e.preventDefault(); insertSuggestion(filtered[selectedIdx]?.value ?? ""); }
  };

  if (field.type === "select") {
    return (
      <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (field.type === "remote_select") {
    return <RemoteSelectField field={field} value={value} onChange={onChange} config={config} base={base} />;
  }

  if (field.type === "email_template_select") {
    return <EmailTemplateSelect value={value} onChange={onChange} className={base} />;
  }

  if (field.type === "esign_template_select") {
    return <EsignTemplateSelect value={value} onChange={onChange} className={base} />;
  }

  if (field.type === "doc_template_select") {
    return <DocTemplateSelect value={value} onChange={onChange} className={base} />;
  }

  // Group suggestions
  const grouped = filtered.reduce<Record<string, Suggestion[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const dropdown = dropdownOpen && filtered.length > 0 && (
    <div className="absolute z-50 left-0 top-full mt-0.5 w-full min-w-[260px] max-h-64 overflow-y-auto bg-white border border-violet-200 rounded-lg shadow-xl text-xs">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 sticky top-0 border-b border-violet-100 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
            {group}
          </div>
          {items.map((s) => {
            const idx = filtered.indexOf(s);
            const [nodePart, fieldPart] = s.label.split(" → ");
            return (
              <button
                key={s.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s.value); }}
                className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-violet-50 transition-colors border-b border-gray-50 last:border-0 ${idx === selectedIdx ? "bg-violet-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-violet-700 font-semibold">{`{{${s.value}}}`}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{nodePart}</span>
                  {fieldPart && <span className="text-[9px] text-gray-400">{fieldPart}</span>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400">
        ↑↓ navigate · Enter / Tab to insert · Esc to close
      </div>
    </div>
  );

  if (field.type === "textarea") {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          className={`${base} resize-none`}
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? undefined)}
        />
        {dropdown}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={base}
        type={field.type === "password" ? "password" : "text"}
        placeholder={field.placeholder}
        value={value}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
        onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? undefined)}
      />
      {dropdown}
    </div>
  );
}

// ─── Form Field Builder ────────────────────────────────────────────────────────

type FormFieldDef = {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "number" | "tel" | "url" | "date" | "select" | "checkbox";
  placeholder: string;
  required: boolean;
  options: string; // comma-separated for select
};

const FIELD_TYPES: { value: FormFieldDef["type"]; label: string }[] = [
  { value: "text",     label: "Short text" },
  { value: "email",    label: "Email" },
  { value: "textarea", label: "Long text" },
  { value: "number",   label: "Number" },
  { value: "tel",      label: "Phone" },
  { value: "url",      label: "URL" },
  { value: "date",     label: "Date" },
  { value: "select",   label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
}

function parseFormFields(raw: string): FormFieldDef[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((f: Record<string, unknown>) => ({
      name:        String(f.name ?? ""),
      label:       String(f.label ?? ""),
      type:        (f.type as FormFieldDef["type"]) ?? "text",
      placeholder: String(f.placeholder ?? ""),
      required:    Boolean(f.required ?? false),
      options:     Array.isArray(f.options) ? (f.options as string[]).join(", ") : String(f.options ?? ""),
    }));
  } catch { return []; }
}


function FormFieldBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fields, setFields] = useState<FormFieldDef[]>(() => parseFormFields(value));
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Sync when parent's config loads asynchronously (fields start empty, then value arrives)
  useEffect(() => {
    if (fields.length === 0 && value && value !== "[]") {
      setFields(parseFormFields(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync outward on change
  const syncOut = useCallback((updated: FormFieldDef[]) => {
    try {
      const json = JSON.stringify(updated.map(f => ({
        name:        f.name || slugify(f.label) || `field_${Math.random().toString(36).slice(2,6)}`,
        label:       f.label || f.name,
        type:        f.type,
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.required ? { required: true } : {}),
        ...(f.type === "select" ? { options: f.options.split(",").map((s:string) => s.trim()).filter(Boolean) } : {}),
      })), null, 2);
      onChange(json);
    } catch { /* ignore */ }
  }, [onChange]);

  const update = (idx: number, patch: Partial<FormFieldDef>) => {
    const next = fields.map((f, i) => {
      if (i !== idx) return f;
      const updated = { ...f, ...patch };
      // Auto-generate slug name when label changes (unless name was manually edited)
      if (patch.label !== undefined && f.name === slugify(f.label)) {
        updated.name = slugify(patch.label);
      }
      return updated;
    });
    setFields(next);
    syncOut(next);
  };

  const addField = () => {
    const next = [...fields, { name: "", label: "New Field", type: "text" as const, placeholder: "", required: false, options: "" }];
    setFields(next);
    setExpandedIdx(next.length - 1);
    syncOut(next);
  };

  const removeField = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx);
    setFields(next);
    setExpandedIdx(null);
    syncOut(next);
  };

  const sel = "text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700 w-full";

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-[11px] text-gray-400">No fields yet. Add your first field below.</p>
        </div>
      )}

      {fields.map((field, idx) => {
        const isOpen = expandedIdx === idx;
        return (
          <div key={idx} className={`border rounded-xl overflow-hidden transition-colors ${isOpen ? "border-violet-300 bg-violet-50/30" : "border-gray-200 bg-white"}`}>
            {/* Row header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <GripVertical size={12} className="text-gray-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">{field.label || <span className="text-gray-300 italic">Untitled</span>}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{FIELD_TYPES.find(t => t.value === field.type)?.label ?? field.type}</span>
                  {field.required && <span className="text-[9px] text-red-400 font-semibold">required</span>}
                  {field.name && <span className="text-[9px] font-mono text-gray-300">{field.name}</span>}
                </div>
              </div>
              <button onClick={() => setExpandedIdx(isOpen ? null : idx)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <button onClick={() => removeField(idx)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>

            {/* Expanded editing */}
            {isOpen && (
              <div className="px-3 pb-3 space-y-2.5 border-t border-violet-100">
                <div className="grid grid-cols-2 gap-2 pt-2.5">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Label</label>
                    <input className={sel} value={field.label} onChange={e => update(idx, { label: e.target.value })} placeholder="First Name" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Field name</label>
                    <input className={`${sel} font-mono`} value={field.name} onChange={e => update(idx, { name: e.target.value })} placeholder="first_name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Type</label>
                    <select className={sel} value={field.type} onChange={e => update(idx, { type: e.target.value as FormFieldDef["type"] })}>
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Placeholder</label>
                    <input className={sel} value={field.placeholder} onChange={e => update(idx, { placeholder: e.target.value })} placeholder="e.g. John" />
                  </div>
                </div>
                {field.type === "select" && (
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Options <span className="font-normal normal-case">(comma-separated)</span></label>
                    <input className={sel} value={field.options} onChange={e => update(idx, { options: e.target.value })} placeholder="Option A, Option B, Option C" />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input type="checkbox" checked={field.required} onChange={e => update(idx, { required: e.target.checked })} className="accent-violet-600 w-3.5 h-3.5" />
                  <span className="text-xs text-gray-600">Required field</span>
                </label>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addField}
        className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors mt-1"
      >
        <Plus size={13} /> Add field
      </button>
    </div>
  );
}

// ─── User Table Config ─────────────────────────────────────────────────────────

type TableAction = "insert" | "query" | "update" | "delete" | "count";

const TABLE_ACTIONS: { value: TableAction; label: string; icon: string }[] = [
  { value: "insert", label: "Insert row",  icon: "+" },
  { value: "query",  label: "Query rows",  icon: "⊞" },
  { value: "update", label: "Update row",  icon: "✎" },
  { value: "delete", label: "Delete row",  icon: "✕" },
  { value: "count",  label: "Count rows",  icon: "#" },
];

type ColumnMapping = { column: string; value: string };
type FilterRow    = { column: string; operator: string; value: string };

const OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "contains", "starts_with", "is empty", "is not empty"];

function buildDataJson(mappings: ColumnMapping[]): string {
  const obj: Record<string, string> = {};
  for (const m of mappings) { if (m.column) obj[m.column] = m.value; }
  return JSON.stringify(obj, null, 2);
}

function buildFilterJson(filters: FilterRow[]): string {
  if (!filters.length) return "";
  const obj: Record<string, unknown> = {};
  for (const f of filters) {
    if (!f.column) continue;
    if (f.operator === "=")          obj[f.column] = f.value;
    else if (f.operator === "!=")    obj[`${f.column}:neq`] = f.value;
    else if (f.operator === ">")     obj[`${f.column}:gt`] = f.value;
    else if (f.operator === "<")     obj[`${f.column}:lt`] = f.value;
    else if (f.operator === ">=")    obj[`${f.column}:gte`] = f.value;
    else if (f.operator === "<=")    obj[`${f.column}:lte`] = f.value;
    else if (f.operator === "contains")    obj[`${f.column}:like`] = `%${f.value}%`;
    else if (f.operator === "starts_with") obj[`${f.column}:like`] = `${f.value}%`;
    else if (f.operator === "is empty")    obj[`${f.column}:eq`] = "";
    else if (f.operator === "is not empty") obj[`${f.column}:neq`] = "";
  }
  return JSON.stringify(obj, null, 2);
}

function UserTableConfig({
  config,
  onChange,
  suggestions,
}: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  suggestions: Suggestion[];
}) {
  const [tables, setTables] = useState<UserTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);

  const tableId = config.table_id ?? "";
  const action  = (config.action ?? "insert") as TableAction;

  const selectedTable = tables.find(t => t.id === tableId);
  const columns = selectedTable?.columns ?? [];

  // Column mappings for insert / update data
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  // Filter rows for query / update / delete / count
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [limit, setLimit]   = useState(config.limit ?? "100");

  // Load tables once
  useEffect(() => {
    fetch("/api/tables")
      .then(r => r.json())
      .then(d => setTables(Array.isArray(d) ? d : []))
      .finally(() => setLoadingTables(false));
  }, []);

  // When table/action changes OR columns finish loading — rehydrate mappings from saved config.data
  useEffect(() => {
    if (!columns.length) return;
    let existing: Record<string, string> = {};
    try { existing = JSON.parse(config.data ?? "{}"); } catch { /**/ }
    setMappings(columns.map(c => ({ column: c.name, value: existing[c.name] ?? "" })));
  }, [tableId, action, columns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rehydrate filters from config.filter
  useEffect(() => {
    try {
      const f = JSON.parse(config.filter ?? "{}");
      const rows: FilterRow[] = Object.entries(f).map(([k, v]) => {
        const [col, op] = k.includes(":") ? k.split(":") : [k, "eq"];
        const opMap: Record<string, string> = { eq: "=", neq: "!=", gt: ">", lt: "<", gte: ">=", lte: "<=" };
        return { column: col, operator: opMap[op] ?? "=", value: String(v) };
      });
      setFilters(rows.length ? rows : [{ column: "", operator: "=", value: "" }]);
    } catch { setFilters([{ column: "", operator: "=", value: "" }]); }
  }, [tableId, action, columns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync data JSON when mappings change
  useEffect(() => {
    if (!mappings.length) return;
    onChange({ data: buildDataJson(mappings) });
  }, [mappings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filter JSON when filters change
  useEffect(() => {
    onChange({ filter: buildFilterJson(filters) });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onChange({ limit }); }, [limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputCls = "text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-700 w-full";
  const selCls   = `${inputCls}`;

  const needsData   = action === "insert" || action === "update";
  const needsFilter = action === "query" || action === "update" || action === "delete" || action === "count";
  const needsLimit  = action === "query";

  return (
    <div className="space-y-4">
      {/* Table selector */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Table</label>
        {loadingTables ? (
          <div className="text-xs text-gray-400 py-2">Loading tables…</div>
        ) : tables.length === 0 ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">No tables found. <a href="/tables" target="_blank" className="underline font-semibold">Create one →</a></p>
          </div>
        ) : (
          <select
            className={selCls}
            value={tableId}
            onChange={e => onChange({ table_id: e.target.value })}
          >
            <option value="">— Select a table —</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.columns.length} cols)</option>
            ))}
          </select>
        )}
        {selectedTable && (
          <p className="text-[9px] text-gray-400 font-mono mt-1 truncate">{selectedTable.id}</p>
        )}
      </div>

      {/* Action selector */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Action</label>
        <div className="grid grid-cols-5 gap-1">
          {TABLE_ACTIONS.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => onChange({ action: a.value })}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-[9px] font-bold transition-all ${
                action === a.value
                  ? "border-teal-400 bg-teal-50 text-teal-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="text-base leading-none">{a.icon}</span>
              <span className="leading-tight text-center">{a.label.split(" ")[0]}<br />{a.label.split(" ")[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Column data mapping (insert / update) */}
      {needsData && selectedTable && columns.length > 0 && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
            {action === "insert" ? "Data to insert" : "Values to set"}
          </label>
          <div className="space-y-2">
            {mappings.map((m, i) => (
              <div key={m.column} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                <div className="flex-shrink-0 w-24">
                  <div className="flex items-center gap-1">
                    <Table2 size={10} className="text-gray-300" />
                    <span className="text-[10px] font-mono text-gray-600 truncate">{m.column}</span>
                    {columns[i]?.required && <span className="text-red-400 text-[8px]">*</span>}
                  </div>
                  <span className="text-[8px] text-gray-300 ml-3">{columns[i]?.type}</span>
                </div>
                <span className="text-gray-300 text-xs">→</span>
                <VariableInput
                  value={m.value}
                  onChange={v => {
                    const next = mappings.map((x, j) => j === i ? { ...x, value: v } : x);
                    setMappings(next);
                  }}
                  suggestions={suggestions}
                  placeholder={`{{node_trigger.${m.column}}}`}
                />
              </div>
            ))}
          </div>
          {columns.length === 0 && (
            <p className="text-[11px] text-gray-400">Select a table to see its columns.</p>
          )}
        </div>
      )}

      {/* Filter rows (query / update / delete / count) */}
      {needsFilter && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {action === "update" ? "Identify row to update (filter)" : action === "delete" ? "Identify row to delete (filter)" : "Filter rows"}
            </label>
            <button
              type="button"
              onClick={() => setFilters(f => [...f, { column: "", operator: "=", value: "" }])}
              className="text-[10px] text-teal-600 font-semibold hover:text-teal-800 flex items-center gap-0.5"
            >
              <Plus size={11} /> Add
            </button>
          </div>

          {(action === "update" || action === "delete") && (
            <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-2">
              <AlertCircle size={11} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-600">
                {action === "update" ? "All rows matching the filter will be updated." : "All rows matching the filter will be permanently deleted."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select
                  className="text-[10px] rounded-lg border border-gray-200 px-1.5 py-1.5 bg-white focus:outline-none text-gray-700 flex-1 min-w-0"
                  value={f.column}
                  onChange={e => setFilters(rows => rows.map((r, j) => j === i ? { ...r, column: e.target.value } : r))}
                >
                  <option value="">column</option>
                  {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <select
                  className="text-[10px] rounded-lg border border-gray-200 px-1 py-1.5 bg-white focus:outline-none text-gray-700 flex-shrink-0"
                  value={f.operator}
                  onChange={e => setFilters(rows => rows.map((r, j) => j === i ? { ...r, operator: e.target.value } : r))}
                >
                  {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {f.operator !== "is empty" && f.operator !== "is not empty" && (
                  <VariableInput
                    value={f.value}
                    onChange={v => setFilters(rows => rows.map((r, j) => j === i ? { ...r, value: v } : r))}
                    suggestions={suggestions}
                    placeholder="value or {{var}}"
                    className="flex-1 min-w-0"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setFilters(rows => rows.filter((_, j) => j !== i))}
                  className="text-gray-300 hover:text-red-400 flex-shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {filters.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">{action === "query" ? "No filter — returns all rows." : "No filter set. All rows will be affected!"}</p>
            )}
          </div>
        </div>
      )}

      {/* Limit (query only) */}
      {needsLimit && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Max rows to return</label>
          <input
            type="number"
            min={1}
            max={1000}
            className={`${inputCls} w-24`}
            value={limit}
            onChange={e => setLimit(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

// Inline variable input (used inside UserTableConfig)
function VariableInput({
  value, onChange, suggestions, placeholder, className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const detectContext = (val: string, cursor: number) => {
    const match = val.slice(0, cursor).match(/\{\{([^}]*)$/);
    if (match) { setFilter(match[1].toLowerCase()); setOpen(true); setSelIdx(0); }
    else setOpen(false);
  };

  const filtered = suggestions
    .filter(s => !filter || s.label.toLowerCase().includes(filter) || s.value.toLowerCase().includes(filter))
    .slice(0, 10);

  const insert = (suggValue: string) => {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after  = value.slice(cursor);
    const match  = before.match(/\{\{([^}]*)$/);
    if (match) {
      const start = cursor - match[0].length;
      onChange(value.slice(0, start) + "{{" + suggValue + "}}" + after);
    }
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        className="text-[11px] rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-700 w-full font-mono"
        onChange={e => { onChange(e.target.value); detectContext(e.target.value, e.target.selectionStart ?? 0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (!open || !filtered.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); insert(filtered[selIdx]?.value ?? ""); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 top-full mt-0.5 w-64 max-h-52 overflow-y-auto bg-white border border-teal-200 rounded-lg shadow-xl text-[10px]">
          {filtered.map((s, i) => {
            const [nodePart, fieldPart] = s.label.split(" → ");
            return (
              <button
                key={s.value}
                type="button"
                onMouseDown={e => { e.preventDefault(); insert(s.value); }}
                className={`w-full text-left px-2.5 py-2 flex flex-col gap-0.5 hover:bg-teal-50 border-b border-gray-50 last:border-0 ${i === selIdx ? "bg-teal-50" : ""}`}
              >
                <span className="font-mono text-teal-700 font-semibold truncate">{`{{${s.value}}}`}</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{nodePart}</span>
                  {fieldPart && <span className="text-gray-400">{fieldPart}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  node: Node | null;
  workflowId: string;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
  allNodes?: Node[];
  allEdges?: Edge[];
}

// ─── Node Help Panel ──────────────────────────────────────────────────────────

function NodeHelpPanel({ type }: { type: string }) {
  const [open, setOpen] = useState(false);
  const guide = NODE_HELP_GUIDES[type];
  if (!guide) return null;

  return (
    <div className="border border-blue-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600">
          <HelpCircle size={11} /> How to use this node
        </span>
        <ChevronRight size={11} className={`text-blue-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-3 py-3 space-y-3 bg-white">
          <p className="text-[11px] text-gray-600 leading-relaxed">{guide.summary}</p>

          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Setup</p>
            <ol className="space-y-1">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-gray-600">
                  <span className="text-blue-400 font-semibold flex-shrink-0">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {guide.tips && guide.tips.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tips</p>
              <ul className="space-y-1">
                {guide.tips.map((tip, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] text-gray-500">
                    <span className="text-amber-400 flex-shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guide.outputFields && guide.outputFields.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Output Fields</p>
              <div className="space-y-1">
                {guide.outputFields.map(f => (
                  <div key={f.field} className="flex gap-2 items-start">
                    <code className="text-[10px] bg-gray-100 text-violet-700 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                      {"{{"}{f.field}{"}}"}
                    </code>
                    <span className="text-[11px] text-gray-500">{f.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NodeConfigPanel({ node, workflowId, onClose, onUpdate, allNodes = [], allEdges = [] }: Props) {
  const [label, setLabel] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [esignDocs, setEsignDocs] = useState<{ id: string; name: string }[]>([]);
  const [secretNames, setSecretNames] = useState<string[]>([]);

  const nodeData = node?.data as unknown as NodeData | undefined;
  const def = nodeData ? NODE_DEF_MAP[nodeData.type] : null;

  // Compute suggestions from upstream nodes + secrets
  const upstreamNodes = node ? getUpstreamNodes(node.id, allNodes, allEdges) : [];
  const baseSuggestions = buildSuggestions(upstreamNodes);
  const suggestions: Suggestion[] = [
    ...baseSuggestions,
    ...secretNames.map((n) => ({ value: `secret.${n}`, label: `Secret: ${n}`, group: "Secrets" })),
  ];

  useEffect(() => {
    if (nodeData) {
      setLabel(nodeData.label);
      const cfg: Record<string, string> = {};
      for (const f of def?.configFields || []) {
        const raw = nodeData.config[f.key] ?? f.options?.[0]?.value ?? "";
        // If the value is an object/array (e.g. JSONB from Supabase), serialize it back to JSON string
        cfg[f.key] = (typeof raw === "object" && raw !== null) ? JSON.stringify(raw) : String(raw);
      }
      if (nodeData.type === "trigger_schedule") {
        cfg.cron = String(nodeData.config.cron ?? "0 9 * * *");
      }
      if (nodeData.config.connectionId) {
        cfg.connectionId = String(nodeData.config.connectionId);
      }
      if (nodeData.type === "action_esign_request" && nodeData.config.document_id) {
        cfg.document_id = String(nodeData.config.document_id);
      }
      setConfig(cfg);
    }
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/secrets")
      .then((r) => r.json())
      .then((data: { name: string }[]) => {
        if (Array.isArray(data)) setSecretNames(data.map((s) => s.name));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!def?.connectionType) return;
    fetch(`/api/connections`)
      .then((r) => r.json())
      .then((all: Connection[]) => setConnections(
        all.filter((c) => c.type === def.connectionType).sort((a, b) => a.name.localeCompare(b.name))
      ))
      .catch(() => {});
  }, [def?.connectionType, node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nodeData?.type !== "action_esign_request") return;
    fetch("/api/documents")
      .then((r) => r.json())
      .then((docs: { id: string; name: string }[]) => setEsignDocs(docs))
      .catch(() => {});
  }, [nodeData?.type, node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node || !nodeData || !def) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookTriggers = ["trigger_webhook", "trigger_github_event", "trigger_stripe", "trigger_email_inbound", "trigger_rss_poll"];
  const webhookUrl = webhookTriggers.includes(nodeData.type) ? `${origin}/api/webhook/${workflowId}` : null;
  const formUrl = nodeData.type === "trigger_form" ? `${origin}/form/${workflowId}` : null;
  const copyUrl = webhookUrl || formUrl;

  const handleSave = () => {
    onUpdate(node.id, { label, config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyWebhook = () => {
    if (copyUrl) {
      navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSchedule = nodeData.type === "trigger_schedule";
  const hasConnection = !!def?.connectionType;
  const connectionId = config.connectionId || "";
  const hiddenFields = new Set(connectionId && def?.connectionFields ? def.connectionFields : []);

  return (
    <aside className="w-72 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: def.color }}>
            {def.category === "trigger" ? "Trigger" : "Action"}
          </div>
          <span className="text-xs text-gray-500 truncate">{def.label}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Node Label</label>
          <input
            className="mt-1 w-full text-xs rounded-lg border border-gray-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Webhook / Form URL */}
        {(webhookUrl || formUrl) && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {formUrl ? "Form URL" : "Webhook URL"}
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly className="flex-1 text-[10px] rounded-lg border border-gray-200 px-2.5 py-2 bg-gray-50 text-gray-500 truncate" value={copyUrl ?? ""} />
              <button onClick={copyWebhook} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
            {formUrl && (
              <a href={formUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1 inline-block">
                Open form ↗
              </a>
            )}
          </div>
        )}

        {/* Connection picker */}
        {hasConnection && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Connection</label>
            <div className="mt-1 flex gap-1.5">
              <select
                className="flex-1 text-xs rounded-lg border border-gray-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700"
                value={connectionId}
                onChange={(e) => setConfig((prev) => ({ ...prev, connectionId: e.target.value }))}
              >
                <option value="">(use inline credentials)</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-connections")); }}
                className="flex items-center p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-colors"
                title="Manage connections">
                <Plus size={12} />
              </a>
            </div>
            {connections.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-1">No {def.connectionType} connections yet. Click + to add one.</p>
            )}
          </div>
        )}

        {/* Schedule builder */}
        {isSchedule && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Schedule</p>
            <CronBuilder
              value={config.cron || "0 9 * * *"}
              onChange={(cron) => setConfig((prev) => ({ ...prev, cron }))}
            />
          </div>
        )}

        {/* E-Sign document picker */}
        {nodeData.type === "action_esign_request" && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Document</p>
            <select
              value={config.document_id || ""}
              onChange={(e) => setConfig((prev) => ({ ...prev, document_id: e.target.value }))}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">— Select a PDF document —</option>
              {esignDocs.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {config.document_id && (
              <p className="text-[10px] text-indigo-500">Fields placed on this document will be sent to the signer.</p>
            )}
          </div>
        )}

        {/* Form Field Builder for trigger_form */}
        {nodeData.type === "trigger_form" && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Form Fields</p>
            <FormFieldBuilder
              key={node?.id}
              value={config.fields ?? "[]"}
              onChange={(v) => setConfig((prev) => ({ ...prev, fields: v }))}
            />
          </div>
        )}

        {/* User Table Config for action_user_table */}
        {nodeData.type === "action_user_table" && (
          <UserTableConfig
            key={node?.id}
            config={config}
            onChange={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
            suggestions={suggestions}
          />
        )}

        {/* Generic config fields */}
        {nodeData.type !== "action_user_table" &&
          def.configFields.filter((f) =>
            !(isSchedule && f.key === "cron") &&
            !hiddenFields.has(f.key) &&
            !(nodeData.type === "trigger_form" && f.key === "fields")
          ).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Configuration</p>
              {suggestions.length > 0 && (
                <span className="text-[9px] text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">
                  Type {"{{"}  for suggestions
                </span>
              )}
            </div>
            {def.configFields
              .filter((f) =>
                !(isSchedule && f.key === "cron") &&
                !hiddenFields.has(f.key) &&
                !(nodeData.type === "trigger_form" && f.key === "fields")
              )
              .map((field) => (
                <div key={field.key}>
                  <label className="text-[10px] font-medium text-gray-600 flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <div className="mt-1">
                    <FieldInput
                      field={field}
                      value={config[field.key] ?? ""}
                      onChange={(v) => setConfig((prev) => ({ ...prev, [field.key]: v }))}
                      suggestions={field.type !== "select" && field.type !== "password" && field.type !== "remote_select" ? suggestions : []}
                      config={{
                        ...config,
                        // Connection credentials override empty inline fields (must come last)
                        ...(connectionId
                          ? Object.fromEntries(
                              Object.entries(
                                (connections.find(c => c.id === connectionId)?.config ?? {}) as Record<string, unknown>
                              ).map(([k, v]) => [k, String(v)])
                            )
                          : {}),
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}

        {def.configFields.length === 0 && !isSchedule && nodeData.type !== "trigger_webhook" && nodeData.type !== "action_user_table" && (
          <p className="text-xs text-gray-400 text-center py-4">No configuration needed for this node.</p>
        )}

        {/* Help Guide */}
        {NODE_HELP_GUIDES[nodeData.type] && (
          <NodeHelpPanel type={nodeData.type} />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          className={`w-full text-xs font-semibold py-2 rounded-lg transition-colors ${
            saved ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>
    </aside>
  );
}
