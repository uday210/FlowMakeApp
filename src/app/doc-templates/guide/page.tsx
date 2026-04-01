"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed">
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-800 my-3 leading-relaxed">
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 my-3 leading-relaxed">
      {children}
    </div>
  );
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 mb-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Syntax</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Example output</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(([syn, out, note]) => (
            <tr key={syn} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono text-violet-700 whitespace-nowrap">{syn}</td>
              <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{out}</td>
              <td className="px-4 py-2.5 text-gray-500">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocTemplateGuidePage() {
  const router = useRouter();

  const sections = [
    { id: "overview",    label: "Overview" },
    { id: "basics",     label: "Basic Fields" },
    { id: "nested",     label: "Nested Keys" },
    { id: "formatters", label: "Formatters" },
    { id: "loops",      label: "Loops / Arrays" },
    { id: "conditions", label: "Conditionals" },
    { id: "workflow",   label: "Workflow Node" },
    { id: "api",        label: "API Reference" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push("/doc-templates")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={15} /> Doc Composer
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <span className="text-sm font-bold text-gray-800">Template Authoring Guide</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10">
        {/* TOC sidebar */}
        <nav className="w-44 flex-shrink-0 hidden lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Contents</p>
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="block text-xs text-gray-500 hover:text-violet-600 py-1 transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">

          <Section title="Overview" id="overview">
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Doc Composer lets you upload <strong>Word (.docx) templates</strong> with special merge field syntax.
              When you generate a document, we fill those fields with real data — from a workflow trigger,
              an API call, a table row, or any JSON payload you provide.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              The syntax is designed to be <strong>readable in Word</strong> and powerful enough to handle
              currency formatting, date formatting, looping over line items, and conditional sections.
            </p>
            <Note>
              <strong>How to author a template:</strong> Open your Word document, type merge fields
              exactly as shown in this guide, save as <code className="font-mono bg-violet-100 px-1 rounded">.docx</code>,
              then upload it in Doc Composer. We automatically detect every merge field in your document.
            </Note>
          </Section>

          <Section title="Basic Fields" id="basics">
            <p className="text-sm text-gray-600 mb-3">
              Wrap any key name in curly braces. The key must match the exact JSON key from the data you pass at generation time.
            </p>
            <Code>{`In your Word doc:
  Dear {first_name},

  This agreement is between {company_name} and {client_name}.

Data you pass:
  {
    "first_name": "Jane",
    "company_name": "Acme Corp",
    "client_name": "TechStart Ltd"
  }

Result:
  Dear Jane,

  This agreement is between Acme Corp and TechStart Ltd.`}</Code>

            <Warn>
              <strong>Important:</strong> Curly braces must be typed as plain text in Word, not as special characters.
              If Word autocorrects them, turn off "smart quotes / special characters" in AutoCorrect options.
            </Warn>
          </Section>

          <Section title="Nested Keys (dot notation)" id="nested">
            <p className="text-sm text-gray-600 mb-3">
              Use dots to access nested objects in your JSON payload.
            </p>
            <Code>{`Data:
  {
    "customer": {
      "name": "Acme Corp",
      "address": {
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zip": "10001"
      }
    },
    "rep": {
      "name": "Jane Smith",
      "email": "jane@company.com"
    }
  }

In your Word doc:
  Client: {customer.name}
  Address: {customer.address.street}, {customer.address.city}, {customer.address.state} {customer.address.zip}
  Account Manager: {rep.name} ({rep.email})`}</Code>
          </Section>

          <Section title="Formatters" id="formatters">
            <p className="text-sm text-gray-600 mb-4">
              Add a pipe <code className="font-mono bg-gray-100 px-1 rounded">|</code> after the field name to format the value.
              You can chain multiple formatters.
            </p>

            <Sub title="Currency">
              <Table rows={[
                ["{amount | currency}",        "$50,000.00",    "Default USD"],
                ["{amount | currency:EUR}",     "€50,000.00",    "Euro"],
                ["{amount | currency:GBP}",     "£50,000.00",    "British Pound"],
                ["{amount | currency:INR}",     "₹50,000.00",    "Indian Rupee"],
                ["{amount | currency:CAD}",     "CA$50,000.00",  "Canadian Dollar"],
              ]} />
              <Code>{`Data: { "amount": 50000 }
Template: Total due: {amount | currency:USD}
Result:   Total due: $50,000.00`}</Code>
            </Sub>

            <Sub title="Numbers">
              <Table rows={[
                ["{qty | number}",       "1,234",       "Integer with thousands separator"],
                ["{price | number:2}",   "1,234.56",    "2 decimal places"],
                ["{rate | percent}",     "18.5%",       "Divide by 100, show as percent"],
                ["{rate | percent:0}",   "19%",         "Zero decimal places"],
              ]} />
            </Sub>

            <Sub title="Dates & Times">
              <Table rows={[
                ["{start_date | date}",                     "January 15, 2025",          "Default long format"],
                ["{start_date | date:MM/DD/YYYY}",          "01/15/2025",                "US short format"],
                ["{start_date | date:DD/MM/YYYY}",          "15/01/2025",                "UK/EU short format"],
                ["{start_date | date:DD MMM YYYY}",         "15 Jan 2025",               "Day + abbreviated month"],
                ["{start_date | date:MMMM D, YYYY}",        "January 15, 2025",          "Full month name"],
                ["{created_at | datetime}",                  "January 15, 2025 at 3:45 PM", "Date + time"],
                ["{created_at | datetime:MM/DD/YYYY HH:mm}", "01/15/2025 15:45",          "Custom datetime"],
                ["{meeting_time | time}",                    "3:45 PM",                   "Time only"],
              ]} />
              <Note>
                Date fields accept any ISO 8601 string (<code className="font-mono">2025-01-15</code> or <code className="font-mono">2025-01-15T15:45:00Z</code>) or any JavaScript-parseable date string.
              </Note>
            </Sub>

            <Sub title="Text">
              <Table rows={[
                ["{name | uppercase}",     "ACME CORP",       "All uppercase"],
                ["{name | lowercase}",     "acme corp",       "All lowercase"],
                ["{name | capitalize}",    "Acme corp",       "First letter only"],
                ["{name | titlecase}",     "Acme Corp",       "Each word capitalized"],
                ["{notes | truncate:100}", "First 100 chars…","Truncate long text"],
                ["{field | trim}",         "no extra spaces", "Strip whitespace"],
              ]} />
            </Sub>

            <Sub title="Booleans">
              <Table rows={[
                ["{is_signed | yesno}",    "Yes / No",        "Human-readable boolean"],
                ["{is_active | truefalse}","True / False",    "Capitalized boolean"],
                ["{has_warranty | checkmark}", "✓ / ✗",       "Checkmark symbol"],
                ["{enabled | onoff}",      "On / Off",        "On/Off toggle label"],
              ]} />
            </Sub>

            <Sub title="Fallback / Default">
              <Code>{`{middle_name | default:N/A}
  → "N/A" if middle_name is null, undefined, or empty string

{discount | currency | default:No discount}
  → Chains: format as currency first, then fallback if result is empty`}</Code>
            </Sub>

            <Sub title="Chaining Formatters">
              <Code>{`{amount | currency:USD | default:TBD}
{company_name | uppercase | truncate:30}
{rate | percent:1}`}</Code>
              <p className="text-xs text-gray-500">Formatters are applied left to right.</p>
            </Sub>
          </Section>

          <Section title="Loops / Arrays" id="loops">
            <p className="text-sm text-gray-600 mb-3">
              To repeat rows in a table (or paragraphs), wrap them with loop tags.
              Inside the loop, field names are relative to each item — no prefix needed.
            </p>

            <Sub title="Table loop (most common)">
              <p className="text-xs text-gray-500 mb-2">In Word, create a table with a header row and one data row. Place the loop tags in dedicated rows:</p>
              <Code>{`In Word — your table looks like this:
┌──────────────────┬──────────┬────────────────┬──────────────┐
│ Description      │ Qty      │ Unit Price     │ Total        │
├──────────────────┼──────────┼────────────────┼──────────────┤
│ {#line_items}    │          │                │              │
├──────────────────┼──────────┼────────────────┼──────────────┤
│ {description}    │ {qty}    │ {price|currency}│ {total|currency}│
├──────────────────┼──────────┼────────────────┼──────────────┤
│ {/line_items}    │          │                │              │
└──────────────────┴──────────┴────────────────┴──────────────┘

Data:
  {
    "line_items": [
      { "description": "Consulting",  "qty": 10, "price": 500,  "total": 5000  },
      { "description": "Setup Fee",   "qty": 1,  "price": 1500, "total": 1500  },
      { "description": "Support Plan","qty": 12, "price": 200,  "total": 2400  }
    ]
  }

Result: 3 data rows are generated, header stays once.`}</Code>
            </Sub>

            <Sub title="Paragraph loop">
              <Code>{`{#attendees}
  - {name} ({email})
{/attendees}

Data: { "attendees": [{"name": "Alice", "email": "alice@co.com"}, {"name": "Bob", "email": "bob@co.com"}] }

Result:
  - Alice (alice@co.com)
  - Bob (bob@co.com)`}</Code>
            </Sub>

            <Sub title="Simple value arrays">
              <Code>{`{#tags}{.}, {/tags}

Data: { "tags": ["urgent", "legal", "signed"] }
Result: urgent, legal, signed,`}</Code>
            </Sub>

            <Sub title="Nested loops">
              <Code>{`{#sections}
Section: {title}
{#items}
  • {name}: {value}
{/items}
{/sections}`}</Code>
            </Sub>

            <Warn>
              The loop start tag <code className="font-mono">{"{#array_key}"}</code> and end tag <code className="font-mono">{"{/array_key}"}</code> must be in their own table rows (for table loops) or own paragraphs (for paragraph loops). Do not put them inline with content.
            </Warn>
          </Section>

          <Section title="Conditionals" id="conditions">
            <p className="text-sm text-gray-600 mb-3">
              Show or hide entire sections based on whether a field is truthy or falsy.
            </p>

            <Sub title="Show if true">
              <Code>{`{#is_premium}
This agreement includes our Premium SLA with 99.9% uptime guarantee.
{/is_premium}

Data: { "is_premium": true }  → section is shown
Data: { "is_premium": false } → section is hidden`}</Code>
            </Sub>

            <Sub title="Show if false / empty (inverse)">
              <Code>{`{^discount_applied}
No discount has been applied to this order.
{/discount_applied}

→ Shown only when discount_applied is false, null, 0, or empty string.`}</Code>
            </Sub>

            <Sub title="If / Else pattern">
              <Code>{`{#is_company}
This agreement is between {company_name} (the "Client")
{/is_company}
{^is_company}
This agreement is between {first_name} {last_name} (the "Client")
{/is_company}`}</Code>
            </Sub>
          </Section>

          <Section title="Workflow Node" id="workflow">
            <p className="text-sm text-gray-600 mb-3">
              Use the <strong>Generate Document</strong> node in any scenario to merge data into a template automatically.
            </p>

            <Sub title="Node configuration">
              <Code>{`Node: Generate Document

Fields:
  Template     → pick a template from Doc Composer
  Output Name  → e.g. "Invoice_{{trigger.invoice_number}}.docx"
  Data         → JSON object — supports {{variable}} interpolation

Example Data field:
  {
    "customer_name": "{{trigger.customer_name}}",
    "invoice_number": "{{trigger.invoice_id}}",
    "amount": {{trigger.total}},
    "items": {{trigger.line_items}},
    "issue_date": "{{trigger.created_at}}",
    "due_date": "{{trigger.due_date}}"
  }`}</Code>
            </Sub>

            <Sub title="Node outputs">
              <Code>{`{
  "document_url":  "https://...signed-url-to-download...",
  "document_id":   "uuid of the generated_docs record",
  "output_path":   "org_id/template_id/timestamp_filename.docx",
  "file_size":     12345
}

Use in next nodes:
  {{generate_doc_node_id.document_url}}  → pass to email attachment
  {{generate_doc_node_id.document_url}}  → pass to Send for Signature node`}</Code>
            </Sub>

            <Sub title="Full example flow">
              <Code>{`Trigger: Webhook (new contract request)
  ↓
Action: Generate Document
  Template: "Service Agreement v3.docx"
  Data: {
    "client_name":    "{{trigger.body.client_name}}",
    "service":        "{{trigger.body.service_type}}",
    "amount":         {{trigger.body.amount}},
    "start_date":     "{{trigger.body.start_date}}",
    "line_items":     {{trigger.body.line_items}}
  }
  ↓
Action: Send for Signature
  Document URL: {{generate_doc.document_url}}
  Signer Email: {{trigger.body.client_email}}
  ↓
Action: Send Email
  To: {{trigger.body.account_manager_email}}
  Subject: "Contract sent to {{trigger.body.client_name}}"
  Template: "Workflow Notification"`}</Code>
            </Sub>
          </Section>

          <Section title="API Reference" id="api">
            <Sub title="List templates">
              <Code>{`GET /api/doc-templates
Authorization: session cookie

Response:
  [{ "id", "name", "category", "file_name", "detected_fields", "usage_count", ... }]`}</Code>
            </Sub>

            <Sub title="Upload template">
              <Code>{`POST /api/doc-templates
Content-Type: multipart/form-data

Fields:
  file        — .docx file (required)
  name        — display name
  description — optional
  category    — general | contract | invoice | hr | legal | proposal | nda | offer-letter

Response:
  { "id", "name", "detected_fields", ... }`}</Code>
            </Sub>

            <Sub title="Generate document">
              <Code>{`POST /api/doc-templates/{id}/generate
Content-Type: application/json

Body:
  {
    "data": {
      "customer_name": "Acme Corp",
      "amount": 50000,
      "items": [
        { "name": "Service A", "price": 25000 },
        { "name": "Service B", "price": 25000 }
      ]
    },
    "output_name": "Acme_Agreement.docx",   // optional
    "preview": false                          // true = download directly, not saved
  }

Response (preview: false):
  {
    "id":           "generated-doc-uuid",
    "document_url": "https://...signed-url (1 hour)...",
    "output_path":  "org_id/.../filename.docx",
    "file_size":    12345,
    "warnings":     []
  }

Response (preview: true):
  Binary DOCX file download`}</Code>
            </Sub>

            <Sub title="Get detected fields">
              <Code>{`GET /api/doc-templates/{id}/fields

Response:
  [
    { "key": "customer_name",          "path": "customer_name", "formatter": "",         "kind": "field"      },
    { "key": "amount | currency:USD",  "path": "amount",        "formatter": "currency:USD", "kind": "field" },
    { "key": "#line_items",            "path": "line_items",    "formatter": "",         "kind": "loop_start" },
    { "key": "/line_items",            "path": "line_items",    "formatter": "",         "kind": "loop_end"   },
    { "key": "#is_premium",            "path": "is_premium",    "formatter": "",         "kind": "condition_if"}
  ]`}</Code>
            </Sub>

            <Sub title="Generation history">
              <Code>{`GET /api/doc-templates/{id}/history

Response:
  [{ "id", "name", "file_size", "status", "merge_data", "created_at" }]`}</Code>
            </Sub>
          </Section>

        </div>
      </div>
    </div>
  );
}
