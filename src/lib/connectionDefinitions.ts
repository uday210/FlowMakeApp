export interface ConnectionFieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface ConnectionDef {
  type: string;
  label: string;
  description: string;
  color: string;
  icon: string; // lucide icon name
  fields: ConnectionFieldDef[];
}

export const CONNECTION_DEFINITIONS: ConnectionDef[] = [
  {
    type: "salesforce",
    label: "Salesforce",
    description: "Connect a Salesforce org (production, sandbox, or custom domain)",
    color: "#00a1e0",
    icon: "Cloud",
    fields: [
      {
        key: "auth_flow",
        label: "Auth Flow",
        type: "select",
        required: true,
        options: [
          { label: "Username + Password", value: "password" },
          { label: "Client Credentials (no user)", value: "client_credentials" },
        ],
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        required: true,
        options: [
          { label: "Production (login.salesforce.com)", value: "production" },
          { label: "Sandbox (test.salesforce.com)", value: "sandbox" },
          { label: "Custom Domain", value: "custom" },
        ],
      },
      {
        key: "login_url",
        label: "Custom Login URL",
        type: "text",
        placeholder: "https://mycompany.my.salesforce.com",
      },
      { key: "client_id", label: "Consumer Key", type: "text", placeholder: "3MVG9...", required: true },
      { key: "client_secret", label: "Consumer Secret", type: "password", placeholder: "...", required: true },
      { key: "username", label: "Username (password flow only)", type: "text", placeholder: "user@example.com" },
      { key: "password", label: "Password (password flow only)", type: "password", placeholder: "yourpassword" },
      { key: "security_token", label: "Security Token (password flow only)", type: "password", placeholder: "token appended to password" },
    ],
  },
  {
    type: "slack",
    label: "Slack",
    description: "Slack incoming webhook",
    color: "#4a154b",
    icon: "MessageSquare",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "password", placeholder: "https://hooks.slack.com/services/...", required: true },
    ],
  },
  {
    type: "discord",
    label: "Discord",
    description: "Discord webhook",
    color: "#5865f2",
    icon: "Hash",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "password", placeholder: "https://discord.com/api/webhooks/...", required: true },
    ],
  },
  {
    type: "telegram",
    label: "Telegram",
    description: "Telegram bot",
    color: "#0088cc",
    icon: "Send",
    fields: [
      { key: "bot_token", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF...", required: true },
    ],
  },
  {
    type: "openai",
    label: "OpenAI",
    description: "OpenAI API key",
    color: "#10a37f",
    icon: "Sparkles",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "sk-...", required: true },
    ],
  },
  {
    type: "claude",
    label: "Anthropic (Claude)",
    description: "Anthropic API key",
    color: "#d97706",
    icon: "Bot",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "sk-ant-...", required: true },
    ],
  },
  {
    type: "github",
    label: "GitHub",
    description: "GitHub personal access token",
    color: "#24292e",
    icon: "GitBranch",
    fields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "ghp_...", required: true },
    ],
  },
  {
    type: "airtable",
    label: "Airtable",
    description: "Airtable personal access token",
    color: "#18bfff",
    icon: "Table2",
    fields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "pat...", required: true },
    ],
  },
  {
    type: "notion",
    label: "Notion",
    description: "Notion integration token",
    color: "#000000",
    icon: "BookOpen",
    fields: [
      { key: "token", label: "Integration Token", type: "password", placeholder: "secret_...", required: true },
    ],
  },
  {
    type: "sendgrid",
    label: "SendGrid",
    description: "SendGrid API key + sender address",
    color: "#1a82e2",
    icon: "MailCheck",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "SG.xxx", required: true },
      { key: "from", label: "Default From Email", type: "text", placeholder: "you@example.com", required: true },
    ],
  },
  {
    type: "resend",
    label: "Resend",
    description: "Resend API key + sender address",
    color: "#000000",
    icon: "Send",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "re_xxxxxxxxxxxx", required: true },
      { key: "from", label: "Default From Email", type: "text", placeholder: "you@yourdomain.com", required: true },
    ],
  },
  {
    type: "mailgun",
    label: "Mailgun",
    description: "Mailgun API key, domain, and sender address",
    color: "#e9000b",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", required: true },
      { key: "domain", label: "Mailgun Domain", type: "text", placeholder: "mg.yourdomain.com", required: true },
      { key: "from", label: "Default From Email", type: "text", placeholder: "you@mg.yourdomain.com", required: true },
    ],
  },
  {
    type: "postmark",
    label: "Postmark",
    description: "Postmark server token + sender address",
    color: "#ffde00",
    icon: "ArrowUpRight",
    fields: [
      { key: "server_token", label: "Server API Token", type: "password", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "from", label: "Default From Email", type: "text", placeholder: "you@yourdomain.com", required: true },
    ],
  },
  {
    type: "twilio",
    label: "Twilio",
    description: "Twilio account for SMS",
    color: "#f22f46",
    icon: "Phone",
    fields: [
      { key: "account_sid", label: "Account SID", type: "text", placeholder: "ACxxx", required: true },
      { key: "auth_token", label: "Auth Token", type: "password", placeholder: "your auth token", required: true },
      { key: "from", label: "From Number", type: "text", placeholder: "+15551234567", required: true },
    ],
  },
  {
    type: "sheets",
    label: "Google Sheets",
    description: "Google Sheets OAuth access token",
    color: "#0f9d58",
    icon: "Sheet",
    fields: [
      { key: "access_token", label: "Access Token (OAuth)", type: "password", placeholder: "ya29...", required: true },
    ],
  },
  {
    type: "hubspot",
    label: "HubSpot",
    description: "HubSpot private app token",
    color: "#ff7a59",
    icon: "Cloud",
    fields: [
      { key: "api_key", label: "Private App Token", type: "password", placeholder: "pat-na1-...", required: true },
    ],
  },
  {
    type: "jira",
    label: "Jira",
    description: "Jira Cloud instance credentials",
    color: "#0052cc",
    icon: "ClipboardList",
    fields: [
      { key: "domain", label: "Domain", type: "text", placeholder: "yourcompany.atlassian.net", required: true },
      { key: "email", label: "Email", type: "text", placeholder: "you@company.com", required: true },
      { key: "api_token", label: "API Token", type: "password", placeholder: "ATATT...", required: true },
    ],
  },
  {
    type: "linear",
    label: "Linear",
    description: "Linear API key",
    color: "#5e6ad2",
    icon: "GitBranch",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "lin_api_...", required: true },
    ],
  },
  {
    type: "stripe",
    label: "Stripe",
    description: "Stripe secret key",
    color: "#6772e5",
    icon: "CreditCard",
    fields: [
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "sk_live_...", required: true },
    ],
  },
  {
    type: "mailchimp",
    label: "Mailchimp",
    description: "Mailchimp API key",
    color: "#ffe01b",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "xxxx-us1", required: true },
      { key: "server_prefix", label: "Server Prefix", type: "text", placeholder: "us1", required: true },
    ],
  },
];

export const CONNECTION_DEF_MAP = Object.fromEntries(CONNECTION_DEFINITIONS.map((d) => [d.type, d]));
