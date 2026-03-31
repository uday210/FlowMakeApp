import Link from "next/link";

function Badge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET:  "bg-green-100 text-green-700",
    POST: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded font-mono ${colors[method] ?? "bg-gray-100 text-gray-600"}`}>
      {method}
    </span>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-950 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">
      <code>{children.trim()}</code>
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Field({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="w-40 flex-shrink-0">
        <code className="text-xs font-mono text-indigo-700">{name}</code>
        {required && <span className="ml-1 text-red-400 text-[10px]">*</span>}
      </div>
      <div className="w-24 flex-shrink-0 text-xs text-gray-400 font-mono">{type}</div>
      <div className="text-xs text-gray-600">{desc}</div>
    </div>
  );
}

export default function EsignApiDocs() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/documents" className="text-xs text-gray-400 hover:text-gray-600">← Documents</Link>
            </div>
            <h1 className="text-xl font-bold text-gray-900">E-Sign API Reference</h1>
            <p className="text-sm text-gray-500 mt-0.5">Send documents for signature programmatically via the REST API</p>
          </div>
          <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-200">
            v1
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* Overview */}
        <Section title="Overview">
          <p className="text-sm text-gray-600 leading-relaxed">
            The E-Sign API lets you send PDF documents for signature from your own applications.
            You can send to multiple signers in <strong>sequential</strong> order (each signer waits for the previous one)
            or in <strong>parallel</strong> (all signers receive the request simultaneously).
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Send documents", desc: "Create signing sessions with one API call" },
              { label: "Sequential signing", desc: "Enforce a signing order across multiple recipients" },
              { label: "Webhooks", desc: "Get notified when each signer completes" },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-800">{c.label}</p>
                <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Authentication */}
        <Section title="Authentication">
          <p className="text-sm text-gray-600">
            All API requests must include your API key in the <code className="bg-gray-100 px-1 rounded text-xs font-mono">X-API-Key</code> header.
            You can find your API key in <Link href="/settings" className="text-indigo-600 hover:underline">Settings → API Keys</Link>.
          </p>
          <Code>{`curl https://your-app.up.railway.app/api/v1/esign/send \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ ... }'`}</Code>
        </Section>

        {/* Send for signature */}
        <Section title="Send for Signature">
          <div className="flex items-center gap-3">
            <Badge method="POST" />
            <code className="text-sm font-mono text-gray-700">/api/v1/esign/send</code>
          </div>
          <p className="text-sm text-gray-600">
            Creates signing requests for a document and returns signing URLs for each recipient.
            The document must have been created and have fields placed via the dashboard first.
          </p>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Request Body</p>
            <div className="bg-white rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
              <Field name="document_id" type="string" required desc="UUID of the document to send. Create documents via the dashboard." />
              <Field name="signers" type="array" required desc="Array of signer objects (see below). Supports 1–10 signers." />
              <Field name="signers[].email" type="string" required desc="Email address of the signer." />
              <Field name="signers[].name" type="string" desc="Display name of the signer. Shown on the signing page." />
              <Field name="signers[].order" type="number" desc="Signing order (1, 2, 3…). Omit for parallel signing." />
              <Field name="signers[].role" type="string" desc="Role slot for template documents, e.g. 'Signer 1'." />
              <Field name="mode" type="string" desc="'sequential' (default) or 'parallel'. Auto-detected from order values." />
              <Field name="callback_url" type="string" desc="Webhook URL called when each signer completes." />
            </div>
          </div>

          <Code>{`// Sequential signing — signers sign in order 1 → 2
POST /api/v1/esign/send
{
  "document_id": "46051a5c-bfbc-4706-bcd8-5216849abd69",
  "signers": [
    { "email": "alice@example.com", "name": "Alice",  "order": 1 },
    { "email": "bob@example.com",   "name": "Bob",    "order": 2 }
  ],
  "callback_url": "https://your-app.com/webhooks/esign"
}`}</Code>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Response</p>
            <Code>{`{
  "session_id": "sess_abc123",
  "document_id": "46051a5c-bfbc-4706-bcd8-5216849abd69",
  "mode": "sequential",
  "signers": [
    {
      "id": "req_001",
      "email": "alice@example.com",
      "name": "Alice",
      "order": 1,
      "status": "pending",
      "signing_url": "https://your-app.up.railway.app/sign/tok_abc123"
    },
    {
      "id": "req_002",
      "email": "bob@example.com",
      "name": "Bob",
      "order": 2,
      "status": "waiting",
      "signing_url": "https://your-app.up.railway.app/sign/tok_def456"
    }
  ]
}`}</Code>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Sequential signing:</strong> Only the first signer&apos;s status is <code className="bg-amber-100 px-1 rounded text-xs">pending</code>.
            Each subsequent signer&apos;s status changes to <code className="bg-amber-100 px-1 rounded text-xs">pending</code> automatically
            when the previous signer completes.
          </div>
        </Section>

        {/* Session Status */}
        <Section title="Get Session Status">
          <div className="flex items-center gap-3">
            <Badge method="GET" />
            <code className="text-sm font-mono text-gray-700">/api/v1/esign/sessions/:session_id</code>
          </div>
          <p className="text-sm text-gray-600">
            Returns the current status of a signing session and all its signers.
          </p>
          <Code>{`GET /api/v1/esign/sessions/sess_abc123

// Response
{
  "session_id": "sess_abc123",
  "document_id": "46051a5c-bfbc-4706-bcd8-5216849abd69",
  "document_name": "Service Agreement",
  "completed": false,
  "signers": [
    {
      "id": "req_001",
      "email": "alice@example.com",
      "name": "Alice",
      "order": 1,
      "status": "signed",
      "signed_at": "2026-03-31T14:22:00Z",
      "signing_url": "https://your-app.up.railway.app/sign/tok_abc123"
    },
    {
      "id": "req_002",
      "email": "bob@example.com",
      "name": "Bob",
      "order": 2,
      "status": "pending",
      "signed_at": null,
      "signing_url": "https://your-app.up.railway.app/sign/tok_def456"
    }
  ]
}`}</Code>
        </Section>

        {/* Download */}
        <Section title="Download Signed PDF">
          <div className="flex items-center gap-3">
            <Badge method="GET" />
            <code className="text-sm font-mono text-gray-700">/api/v1/esign/sessions/:session_id/download</code>
          </div>
          <p className="text-sm text-gray-600">
            Downloads the fully signed PDF with all signatures embedded and a signing certificate page appended.
            Only available when all signers have completed.
          </p>
          <Code>{`GET /api/v1/esign/sessions/sess_abc123/download

// Returns: application/pdf binary`}</Code>
        </Section>

        {/* Webhook */}
        <Section title="Webhook Callback">
          <p className="text-sm text-gray-600">
            If you provided a <code className="bg-gray-100 px-1 rounded text-xs font-mono">callback_url</code> when creating the session,
            a <code className="bg-gray-100 px-1 rounded text-xs font-mono">POST</code> request is sent to that URL each time a signer completes.
          </p>
          <Code>{`// POST to your callback_url
{
  "event": "signer.completed",
  "session_id": "sess_abc123",
  "document_id": "46051a5c-bfbc-4706-bcd8-5216849abd69",
  "signer": {
    "email": "alice@example.com",
    "name": "Alice",
    "order": 1,
    "signed_at": "2026-03-31T14:22:00Z"
  },
  "all_completed": false
}`}</Code>
          <p className="text-sm text-gray-600">
            When the last signer completes, <code className="bg-gray-100 px-1 rounded text-xs font-mono">all_completed</code> is{" "}
            <code className="bg-gray-100 px-1 rounded text-xs font-mono">true</code> and the signed PDF is available for download.
          </p>
        </Section>

        {/* Code examples */}
        <Section title="Code Examples">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">JavaScript / Node.js</p>
          <Code>{`const response = await fetch("https://your-app.up.railway.app/api/v1/esign/send", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.FLOWMAKE_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_id: "46051a5c-bfbc-4706-bcd8-5216849abd69",
    signers: [
      { email: "alice@example.com", name: "Alice", order: 1 },
      { email: "bob@example.com",   name: "Bob",   order: 2 },
    ],
    callback_url: "https://your-app.com/webhooks/esign",
  }),
});

const { session_id, signers } = await response.json();
console.log("Session:", session_id);
console.log("Alice's link:", signers[0].signing_url);`}</Code>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6">cURL</p>
          <Code>{`curl -X POST https://your-app.up.railway.app/api/v1/esign/send \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "document_id": "46051a5c-bfbc-4706-bcd8-5216849abd69",
    "signers": [
      { "email": "alice@example.com", "name": "Alice", "order": 1 },
      { "email": "bob@example.com",   "name": "Bob",   "order": 2 }
    ]
  }'`}</Code>
        </Section>

        {/* Template mode */}
        <Section title="Template Documents">
          <p className="text-sm text-gray-600 leading-relaxed">
            Template documents have fields assigned to role slots (<strong>Signer 1</strong>, <strong>Signer 2</strong>, etc.)
            instead of specific emails. This lets you reuse the same document layout with different signers each time.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            To use a template, enable <strong>Template mode</strong> in the document editor, place fields on the role slots,
            then send via the API using the <code className="bg-gray-100 px-1 rounded text-xs font-mono">role</code> field:
          </p>
          <Code>{`{
  "document_id": "template-doc-id",
  "signers": [
    { "email": "client@company.com", "name": "Client",  "order": 1, "role": "Signer 1" },
    { "email": "lawyer@firm.com",    "name": "Counsel", "order": 2, "role": "Signer 2" }
  ]
}`}</Code>
        </Section>

      </div>
    </div>
  );
}
