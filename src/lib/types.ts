export type NodeType =
  | "trigger_manual"
  | "trigger_agent"
  | "trigger_webhook"
  | "trigger_schedule"
  | "trigger_interval"
  | "trigger_github_event"
  | "trigger_stripe"
  | "trigger_form"
  | "trigger_email_inbound"
  | "trigger_rss_poll"
  | "action_http"
  | "action_email"
  | "action_slack"
  | "action_discord"
  | "action_telegram"
  | "action_openai"
  | "action_delay"
  | "action_filter"
  | "action_logger"
  | "action_transform"
  | "action_github"
  | "action_notion"
  | "action_airtable"
  | "action_twilio"
  | "action_sendgrid"
  | "action_resend"
  | "action_mailgun"
  | "action_postmark"
  | "action_smtp"
  | "action_send_email_template"
  | "action_send_esign_template"
  | "action_generate_document"
  | "action_rss"
  | "action_datetime"
  | "action_math"
  | "action_claude"
  | "action_sheets"
  | "action_salesforce"
  | "trigger_salesforce"
  | "action_if_else"
  | "action_switch"
  | "action_hubspot"
  | "action_jira"
  | "action_linear"
  | "action_stripe"
  | "action_mailchimp"
  | "trigger_esign"
  | "action_esign_request"
  // Flow Control
  | "action_iterator"
  | "action_set_variable"
  | "action_get_variable"
  | "action_sub_workflow"
  | "action_webhook_response"
  | "action_agent_reply"
  | "action_merge"
  // Data Processing
  | "action_code"
  | "action_formatter"
  | "action_csv_parse"
  | "action_csv_generate"
  // AI
  | "action_dalle"
  // Integrations
  | "action_google_calendar"
  | "action_google_drive"
  | "action_s3"
  | "action_whatsapp"
  // Workflow features
  | "action_approval"
  | "action_data_store"
  | "action_notification"
  // Agents & MCP
  | "action_agent"
  | "action_mcp_tool"
  // Databases
  | "action_postgres"
  | "action_mysql"
  | "action_mongodb"
  | "action_redis"
  | "action_supabase_db"
  // Message Brokers
  | "action_kafka"
  | "action_mqtt"
  | "action_rabbitmq"
  | "action_elasticsearch"
  | "action_nats"
  // Utilities
  | "action_xml"
  | "action_crypto"
  | "action_jwt"
  | "action_pdf"
  | "action_image"
  | "action_qrcode"
  // More AI
  | "action_gemini"
  | "action_groq"
  | "action_mistral"
  | "action_whisper"
  | "action_pinecone"
  | "action_weaviate"
  // Infrastructure
  | "action_ssh"
  | "action_ftp"
  | "action_sftp"
  // Custom Tables
  | "action_user_table"
  // Project Management
  | "action_asana"
  | "action_trello"
  | "action_monday"
  | "action_clickup"
  | "action_basecamp"
  | "action_todoist"
  // CRM & Sales
  | "action_pipedrive"
  | "action_zoho_crm"
  | "action_close"
  // Support
  | "action_zendesk"
  | "action_intercom"
  | "action_freshdesk"
  // Marketing
  | "action_activecampaign"
  | "action_klaviyo"
  | "action_convertkit"
  | "action_brevo"
  | "action_typeform"
  // E-commerce
  | "action_shopify"
  | "action_woocommerce"
  | "action_paddle"
  // Analytics
  | "action_mixpanel"
  | "action_amplitude"
  | "action_segment"
  | "action_posthog"
  | "action_google_analytics"
  // Finance
  | "action_quickbooks"
  | "action_xero"
  // Payments
  | "action_paypal"
  | "action_square"
  | "action_braintree"
  // Social
  | "action_twitter"
  | "action_linkedin"
  | "action_youtube"
  // Messaging
  | "action_teams"
  | "action_zoom"
  | "action_vonage"
  | "action_aws_ses"
  // Storage
  | "action_dropbox"
  | "action_onedrive"
  | "action_cloudinary"
  | "action_box"
  // Dev Tools
  | "action_gitlab"
  | "action_sentry"
  | "action_datadog"
  | "action_pagerduty"
  | "action_vercel"
  | "action_circleci"
  | "action_bitbucket"
  // AI & ML
  | "action_cohere"
  | "action_replicate"
  | "action_huggingface"
  // Productivity
  | "action_wordpress"
  | "action_contentful"
  | "action_calendly"
  | "action_clearbit"
  | "action_hunter"
  // New webhook triggers
  | "trigger_slack_event"
  | "trigger_hubspot"
  | "trigger_shopify"
  | "trigger_jira_event"
  | "trigger_calendly"
  | "trigger_typeform"
  | "trigger_gitlab_event"
  | "trigger_paypal_webhook"
  | "trigger_discord_event"
  | "trigger_telegram_update"
  | "trigger_linear_event"
  | "trigger_pipedrive"
  | "trigger_woocommerce"
  | "trigger_clickup"
  | "trigger_asana"
  | "trigger_zendesk"
  | "trigger_intercom"
  | "trigger_freshdesk"
  | "trigger_square_webhook"
  | "trigger_paddle"
  | "trigger_tally"
  | "trigger_bitbucket_event"
  | "trigger_sentry_alert"
  | "trigger_pagerduty"
  | "trigger_datadog";

export interface UserTable {
  id: string;
  name: string;
  description: string;
  columns: UserTableColumn[];
  created_at: string;
  updated_at: string;
}

export interface UserTableColumn {
  name: string;
  type: "text" | "number" | "boolean" | "date" | "json";
  required: boolean;
  default_value?: string;
}

export interface NodeData {
  label: string;
  type: NodeType;
  config: Record<string, unknown>;
  // runtime state
  status?: "idle" | "running" | "success" | "error";
  output?: unknown;
  error?: string;
}

export interface WorkflowNode {
  id: string;
  type: string; // react-flow node type key
  position: { x: number; y: number };
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExecutionContext {
  triggerData: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>;
  logs: ExecutionLog[];
  workflowId?: string;
  orgId?: string;
  variables: Record<string, unknown>;
  secrets: Record<string, string>;
}

export interface ExecutionLog {
  node_id: string;
  node_label: string;
  status: "running" | "success" | "error" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  duration_ms?: number;
}

export interface Execution {
  id: string;
  workflow_id: string;
  status: "pending" | "running" | "success" | "failed";
  trigger_data: Record<string, unknown>;
  logs: ExecutionLog[];
  started_at: string;
  finished_at: string | null;
}

export interface Connection {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NodeDefinition {
  type: NodeType;
  label: string;
  description: string;
  category: "trigger" | "action";
  color: string;
  icon: string;
  defaultConfig: Record<string, unknown>;
  configFields: ConfigField[];
  subcategory?: string;
  connectionType?: string;
  connectionFields?: string[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "password" | "email_template_select" | "esign_template_select" | "doc_template_select";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}
