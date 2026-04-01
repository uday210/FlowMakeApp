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
  // ── AI & ML ────────────────────────────────────────────────────────────────
  {
    type: "openai",
    label: "OpenAI",
    description: "OpenAI API key for GPT models and DALL-E",
    color: "#10a37f",
    icon: "Sparkles",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "sk-...", required: true },
    ],
  },
  {
    type: "anthropic",
    label: "Anthropic / Claude",
    description: "Anthropic API key for Claude models",
    color: "#d97706",
    icon: "Bot",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "sk-ant-...", required: true },
    ],
  },
  {
    type: "gemini",
    label: "Google Gemini",
    description: "Google AI Studio API key for Gemini models",
    color: "#4285f4",
    icon: "Sparkles",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "AIza...", required: true },
    ],
  },
  {
    type: "groq",
    label: "Groq",
    description: "Groq Cloud API key for ultra-fast inference",
    color: "#f55036",
    icon: "Zap",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "gsk_...", required: true },
    ],
  },
  {
    type: "mistral",
    label: "Mistral AI",
    description: "Mistral AI API key",
    color: "#ff7000",
    icon: "Bot",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "whisper",
    label: "Whisper (OpenAI)",
    description: "OpenAI API key for Whisper speech-to-text",
    color: "#10a37f",
    icon: "Mic",
    fields: [
      { key: "api_key", label: "OpenAI API Key", type: "password", placeholder: "sk-...", required: true },
    ],
  },
  {
    type: "cohere",
    label: "Cohere",
    description: "Cohere API key for text generation and embeddings",
    color: "#d18ee2",
    icon: "Sparkles",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "replicate",
    label: "Replicate",
    description: "Replicate API token for running AI models",
    color: "#000000",
    icon: "Server",
    fields: [
      { key: "api_token", label: "API Token", type: "password", placeholder: "r8_...", required: true },
    ],
  },
  {
    type: "huggingface",
    label: "Hugging Face",
    description: "Hugging Face API token for model inference",
    color: "#ff9d00",
    icon: "Sparkles",
    fields: [
      { key: "api_key", label: "API Token", type: "password", placeholder: "hf_...", required: true },
    ],
  },
  {
    type: "pinecone",
    label: "Pinecone",
    description: "Pinecone API key for vector database",
    color: "#2563eb",
    icon: "Database",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "weaviate",
    label: "Weaviate",
    description: "Weaviate vector database connection",
    color: "#b04a28",
    icon: "Database",
    fields: [
      { key: "host", label: "Host URL", type: "text", placeholder: "https://your-instance.weaviate.network", required: true },
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },

  // ── Email ──────────────────────────────────────────────────────────────────
  {
    type: "smtp",
    label: "SMTP",
    description: "Generic SMTP server credentials",
    color: "#3b82f6",
    icon: "Mail",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "smtp.example.com", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "587" },
      { key: "user", label: "Username", type: "text", placeholder: "you@example.com" },
      { key: "pass", label: "Password", type: "password", placeholder: "your password" },
    ],
  },
  {
    type: "sendgrid",
    label: "SendGrid",
    description: "SendGrid API key and sender address",
    color: "#1a82e2",
    icon: "MailCheck",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "SG.xxx", required: true },
      { key: "from", label: "From Email", type: "text", placeholder: "you@example.com", required: true },
    ],
  },
  {
    type: "resend",
    label: "Resend",
    description: "Resend API key and sender address",
    color: "#000000",
    icon: "Send",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "re_xxxxxxxxxxxx", required: true },
      { key: "from", label: "From Email", type: "text", placeholder: "you@yourdomain.com", required: true },
    ],
  },
  {
    type: "mailgun",
    label: "Mailgun",
    description: "Mailgun API key, domain, and sender address",
    color: "#e9000b",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "key-xxx", required: true },
      { key: "domain", label: "Domain", type: "text", placeholder: "mg.yourdomain.com", required: true },
      { key: "from", label: "From Email", type: "text", placeholder: "you@mg.yourdomain.com", required: true },
    ],
  },
  {
    type: "postmark",
    label: "Postmark",
    description: "Postmark server token and sender address",
    color: "#ffde00",
    icon: "ArrowUpRight",
    fields: [
      { key: "server_token", label: "Server Token", type: "password", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "from", label: "From Email", type: "text", placeholder: "you@yourdomain.com", required: true },
    ],
  },
  {
    type: "mailchimp",
    label: "Mailchimp",
    description: "Mailchimp API key and server prefix",
    color: "#ffe01b",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "xxxx-us1", required: true },
      { key: "server_prefix", label: "Server Prefix (e.g. us1)", type: "text", placeholder: "us1", required: true },
    ],
  },
  {
    type: "aws_ses",
    label: "AWS SES",
    description: "AWS SES credentials for sending email",
    color: "#ff9900",
    icon: "Mail",
    fields: [
      { key: "access_key_id", label: "Access Key ID", type: "text", placeholder: "AKIA...", required: true },
      { key: "secret_access_key", label: "Secret Access Key", type: "password", placeholder: "...", required: true },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1", required: true },
    ],
  },

  // ── Messaging ──────────────────────────────────────────────────────────────
  {
    type: "slack",
    label: "Slack",
    description: "Slack Bot Token for messaging and channel actions",
    color: "#4a154b",
    icon: "MessageSquare",
    fields: [
      { key: "token", label: "Bot Token", type: "password", placeholder: "xoxb-...", required: true },
      { key: "channel", label: "Default Channel (optional)", type: "text", placeholder: "#general" },
    ],
  },
  {
    type: "discord",
    label: "Discord",
    description: "Discord incoming webhook URL",
    color: "#5865f2",
    icon: "Hash",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "password", placeholder: "https://discord.com/api/webhooks/...", required: true },
    ],
  },
  {
    type: "telegram",
    label: "Telegram",
    description: "Telegram bot token and default chat",
    color: "#0088cc",
    icon: "Send",
    fields: [
      { key: "bot_token", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF...", required: true },
      { key: "chat_id", label: "Default Chat ID (optional)", type: "text", placeholder: "-100..." },
    ],
  },
  {
    type: "whatsapp",
    label: "WhatsApp",
    description: "WhatsApp Business API credentials",
    color: "#25d366",
    icon: "MessageSquare",
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", type: "text", placeholder: "...", required: true },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "twilio",
    label: "Twilio",
    description: "Twilio account credentials for SMS and voice",
    color: "#f22f46",
    icon: "Phone",
    fields: [
      { key: "account_sid", label: "Account SID", type: "text", placeholder: "ACxxx", required: true },
      { key: "auth_token", label: "Auth Token", type: "password", placeholder: "...", required: true },
      { key: "from_number", label: "From Number", type: "text", placeholder: "+15551234567", required: true },
    ],
  },
  {
    type: "teams",
    label: "Microsoft Teams",
    description: "Teams incoming webhook URL",
    color: "#6264a7",
    icon: "MessageSquare",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "text", placeholder: "https://outlook.office.com/webhook/...", required: true },
    ],
  },
  {
    type: "zoom",
    label: "Zoom",
    description: "Zoom OAuth access token",
    color: "#2d8cff",
    icon: "Video",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "vonage",
    label: "Vonage / Nexmo",
    description: "Vonage API key and secret for SMS",
    color: "#7c3aed",
    icon: "Phone",
    fields: [
      { key: "api_key", label: "API Key", type: "text", placeholder: "...", required: true },
      { key: "api_secret", label: "API Secret", type: "password", placeholder: "...", required: true },
    ],
  },

  // ── CRM & Sales ────────────────────────────────────────────────────────────
  {
    type: "salesforce",
    label: "Salesforce",
    description: "Salesforce org credentials (production or sandbox)",
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
      { key: "login_url", label: "Custom Login URL (if custom)", type: "text", placeholder: "https://mycompany.my.salesforce.com" },
      { key: "client_id", label: "Consumer Key", type: "text", placeholder: "3MVG9...", required: true },
      { key: "client_secret", label: "Consumer Secret", type: "password", placeholder: "...", required: true },
      { key: "username", label: "Username (password flow only)", type: "text", placeholder: "user@example.com" },
      { key: "password", label: "Password (password flow only)", type: "password", placeholder: "yourpassword" },
      { key: "security_token", label: "Security Token (password flow only)", type: "password", placeholder: "token appended to password" },
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
    type: "pipedrive",
    label: "Pipedrive",
    description: "Pipedrive API key",
    color: "#172733",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "zoho_crm",
    label: "Zoho CRM",
    description: "Zoho CRM OAuth access token",
    color: "#e42527",
    icon: "Activity",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "close",
    label: "Close CRM",
    description: "Close CRM API key",
    color: "#2c6fad",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "api_...", required: true },
    ],
  },

  // ── Project Management ─────────────────────────────────────────────────────
  {
    type: "jira",
    label: "Jira",
    description: "Jira Cloud instance credentials",
    color: "#0052cc",
    icon: "ClipboardList",
    fields: [
      { key: "domain", label: "Domain (yourorg.atlassian.net)", type: "text", placeholder: "yourcompany.atlassian.net", required: true },
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
    type: "github",
    label: "GitHub",
    description: "GitHub personal access token",
    color: "#24292e",
    icon: "GitBranch",
    fields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "ghp_...", required: true },
      { key: "owner", label: "Owner / Org (optional)", type: "text", placeholder: "your-username" },
    ],
  },
  {
    type: "asana",
    label: "Asana",
    description: "Asana personal access token",
    color: "#fc636b",
    icon: "CheckSquare",
    fields: [
      { key: "api_key", label: "Personal Access Token", type: "password", placeholder: "1/...", required: true },
    ],
  },
  {
    type: "trello",
    label: "Trello",
    description: "Trello API key and token",
    color: "#0052cc",
    icon: "Layers",
    fields: [
      { key: "api_key", label: "API Key", type: "text", placeholder: "...", required: true },
      { key: "token", label: "Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "monday",
    label: "Monday.com",
    description: "Monday.com API key",
    color: "#f65858",
    icon: "Layers",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "ey...", required: true },
    ],
  },
  {
    type: "clickup",
    label: "ClickUp",
    description: "ClickUp personal API key",
    color: "#7b68ee",
    icon: "Layers",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "pk_...", required: true },
    ],
  },
  {
    type: "basecamp",
    label: "Basecamp",
    description: "Basecamp OAuth access token and account ID",
    color: "#1d2d35",
    icon: "Layers",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
      { key: "account_id", label: "Account ID", type: "text", placeholder: "1234567", required: true },
    ],
  },
  {
    type: "todoist",
    label: "Todoist",
    description: "Todoist API token",
    color: "#e44332",
    icon: "CheckSquare",
    fields: [
      { key: "api_key", label: "API Token", type: "password", placeholder: "...", required: true },
    ],
  },

  // ── Productivity / Data ────────────────────────────────────────────────────
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
    type: "airtable",
    label: "Airtable",
    description: "Airtable personal access token",
    color: "#18bfff",
    icon: "Table2",
    fields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "pat...", required: true },
      { key: "base_id", label: "Base ID (optional)", type: "text", placeholder: "appXXXXXXXXXXXXXX" },
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
      { key: "spreadsheet_id", label: "Spreadsheet ID (optional)", type: "text", placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" },
    ],
  },
  {
    type: "google_drive",
    label: "Google Drive",
    description: "Google Drive OAuth access token",
    color: "#4285f4",
    icon: "Cloud",
    fields: [
      { key: "access_token", label: "Access Token (OAuth)", type: "password", placeholder: "ya29...", required: true },
      { key: "refresh_token", label: "Refresh Token (optional)", type: "password", placeholder: "..." },
    ],
  },
  {
    type: "google_calendar",
    label: "Google Calendar",
    description: "Google Calendar OAuth access token",
    color: "#4285f4",
    icon: "CalendarDays",
    fields: [
      { key: "access_token", label: "Access Token (OAuth)", type: "password", placeholder: "ya29...", required: true },
      { key: "calendar_id", label: "Calendar ID (optional)", type: "text", placeholder: "primary" },
    ],
  },
  {
    type: "wordpress",
    label: "WordPress",
    description: "WordPress site credentials",
    color: "#21759b",
    icon: "Globe",
    fields: [
      { key: "site_url", label: "Site URL", type: "text", placeholder: "https://yoursite.com", required: true },
      { key: "username", label: "Username", type: "text", placeholder: "admin", required: true },
      { key: "app_password", label: "Application Password", type: "password", placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx", required: true },
    ],
  },
  {
    type: "contentful",
    label: "Contentful",
    description: "Contentful management token and space",
    color: "#2478cc",
    icon: "FileText",
    fields: [
      { key: "access_token", label: "Management Token", type: "password", placeholder: "CFPAT-...", required: true },
      { key: "space_id", label: "Space ID", type: "text", placeholder: "...", required: true },
    ],
  },
  {
    type: "calendly",
    label: "Calendly",
    description: "Calendly personal access token",
    color: "#006bff",
    icon: "CalendarDays",
    fields: [
      { key: "api_token", label: "Personal Access Token", type: "password", placeholder: "eyJ...", required: true },
    ],
  },
  {
    type: "clearbit",
    label: "Clearbit",
    description: "Clearbit API key for data enrichment",
    color: "#3b5fc0",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "sk_...", required: true },
    ],
  },
  {
    type: "hunter",
    label: "Hunter.io",
    description: "Hunter.io API key for email finding",
    color: "#f36a23",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },

  // ── Payments ───────────────────────────────────────────────────────────────
  {
    type: "stripe",
    label: "Stripe",
    description: "Stripe secret key",
    color: "#6772e5",
    icon: "CreditCard",
    fields: [
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "sk_live_...", required: true },
      { key: "webhook_secret", label: "Webhook Secret (optional)", type: "password", placeholder: "whsec_..." },
    ],
  },
  {
    type: "paypal",
    label: "PayPal",
    description: "PayPal REST API credentials",
    color: "#003087",
    icon: "CreditCard",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "...", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "square",
    label: "Square",
    description: "Square access token",
    color: "#3e4348",
    icon: "CreditCard",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "EAAAl...", required: true },
    ],
  },
  {
    type: "braintree",
    label: "Braintree",
    description: "Braintree merchant credentials",
    color: "#1f69ff",
    icon: "CreditCard",
    fields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", placeholder: "...", required: true },
      { key: "public_key", label: "Public Key", type: "text", placeholder: "...", required: true },
      { key: "private_key", label: "Private Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "paddle",
    label: "Paddle",
    description: "Paddle API key",
    color: "#4bb543",
    icon: "CreditCard",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "pdl_...", required: true },
    ],
  },

  // ── E-commerce ─────────────────────────────────────────────────────────────
  {
    type: "shopify",
    label: "Shopify",
    description: "Shopify store domain and Admin API token",
    color: "#96bf48",
    icon: "ShoppingCart",
    fields: [
      { key: "store_domain", label: "Store Domain (yourstore.myshopify.com)", type: "text", placeholder: "yourstore.myshopify.com", required: true },
      { key: "access_token", label: "Admin API Token", type: "password", placeholder: "shpat_...", required: true },
    ],
  },
  {
    type: "woocommerce",
    label: "WooCommerce",
    description: "WooCommerce REST API credentials",
    color: "#7f54b3",
    icon: "ShoppingCart",
    fields: [
      { key: "site_url", label: "Site URL", type: "text", placeholder: "https://yourshop.com", required: true },
      { key: "consumer_key", label: "Consumer Key", type: "text", placeholder: "ck_...", required: true },
      { key: "consumer_secret", label: "Consumer Secret", type: "password", placeholder: "cs_...", required: true },
    ],
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  {
    type: "mixpanel",
    label: "Mixpanel",
    description: "Mixpanel project token",
    color: "#7856ff",
    icon: "Activity",
    fields: [
      { key: "project_token", label: "Project Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "amplitude",
    label: "Amplitude",
    description: "Amplitude API key",
    color: "#1a77f2",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "segment",
    label: "Segment",
    description: "Segment write key",
    color: "#52bd95",
    icon: "Activity",
    fields: [
      { key: "write_key", label: "Write Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "posthog",
    label: "PostHog",
    description: "PostHog API key",
    color: "#f54e00",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "phc_...", required: true },
      { key: "host", label: "Host URL (optional)", type: "text", placeholder: "https://app.posthog.com" },
    ],
  },
  {
    type: "google_analytics",
    label: "Google Analytics 4",
    description: "GA4 Measurement Protocol credentials",
    color: "#f9ab00",
    icon: "Activity",
    fields: [
      { key: "measurement_id", label: "Measurement ID", type: "text", placeholder: "G-XXXXXXXX", required: true },
      { key: "api_secret", label: "API Secret", type: "password", placeholder: "...", required: true },
    ],
  },

  // ── Finance ────────────────────────────────────────────────────────────────
  {
    type: "quickbooks",
    label: "QuickBooks",
    description: "QuickBooks Online OAuth credentials",
    color: "#2ca01c",
    icon: "Activity",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
      { key: "realm_id", label: "Company ID (Realm ID)", type: "text", placeholder: "123456789", required: true },
    ],
  },
  {
    type: "xero",
    label: "Xero",
    description: "Xero OAuth access token and tenant",
    color: "#1ab4d7",
    icon: "Activity",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
      { key: "tenant_id", label: "Tenant ID", type: "text", placeholder: "...", required: true },
    ],
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  {
    type: "twitter",
    label: "Twitter / X",
    description: "Twitter API v2 bearer token",
    color: "#1da1f2",
    icon: "MessageSquare",
    fields: [
      { key: "bearer_token", label: "Bearer Token", type: "password", placeholder: "AAAA...", required: true },
    ],
  },
  {
    type: "linkedin",
    label: "LinkedIn",
    description: "LinkedIn OAuth access token",
    color: "#0077b5",
    icon: "MessageSquare",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "youtube",
    label: "YouTube",
    description: "YouTube Data API key",
    color: "#ff0000",
    icon: "Globe",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "AIza...", required: true },
    ],
  },

  // ── Support ────────────────────────────────────────────────────────────────
  {
    type: "zendesk",
    label: "Zendesk",
    description: "Zendesk subdomain and API token",
    color: "#03363d",
    icon: "Activity",
    fields: [
      { key: "subdomain", label: "Subdomain", type: "text", placeholder: "yourcompany", required: true },
      { key: "email", label: "Email", type: "text", placeholder: "you@company.com", required: true },
      { key: "api_token", label: "API Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "intercom",
    label: "Intercom",
    description: "Intercom access token",
    color: "#1f8ded",
    icon: "MessageSquare",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "freshdesk",
    label: "Freshdesk",
    description: "Freshdesk API key and domain",
    color: "#3ab9c1",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
      { key: "domain", label: "Domain (yourcompany.freshdesk.com)", type: "text", placeholder: "yourcompany", required: true },
    ],
  },

  // ── Marketing ──────────────────────────────────────────────────────────────
  {
    type: "activecampaign",
    label: "ActiveCampaign",
    description: "ActiveCampaign API key and account URL",
    color: "#356ae0",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
      { key: "base_url", label: "Account URL", type: "text", placeholder: "https://youracccount.api-us1.com", required: true },
    ],
  },
  {
    type: "klaviyo",
    label: "Klaviyo",
    description: "Klaviyo private API key",
    color: "#232f3e",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "Private API Key", type: "password", placeholder: "pk_...", required: true },
    ],
  },
  {
    type: "convertkit",
    label: "ConvertKit",
    description: "ConvertKit API key",
    color: "#fb6970",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "brevo",
    label: "Brevo (Sendinblue)",
    description: "Brevo API key",
    color: "#0b996e",
    icon: "Mail",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "xkeysib-...", required: true },
    ],
  },
  {
    type: "typeform",
    label: "Typeform",
    description: "Typeform personal access token",
    color: "#262627",
    icon: "FileText",
    fields: [
      { key: "api_key", label: "Personal Access Token", type: "password", placeholder: "tfp_...", required: true },
    ],
  },

  // ── Storage ────────────────────────────────────────────────────────────────
  {
    type: "aws_s3",
    label: "AWS S3",
    description: "AWS S3 credentials and default bucket",
    color: "#ff9900",
    icon: "Cloud",
    fields: [
      { key: "access_key_id", label: "Access Key ID", type: "text", placeholder: "AKIA...", required: true },
      { key: "secret_access_key", label: "Secret Access Key", type: "password", placeholder: "...", required: true },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1", required: true },
      { key: "bucket", label: "Default Bucket (optional)", type: "text", placeholder: "my-bucket" },
    ],
  },
  {
    type: "dropbox",
    label: "Dropbox",
    description: "Dropbox access token",
    color: "#0061ff",
    icon: "Cloud",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "sl.A...", required: true },
    ],
  },
  {
    type: "onedrive",
    label: "OneDrive",
    description: "OneDrive / Microsoft Graph access token",
    color: "#0078d4",
    icon: "Cloud",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "eyJ...", required: true },
    ],
  },
  {
    type: "cloudinary",
    label: "Cloudinary",
    description: "Cloudinary media management credentials",
    color: "#3448c5",
    icon: "Cloud",
    fields: [
      { key: "cloud_name", label: "Cloud Name", type: "text", placeholder: "mycloud", required: true },
      { key: "api_key", label: "API Key", type: "text", placeholder: "...", required: true },
      { key: "api_secret", label: "API Secret", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "box",
    label: "Box",
    description: "Box access token",
    color: "#0061d5",
    icon: "Cloud",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },

  // ── Databases ──────────────────────────────────────────────────────────────
  {
    type: "postgres",
    label: "PostgreSQL",
    description: "PostgreSQL database connection",
    color: "#336791",
    icon: "Database",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "localhost", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "5432" },
      { key: "database", label: "Database", type: "text", placeholder: "mydb", required: true },
      { key: "user", label: "Username", type: "text", placeholder: "postgres", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "..." },
    ],
  },
  {
    type: "mysql",
    label: "MySQL",
    description: "MySQL database connection",
    color: "#00758f",
    icon: "Database",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "localhost", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "3306" },
      { key: "database", label: "Database", type: "text", placeholder: "mydb", required: true },
      { key: "username", label: "Username", type: "text", placeholder: "root", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "..." },
    ],
  },
  {
    type: "mongodb",
    label: "MongoDB",
    description: "MongoDB connection string",
    color: "#13aa52",
    icon: "Database",
    fields: [
      { key: "connection_string", label: "Connection String", type: "password", placeholder: "mongodb+srv://...", required: true },
      { key: "database", label: "Database Name", type: "text", placeholder: "mydb" },
    ],
  },
  {
    type: "redis",
    label: "Redis",
    description: "Redis connection details",
    color: "#d82c20",
    icon: "Server",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "localhost", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "6379" },
      { key: "password", label: "Password (optional)", type: "password", placeholder: "..." },
    ],
  },
  {
    type: "supabase",
    label: "Supabase",
    description: "Supabase project credentials",
    color: "#3ecf8e",
    icon: "Database",
    fields: [
      { key: "url", label: "Project URL", type: "text", placeholder: "https://xxx.supabase.co", required: true },
      { key: "service_role_key", label: "Service Role Key", type: "password", placeholder: "eyJ...", required: true },
    ],
  },
  {
    type: "elasticsearch",
    label: "Elasticsearch",
    description: "Elasticsearch node and API key",
    color: "#f6d024",
    icon: "SearchCode",
    fields: [
      { key: "node", label: "Node URL", type: "text", placeholder: "https://localhost:9200", required: true },
      { key: "api_key", label: "API Key", type: "password", placeholder: "..." },
    ],
  },

  // ── Message Brokers ────────────────────────────────────────────────────────
  {
    type: "kafka",
    label: "Kafka",
    description: "Apache Kafka broker credentials",
    color: "#231f20",
    icon: "Radio",
    fields: [
      { key: "brokers", label: "Brokers (comma-separated)", type: "text", placeholder: "broker1:9092,broker2:9092", required: true },
      { key: "sasl_username", label: "SASL Username (optional)", type: "text", placeholder: "..." },
      { key: "sasl_password", label: "SASL Password (optional)", type: "password", placeholder: "..." },
    ],
  },
  {
    type: "rabbitmq",
    label: "RabbitMQ",
    description: "RabbitMQ AMQP URL",
    color: "#ff6600",
    icon: "Radio",
    fields: [
      { key: "url", label: "AMQP URL", type: "password", placeholder: "amqp://user:pass@host:5672/vhost", required: true },
    ],
  },
  {
    type: "mqtt",
    label: "MQTT",
    description: "MQTT broker connection",
    color: "#660066",
    icon: "Wifi",
    fields: [
      { key: "broker_url", label: "Broker URL", type: "text", placeholder: "mqtt://broker.example.com", required: true },
      { key: "username", label: "Username (optional)", type: "text", placeholder: "..." },
      { key: "password", label: "Password (optional)", type: "password", placeholder: "..." },
    ],
  },
  {
    type: "nats",
    label: "NATS",
    description: "NATS messaging server",
    color: "#34a0e0",
    icon: "Radio",
    fields: [
      { key: "servers", label: "Servers (comma-separated)", type: "text", placeholder: "nats://localhost:4222", required: true },
      { key: "username", label: "Username (optional)", type: "text", placeholder: "..." },
      { key: "password", label: "Password (optional)", type: "password", placeholder: "..." },
    ],
  },

  // ── Dev Tools ──────────────────────────────────────────────────────────────
  {
    type: "gitlab",
    label: "GitLab",
    description: "GitLab personal access token",
    color: "#fc6d26",
    icon: "GitBranch",
    fields: [
      { key: "api_token", label: "Personal Access Token", type: "password", placeholder: "glpat-...", required: true },
      { key: "base_url", label: "GitLab URL (optional, for self-hosted)", type: "text", placeholder: "https://gitlab.com" },
    ],
  },
  {
    type: "sentry",
    label: "Sentry",
    description: "Sentry auth token and org slug",
    color: "#362d59",
    icon: "Activity",
    fields: [
      { key: "auth_token", label: "Auth Token", type: "password", placeholder: "...", required: true },
      { key: "org_slug", label: "Organization Slug", type: "text", placeholder: "my-org", required: true },
    ],
  },
  {
    type: "datadog",
    label: "Datadog",
    description: "Datadog API key",
    color: "#632ca6",
    icon: "Activity",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "pagerduty",
    label: "PagerDuty",
    description: "PagerDuty API key",
    color: "#06ac38",
    icon: "Bell",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "vercel",
    label: "Vercel",
    description: "Vercel access token",
    color: "#000000",
    icon: "Globe",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "circleci",
    label: "CircleCI",
    description: "CircleCI API token",
    color: "#343434",
    icon: "RefreshCw",
    fields: [
      { key: "api_token", label: "API Token", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "bitbucket",
    label: "Bitbucket",
    description: "Bitbucket workspace credentials",
    color: "#0052cc",
    icon: "GitBranch",
    fields: [
      { key: "username", label: "Username", type: "text", placeholder: "your-username", required: true },
      { key: "app_password", label: "App Password", type: "password", placeholder: "...", required: true },
      { key: "workspace", label: "Workspace", type: "text", placeholder: "my-workspace", required: true },
      { key: "repo_slug", label: "Default Repo Slug (optional)", type: "text", placeholder: "my-repo" },
    ],
  },

  // ── Infrastructure ─────────────────────────────────────────────────────────
  {
    type: "ssh",
    label: "SSH",
    description: "SSH server connection credentials",
    color: "#333333",
    icon: "Terminal",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "192.168.1.1", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "22" },
      { key: "username", label: "Username", type: "text", placeholder: "root", required: true },
      { key: "password", label: "Password (if not using key)", type: "password", placeholder: "..." },
      { key: "private_key", label: "Private Key (PEM, optional)", type: "password", placeholder: "-----BEGIN RSA PRIVATE KEY-----" },
    ],
  },
  {
    type: "ftp",
    label: "FTP",
    description: "FTP server connection",
    color: "#4a90d9",
    icon: "FolderUp",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "ftp.example.com", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "21" },
      { key: "username", label: "Username", type: "text", placeholder: "ftpuser", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "...", required: true },
    ],
  },
  {
    type: "sftp",
    label: "SFTP",
    description: "SFTP (SSH File Transfer Protocol) credentials",
    color: "#2d7dd2",
    icon: "FolderUp",
    fields: [
      { key: "host", label: "Host", type: "text", placeholder: "sftp.example.com", required: true },
      { key: "port", label: "Port", type: "text", placeholder: "22" },
      { key: "username", label: "Username", type: "text", placeholder: "sftpuser", required: true },
      { key: "password", label: "Password (if not using key)", type: "password", placeholder: "..." },
      { key: "private_key", label: "Private Key (PEM, optional)", type: "password", placeholder: "-----BEGIN RSA PRIVATE KEY-----" },
    ],
  },

  // ── Generic ────────────────────────────────────────────────────────────────
  {
    type: "webhook",
    label: "HTTP / Webhook",
    description: "Generic HTTP connection with base URL and auth",
    color: "#3b82f6",
    icon: "Globe",
    fields: [
      { key: "base_url", label: "Base URL", type: "text", placeholder: "https://api.example.com", required: true },
      { key: "auth_header", label: "Authorization Header (optional)", type: "password", placeholder: "Bearer your-token" },
    ],
  },
  {
    type: "custom",
    label: "Custom",
    description: "Generic API key or token",
    color: "#ec4899",
    icon: "Zap",
    fields: [
      { key: "key", label: "Key / Token", type: "password", placeholder: "...", required: true },
    ],
  },
];

export const CONNECTION_DEF_MAP = Object.fromEntries(CONNECTION_DEFINITIONS.map((d) => [d.type, d]));
