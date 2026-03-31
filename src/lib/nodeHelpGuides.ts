/**
 * Per-node help guides shown in the NodeConfigPanel.
 * Each entry has a short "what it does" summary, setup steps, and tips.
 */

export interface NodeHelpGuide {
  summary: string;
  steps: string[];
  tips?: string[];
  outputFields?: { field: string; description: string }[];
}

export const NODE_HELP_GUIDES: Record<string, NodeHelpGuide> = {
  // ── Triggers ────────────────────────────────────────────────────────────────

  trigger_manual: {
    summary: "Starts the workflow immediately when you click Run in the dashboard. Great for testing and one-off jobs.",
    steps: ["No configuration needed.", "Click the Run button on the workflow card to execute."],
    tips: ["Use this trigger while building to verify your actions work correctly before switching to an automated trigger."],
  },

  trigger_webhook: {
    summary: "Starts the workflow whenever an HTTP POST request is sent to the auto-generated webhook URL.",
    steps: [
      "Copy the Webhook URL shown in this panel.",
      "Paste it into the external service (GitHub, Stripe, etc.) as a webhook endpoint.",
      "The request body is available as {{nodeId.body}} in downstream nodes.",
    ],
    tips: [
      "Use {{nodeId.body.fieldName}} to access specific JSON fields from the payload.",
      "Add a secret query param to the URL for basic security: ?secret=yourtoken",
    ],
    outputFields: [
      { field: "body", description: "Parsed JSON request body" },
      { field: "headers", description: "Request headers" },
      { field: "method", description: "HTTP method (POST/GET/etc.)" },
      { field: "query", description: "URL query parameters" },
    ],
  },

  trigger_schedule: {
    summary: "Runs the workflow automatically on a cron schedule (hourly, daily, weekly, etc.).",
    steps: [
      "Choose a frequency using the schedule builder.",
      "For advanced schedules, switch to Custom and enter a cron expression.",
    ],
    tips: [
      "Cron format: minute hour day-of-month month day-of-week",
      "Example: '0 9 * * 1' = every Monday at 9am",
      "Times are UTC. Add your offset — e.g. UTC+5:30 → subtract 5.5 hours.",
    ],
  },

  trigger_interval: {
    summary: "Runs the workflow repeatedly at a fixed interval (every N minutes/hours).",
    steps: ["Set the interval value and unit.", "The workflow runs continuously at that cadence."],
    tips: ["Minimum interval is 1 minute.", "For short intervals, ensure your actions complete quickly to avoid overlap."],
  },

  trigger_form: {
    summary: "Generates a hosted form. When a user submits it, the workflow starts with the form data.",
    steps: [
      "Add form fields using the field builder below.",
      "Copy the Form URL and share it with users.",
      "Field values are available as {{nodeId.fieldName}} in downstream nodes.",
    ],
    tips: ["Mark fields as required to prevent empty submissions.", "Supports text, email, number, textarea, and select types."],
    outputFields: [
      { field: "name", description: "Value of the 'name' field (if present)" },
      { field: "email", description: "Value of the 'email' field (if present)" },
      { field: "submitted_at", description: "ISO timestamp of submission" },
    ],
  },

  trigger_webhook_response: {
    summary: "Listens for a webhook and lets you send a custom HTTP response back to the caller.",
    steps: [
      "Connect the trigger to your action nodes.",
      "Add a Webhook Response action at the end to control the HTTP response.",
    ],
  },

  trigger_agent: {
    summary: "Exposes this workflow as a tool that your AI agents can call. The agent decides when to invoke it based on the description you provide.",
    steps: [
      "Set a clear Tool Name (snake_case, e.g. lookup_customer).",
      "Write a detailed description so the AI knows when to use it.",
      "Describe the expected input — the agent will pass this as {{query}}.",
    ],
    tips: [
      "Be specific in the description — the AI uses it to decide whether to invoke this workflow.",
      "Use {{query}} in downstream nodes to access the value the agent passed.",
      "Add an Agent Reply node at the end to return a response to the agent.",
    ],
    outputFields: [
      { field: "query", description: "The input the agent provided" },
    ],
  },

  trigger_github_event: {
    summary: "Triggers the workflow when a GitHub event occurs (push, pull request, issue, etc.).",
    steps: [
      "Add your GitHub webhook URL in your repo Settings → Webhooks.",
      "Select which events to send.",
      "Filter by event type using an If/Else node downstream.",
    ],
    outputFields: [
      { field: "event", description: "GitHub event type (push, pull_request, etc.)" },
      { field: "repository", description: "Repository full name" },
      { field: "sender", description: "Actor who triggered the event" },
    ],
  },

  trigger_stripe: {
    summary: "Triggers when a Stripe event fires (payment succeeded, subscription created, etc.).",
    steps: [
      "Copy the webhook URL and add it in your Stripe Dashboard → Webhooks.",
      "Select which Stripe events to listen for.",
    ],
    outputFields: [
      { field: "type", description: "Stripe event type (e.g. payment_intent.succeeded)" },
      { field: "id", description: "Stripe event ID" },
      { field: "customer", description: "Customer ID (if applicable)" },
    ],
  },

  trigger_email_inbound: {
    summary: "Starts the workflow when an inbound email is received.",
    steps: ["Configure your email provider to forward to the inbound address shown.", "Sender, subject, and body are available as outputs."],
    outputFields: [
      { field: "from", description: "Sender email" },
      { field: "subject", description: "Email subject line" },
      { field: "body", description: "Email body text" },
    ],
  },

  trigger_rss_poll: {
    summary: "Polls an RSS/Atom feed on a schedule and triggers for each new item.",
    steps: ["Enter the RSS feed URL.", "Set the polling interval.", "Use downstream nodes to process each new item."],
    outputFields: [
      { field: "title", description: "Item title" },
      { field: "link", description: "Item URL" },
      { field: "pubDate", description: "Published date" },
    ],
  },

  // ── Actions: Flow Control ───────────────────────────────────────────────────

  action_if_else: {
    summary: "Splits the workflow into two branches based on a condition. True branch runs when the condition matches, False branch otherwise.",
    steps: [
      "Enter a condition expression in the Condition field.",
      "Use comparison operators: ==, !=, >, <, >=, <=, contains, startsWith",
      "Reference upstream values with {{nodeId.field}}.",
      "Connect the green handle to the 'true' path, red handle to 'false'.",
    ],
    tips: [
      "Example condition: {{node1.status}} == 'active'",
      "String comparisons are case-sensitive by default.",
      "Use contains for substring checks: {{node1.email}} contains '@gmail'",
    ],
  },

  action_switch: {
    summary: "Routes the workflow to one of up to 4 branches based on a value match. Like a multi-case If/Else.",
    steps: [
      "Enter the value to switch on.",
      "Define up to 4 case values — each gets its own output handle.",
      "Connect the Default handle for when no case matches.",
    ],
  },

  action_filter: {
    summary: "Stops the workflow run if the condition is false. Use this to gate execution on a specific condition.",
    steps: [
      "Enter the condition. If it evaluates to true, execution continues.",
      "If false, the run stops at this node (marked as 'skipped').",
    ],
    tips: ["Use this instead of If/Else when you only care about the true path."],
  },

  action_delay: {
    summary: "Pauses the workflow for a specified duration before continuing.",
    steps: ["Set the delay amount and unit (seconds, minutes, hours).", "Execution resumes automatically after the delay."],
    tips: ["Max delay is 24 hours.", "Use delays for rate limiting, scheduled follow-ups, or waiting for external processes."],
  },

  action_iterator: {
    summary: "Loops over each item in an array, running the connected nodes once per item.",
    steps: [
      "Set the Items field to an array value: {{nodeId.rows}}",
      "Connect downstream nodes — they receive {{nodeId.item}} for the current element.",
      "{{nodeId.index}} gives the 0-based position, {{nodeId.total}} the array length.",
    ],
    tips: ["Nest iterators for multi-dimensional data.", "Use a Filter node inside to skip certain items."],
    outputFields: [
      { field: "item", description: "Current array element" },
      { field: "index", description: "Current index (0-based)" },
      { field: "total", description: "Total items in array" },
    ],
  },

  action_set_variable: {
    summary: "Saves a named value into workflow memory. Any node that runs after this one can reference it using {{variables.yourName}}.",
    steps: [
      "Enter a Variable Name — use a short name with no spaces (e.g. customerEmail, orderId, recipientName).",
      "Enter the Value — static text or a merge field from earlier nodes, e.g. {{trigger.email}}.",
      "In any downstream node, reference this variable as {{variables.customerEmail}} — works in any text, subject, body, or URL field.",
    ],
    tips: [
      "Example — Send Email Manually: Set Variable name=toEmail value={{trigger.email}} → Email node To={{variables.toEmail}}",
      "You do NOT need a Get Variable node — just write {{variables.yourName}} directly in any field after this node runs.",
      "Use multiple Set Variable nodes before a complex action to build up all the values you need.",
      "Variables reset each workflow run — they are not persisted between executions.",
    ],
  },

  action_get_variable: {
    summary: "Reads a workflow variable by name. Useful for conditional branching or logging. You usually don't need this — just write {{variables.yourName}} directly in any field.",
    steps: [
      "Enter the Variable Name set by a Set Variable node earlier in the flow.",
      "Optionally enter a Default value returned if the variable was never set.",
      "The value is available downstream as {{nodeId.value}}.",
    ],
    tips: [
      "Skip this node when you just want to use the value — {{variables.yourName}} works directly in any text field.",
      "Use Get Variable when you need to feed its value into an If/Else condition.",
    ],
  },

  action_merge: {
    summary: "Waits for multiple upstream branches to complete, then merges their outputs into a single object.",
    steps: ["Connect multiple source handles to this node's input.", "The merged output contains all branch results."],
  },

  action_sub_workflow: {
    summary: "Runs another workflow as a step within this workflow. Useful for reusing logic across multiple flows.",
    steps: [
      "Select the sub-workflow to run.",
      "Pass data to it via the trigger_data field.",
      "The sub-workflow's result is available in {{nodeId.output}}.",
    ],
    tips: ["Sub-workflows run synchronously — the parent waits for them to finish."],
  },

  action_webhook_response: {
    summary: "Sends an HTTP response back to the caller of a Webhook trigger. Must be used with the Webhook trigger.",
    steps: ["Set the response body (can use merge fields).", "Set the HTTP status code (200 for success, 4xx for errors).", "This node must complete for the webhook caller to receive a response."],
  },

  action_agent_reply: {
    summary: "Returns a response back to the AI agent that invoked this workflow. Used with the Agent Invoke trigger.",
    steps: [
      "Set the message to return. Use {{nodeId.field}} to reference upstream outputs.",
      "The agent will receive this as the tool result and can use it in its response.",
    ],
    tips: ["Be concise — the agent incorporates this into its answer.", "Return structured data (JSON) when the agent needs to display multiple fields."],
  },

  // ── Actions: HTTP / Integrations ───────────────────────────────────────────

  action_http: {
    summary: "Makes an HTTP request to any external API endpoint.",
    steps: [
      "Set the Method (GET, POST, PUT, PATCH, DELETE).",
      "Enter the full URL. Use {{nodeId.field}} for dynamic values.",
      "For POST/PUT, set the Content-Type header and request body.",
      "Add authentication headers (e.g. Authorization: Bearer {{token}}).",
    ],
    tips: [
      "Set Content-Type: application/json for JSON APIs.",
      "Response body is in {{nodeId.body}}, status in {{nodeId.status}}.",
      "Use a Transform node afterward to extract specific fields.",
    ],
    outputFields: [
      { field: "status", description: "HTTP response status code" },
      { field: "body", description: "Parsed response body" },
      { field: "headers", description: "Response headers" },
    ],
  },

  // ── Actions: Messaging ──────────────────────────────────────────────────────

  action_email: {
    summary: "Sends an email via the configured email provider.",
    steps: ["Set To, Subject, and Body fields.", "Use {{nodeId.field}} for dynamic content.", "The Body field supports plain text or HTML."],
    outputFields: [{ field: "message_id", description: "Sent message ID" }],
  },

  action_slack: {
    summary: "Posts a message to a Slack channel or user.",
    steps: ["Select or create a Slack connection.", "Set the channel (#channel-name or @username).", "Write the message — supports Slack markdown."],
    tips: ["Use :emoji: codes for emojis.", "Set the username and icon_emoji fields for custom bot names."],
    outputFields: [{ field: "ts", description: "Message timestamp (for threading)" }],
  },

  action_discord: {
    summary: "Sends a message to a Discord channel via webhook.",
    steps: ["Get a webhook URL from your Discord server (Channel Settings → Integrations).", "Paste the webhook URL in the connection.", "Write your message."],
  },

  action_telegram: {
    summary: "Sends a message to a Telegram chat or channel.",
    steps: ["Create a bot with @BotFather and copy the token.", "Get the chat ID (send a message to your bot and check the webhook).", "Configure the connection and set the message."],
  },

  // ── Actions: Data ───────────────────────────────────────────────────────────

  action_transform: {
    summary: "Transforms data from upstream nodes using a JavaScript expression.",
    steps: [
      "Write a JS expression that returns the transformed value.",
      "Access upstream data via the data object: data['nodeId'].field",
      "Return any value — object, array, string, number.",
    ],
    tips: [
      "Example: JSON.stringify(data['node1'].body)",
      "Use for reshaping API responses, combining fields, or formatting dates.",
    ],
    outputFields: [{ field: "result", description: "The transformed value" }],
  },

  action_code: {
    summary: "Runs arbitrary JavaScript (Node.js) code with access to all upstream node outputs.",
    steps: [
      "Write your code in the editor.",
      "Access upstream outputs via: const input = data['nodeId'];",
      "Return a value with: return { key: value };",
    ],
    tips: [
      "You can use common Node.js globals (JSON, Math, Date, etc.).",
      "Return an object — fields become available as {{nodeId.fieldName}}.",
      "Async/await is supported.",
    ],
    outputFields: [{ field: "result", description: "Your returned value" }],
  },

  action_formatter: {
    summary: "Formats text, numbers, and dates using built-in formatters — no code required.",
    steps: ["Select the data type (text/number/date).", "Choose a format operation.", "Set the input value using a merge field."],
  },

  action_csv_parse: {
    summary: "Parses a CSV string into a structured array of row objects.",
    steps: ["Set the CSV field to the raw CSV text (e.g. from an HTTP response or email body).", "Optionally set delimiter (default: comma).", "Rows are available as {{nodeId.rows}}."],
    outputFields: [
      { field: "rows", description: "Array of row objects" },
      { field: "headers", description: "Column header names" },
      { field: "rowCount", description: "Number of data rows" },
    ],
  },

  action_csv_generate: {
    summary: "Generates a CSV string from an array of objects.",
    steps: ["Set the Rows field to an array: {{nodeId.rows}}", "Optionally set headers.", "The output CSV string is in {{nodeId.csv}}."],
  },

  // ── Actions: AI ─────────────────────────────────────────────────────────────

  action_openai: {
    summary: "Calls the OpenAI Chat Completions API with a custom prompt.",
    steps: [
      "Add your OpenAI API key (or use a saved connection).",
      "Select the model (gpt-4o-mini is fastest and cheapest).",
      "Write a System prompt and User message. Use {{nodeId.field}} for dynamic content.",
    ],
    tips: [
      "The System prompt defines the AI's role and constraints.",
      "For JSON output, add 'Respond with valid JSON only' to the system prompt.",
      "Response text is in {{nodeId.text}}.",
    ],
    outputFields: [{ field: "text", description: "Model's response text" }],
  },

  action_claude: {
    summary: "Calls the Anthropic Claude API with a custom prompt.",
    steps: ["Add your Anthropic API key.", "Select the model (Haiku is fastest, Opus is most capable).", "Set the System and User prompts."],
    outputFields: [{ field: "text", description: "Claude's response text" }],
  },

  // ── Actions: Databases ──────────────────────────────────────────────────────

  action_user_table: {
    summary: "Read, insert, update, or delete rows in one of your My Tables.",
    steps: [
      "Select the table and operation (query/insert/update/delete).",
      "For query: set filter conditions to find matching rows.",
      "For insert: map field values (use {{nodeId.field}} for dynamic data).",
      "For update: set the filter to identify the row, then the fields to change.",
    ],
    tips: [
      "Query returns an array of matching rows in {{nodeId.rows}}.",
      "Use an Iterator node after a query to process each result.",
      "Filters support: equals, contains, greater than, less than.",
    ],
    outputFields: [
      { field: "rows", description: "Matched rows (for query)" },
      { field: "count", description: "Number of rows matched or affected" },
      { field: "row", description: "Inserted/updated row data" },
    ],
  },

  action_postgres: {
    summary: "Executes a SQL query against a PostgreSQL database.",
    steps: ["Select or create a Postgres connection.", "Write your SQL query.", "Use $1, $2 placeholders for dynamic values (listed as Params)."],
    tips: ["Use SELECT for reads, INSERT/UPDATE/DELETE for writes.", "Params prevent SQL injection — always use them for user input."],
    outputFields: [
      { field: "rows", description: "Query result rows" },
      { field: "rowCount", description: "Number of rows returned/affected" },
    ],
  },

  action_supabase_db: {
    summary: "Reads or writes data in a Supabase table using the Supabase client.",
    steps: ["Add your Supabase URL and service key.", "Select the operation (select/insert/update/delete).", "Set table name and filter/data fields."],
    outputFields: [{ field: "data", description: "Query result data" }],
  },

  // ── Actions: Google ─────────────────────────────────────────────────────────

  action_sheets: {
    summary: "Reads or writes data in a Google Sheets spreadsheet.",
    steps: ["Connect your Google account.", "Enter the Spreadsheet ID (from the URL) and sheet name.", "For read: values are returned as {{nodeId.values}}. For write: set the range and values."],
    outputFields: [{ field: "values", description: "Cell values from the sheet" }],
  },

  action_google_calendar: {
    summary: "Creates or reads events in Google Calendar.",
    steps: ["Connect your Google account.", "Set the calendar ID (usually your email).", "Set the event title, start/end times (ISO format), and optional description."],
    outputFields: [{ field: "id", description: "Event ID" }, { field: "link", description: "Event URL" }],
  },

  action_google_drive: {
    summary: "Uploads, downloads, or manages files in Google Drive.",
    steps: ["Connect your Google account.", "Select the operation.", "For upload: set the file name and content (base64 or text)."],
    outputFields: [{ field: "id", description: "File ID" }, { field: "url", description: "Shareable file URL" }],
  },

  // ── Actions: Project Management ─────────────────────────────────────────────

  action_notion: {
    summary: "Creates pages or reads data from Notion databases.",
    steps: ["Connect your Notion integration (Settings → My integrations in Notion).", "Share the database/page with your integration.", "Set the database ID and properties."],
    tips: ["Notion database IDs are 32-character strings from the page URL.", "Properties must match the exact column names in your Notion database."],
  },

  action_github: {
    summary: "Interacts with GitHub — create issues, PRs, comments, and more.",
    steps: ["Add a GitHub personal access token.", "Set the owner/repo and operation.", "Use merge fields for dynamic content."],
  },

  action_jira: {
    summary: "Creates or updates Jira issues in your project.",
    steps: ["Add your Jira domain, email, and API token.", "Set the project key and issue type.", "Map fields: summary, description, priority, assignee."],
  },

  action_linear: {
    summary: "Creates or updates issues in Linear.",
    steps: ["Add your Linear API key.", "Set the team ID and issue details.", "Title and description support merge fields."],
  },

  // ── Utilities ───────────────────────────────────────────────────────────────

  action_datetime: {
    summary: "Parses, formats, and manipulates dates and times.",
    steps: ["Set the input date (ISO string or Unix timestamp).", "Choose the operation (format, add, subtract, diff).", "Formatted result is in {{nodeId.formatted}}."],
    outputFields: [
      { field: "iso", description: "ISO 8601 formatted date" },
      { field: "unix", description: "Unix timestamp (seconds)" },
      { field: "formatted", description: "Human-readable formatted date" },
    ],
  },

  action_math: {
    summary: "Performs mathematical calculations.",
    steps: ["Enter an expression using standard operators: + - * / % ** sqrt round floor ceil.", "Reference upstream values: {{nodeId.amount}} * 1.2", "Result is in {{nodeId.result}}."],
  },

  action_xml: {
    summary: "Parses XML to JSON or builds XML from a JSON object.",
    steps: ["For parse: set the XML string input.", "For build: provide a JSON object to convert.", "Parsed result is a JSON object in {{nodeId.result}}."],
  },

  action_crypto: {
    summary: "Encrypts, decrypts, hashes, and generates random values.",
    steps: ["Select the operation (hash, hmac, encrypt, decrypt, random).", "Set the algorithm (SHA-256, AES-256, etc.).", "Set the key for encryption operations."],
  },

  action_jwt: {
    summary: "Signs or verifies JSON Web Tokens (JWTs).",
    steps: ["For sign: set the payload JSON and secret key.", "For verify: set the token and secret to validate.", "Signed token is in {{nodeId.token}}."],
    outputFields: [
      { field: "token", description: "Signed JWT string" },
      { field: "payload", description: "Decoded JWT payload (for verify)" },
    ],
  },

  action_pdf: {
    summary: "Generates a PDF from HTML content.",
    steps: ["Write HTML in the Content field. Use merge fields for dynamic data.", "The generated PDF is returned as base64 in {{nodeId.base64}}.", "Optionally set page size and margins."],
  },

  action_qrcode: {
    summary: "Generates a QR code image from any text or URL.",
    steps: ["Set the data to encode (URL, text, vCard, etc.).", "Choose output format (PNG base64 or SVG).", "Image is in {{nodeId.base64}} or {{nodeId.svg}}."],
  },

  action_image: {
    summary: "Resizes, crops, converts, or manipulates images.",
    steps: ["Provide the image as base64 or URL.", "Select the operation (resize, crop, convert, etc.).", "Set dimensions and output format."],
  },

  // ── MCP ─────────────────────────────────────────────────────────────────────

  action_mcp_tool: {
    summary: "Calls a tool exposed by an MCP (Model Context Protocol) server.",
    steps: ["Enter the MCP server URL.", "Set the tool name to invoke.", "Pass arguments as a JSON object.", "Result is in {{nodeId.result}}."],
    tips: ["MCP servers expose tools that extend AI capabilities.", "Common uses: search, code execution, file access, API calls."],
    outputFields: [{ field: "result", description: "Tool execution result" }],
  },
};
