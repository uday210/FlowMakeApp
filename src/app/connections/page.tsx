"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Link2,
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Zap,
  Mail,
  MessageSquare,
  Globe,
  Database,
  Bot,
  Cloud,
  ShoppingCart,
  GitBranch,
  FileText,
  Phone,
  Calendar,
  Table2,
  Server,
  Lock,
  Activity,
  Layers,
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  created_at: string;
}

interface ServiceField {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<any>;

interface ServiceType {
  value: string;
  label: string;
  icon: IconComponent;
  color: string;
  fields: ServiceField[];
  oauthConnect?: boolean;
}

const SERVICE_TYPES: ServiceType[] = [
  // ── Google (OAuth) ─────────────────────────────────────────────────────────
  { value: "google", label: "Google (OAuth)", icon: Globe, color: "bg-blue-100 text-blue-600", fields: [], oauthConnect: true },
  { value: "airtable", label: "Airtable (OAuth)", icon: Database, color: "bg-cyan-100 text-cyan-600", fields: [], oauthConnect: true },
  { value: "salesforce", label: "Salesforce (OAuth)", icon: Cloud, color: "bg-blue-100 text-blue-600", fields: [], oauthConnect: true },
  // ── AI & ML ────────────────────────────────────────────────────────────────
  { value: "openai", label: "OpenAI", icon: Bot, color: "bg-green-100 text-green-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "anthropic", label: "Anthropic / Claude", icon: Bot, color: "bg-amber-100 text-amber-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "gemini", label: "Google Gemini", icon: Bot, color: "bg-blue-100 text-blue-500", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "groq", label: "Groq", icon: Bot, color: "bg-orange-100 text-orange-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "mistral", label: "Mistral AI", icon: Bot, color: "bg-sky-100 text-sky-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "whisper", label: "Whisper (OpenAI)", icon: Bot, color: "bg-teal-100 text-teal-600", fields: [{ key: "api_key", label: "OpenAI API Key", type: "password" }] },
  { value: "cohere", label: "Cohere", icon: Bot, color: "bg-indigo-100 text-indigo-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "replicate", label: "Replicate", icon: Bot, color: "bg-purple-100 text-purple-600", fields: [{ key: "api_token", label: "API Token", type: "password" }] },
  { value: "huggingface", label: "Hugging Face", icon: Bot, color: "bg-yellow-100 text-yellow-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "pinecone", label: "Pinecone", icon: Database, color: "bg-green-100 text-green-700", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "weaviate", label: "Weaviate", icon: Database, color: "bg-green-100 text-green-600", fields: [{ key: "host", label: "Host URL", type: "text" }, { key: "api_key", label: "API Key", type: "password" }] },
  // ── Email ──────────────────────────────────────────────────────────────────
  { value: "gmail", label: "Gmail (OAuth)", icon: Mail, color: "bg-red-100 text-red-600", fields: [{ key: "access_token", label: "OAuth Access Token", type: "password" }] },
  { value: "smtp", label: "SMTP", icon: Mail, color: "bg-blue-100 text-blue-600", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "user", label: "Username", type: "text" }, { key: "pass", label: "Password", type: "password" }] },
  { value: "sendgrid", label: "SendGrid", icon: Mail, color: "bg-blue-100 text-blue-700", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "from", label: "From Email", type: "text" }] },
  { value: "resend", label: "Resend", icon: Mail, color: "bg-indigo-100 text-indigo-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "from", label: "From Email", type: "text" }] },
  { value: "mailgun", label: "Mailgun", icon: Mail, color: "bg-red-100 text-red-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "domain", label: "Domain", type: "text" }, { key: "from", label: "From Email", type: "text" }] },
  { value: "postmark", label: "Postmark", icon: Mail, color: "bg-yellow-100 text-yellow-700", fields: [{ key: "server_token", label: "Server Token", type: "password" }, { key: "from", label: "From Email", type: "text" }] },
  { value: "mailchimp", label: "Mailchimp", icon: Mail, color: "bg-yellow-100 text-yellow-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "server_prefix", label: "Server Prefix (e.g. us1)", type: "text" }] },
  { value: "aws_ses", label: "AWS SES", icon: Mail, color: "bg-orange-100 text-orange-500", fields: [{ key: "access_key_id", label: "Access Key ID", type: "text" }, { key: "secret_access_key", label: "Secret Access Key", type: "password" }, { key: "region", label: "Region", type: "text" }] },
  // ── Messaging ──────────────────────────────────────────────────────────────
  { value: "slack", label: "Slack", icon: MessageSquare, color: "bg-yellow-100 text-yellow-600", fields: [{ key: "token", label: "Bot Token", type: "password" }, { key: "channel", label: "Default Channel", type: "text" }] },
  { value: "discord", label: "Discord", icon: MessageSquare, color: "bg-indigo-100 text-indigo-600", fields: [{ key: "webhook_url", label: "Webhook URL", type: "text" }] },
  { value: "telegram", label: "Telegram", icon: MessageSquare, color: "bg-sky-100 text-sky-600", fields: [{ key: "bot_token", label: "Bot Token", type: "password" }, { key: "chat_id", label: "Default Chat ID", type: "text" }] },
  { value: "whatsapp", label: "WhatsApp", icon: Phone, color: "bg-green-100 text-green-600", fields: [{ key: "phone_number_id", label: "Phone Number ID", type: "text" }, { key: "access_token", label: "Access Token", type: "password" }] },
  { value: "twilio", label: "Twilio", icon: Phone, color: "bg-red-100 text-red-600", fields: [{ key: "account_sid", label: "Account SID", type: "text" }, { key: "auth_token", label: "Auth Token", type: "password" }, { key: "from_number", label: "From Phone Number", type: "text" }] },
  { value: "teams", label: "Microsoft Teams", icon: MessageSquare, color: "bg-blue-100 text-blue-700", fields: [{ key: "webhook_url", label: "Webhook URL", type: "text" }] },
  { value: "zoom", label: "Zoom", icon: MessageSquare, color: "bg-blue-100 text-blue-500", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "vonage", label: "Vonage / Nexmo", icon: Phone, color: "bg-purple-100 text-purple-600", fields: [{ key: "api_key", label: "API Key", type: "text" }, { key: "api_secret", label: "API Secret", type: "password" }] },
  // ── CRM & Sales ────────────────────────────────────────────────────────────
  { value: "hubspot", label: "HubSpot", icon: Activity, color: "bg-orange-100 text-orange-600", fields: [{ key: "api_key", label: "Private App Token", type: "password" }] },
  { value: "pipedrive", label: "Pipedrive", icon: Activity, color: "bg-orange-100 text-orange-500", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "zoho_crm", label: "Zoho CRM", icon: Activity, color: "bg-red-100 text-red-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "close", label: "Close CRM", icon: Activity, color: "bg-blue-100 text-blue-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  // ── Project Management ─────────────────────────────────────────────────────
  { value: "jira", label: "Jira", icon: Layers, color: "bg-blue-100 text-blue-700", fields: [{ key: "domain", label: "Domain (yourorg.atlassian.net)", type: "text" }, { key: "email", label: "Email", type: "text" }, { key: "api_token", label: "API Token", type: "password" }] },
  { value: "linear", label: "Linear", icon: Zap, color: "bg-violet-100 text-violet-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "github", label: "GitHub", icon: GitBranch, color: "bg-gray-100 text-gray-800", fields: [{ key: "token", label: "Personal Access Token", type: "password" }, { key: "owner", label: "Owner / Org", type: "text" }] },
  { value: "asana", label: "Asana", icon: Layers, color: "bg-pink-100 text-pink-600", fields: [{ key: "api_key", label: "Personal Access Token", type: "password" }] },
  { value: "trello", label: "Trello", icon: Layers, color: "bg-blue-100 text-blue-600", fields: [{ key: "api_key", label: "API Key", type: "text" }, { key: "token", label: "Token", type: "password" }] },
  { value: "monday", label: "Monday.com", icon: Layers, color: "bg-red-100 text-red-500", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "clickup", label: "ClickUp", icon: Layers, color: "bg-purple-100 text-purple-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "basecamp", label: "Basecamp", icon: Layers, color: "bg-green-100 text-green-700", fields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "account_id", label: "Account ID", type: "text" }] },
  { value: "todoist", label: "Todoist", icon: Layers, color: "bg-red-100 text-red-600", fields: [{ key: "api_key", label: "API Token", type: "password" }] },
  // ── Productivity / Data ────────────────────────────────────────────────────
  { value: "notion", label: "Notion", icon: FileText, color: "bg-gray-100 text-gray-700", fields: [{ key: "token", label: "Integration Token", type: "password" }] },
  { value: "airtable_manual", label: "Airtable (API Key)", icon: Database, color: "bg-cyan-100 text-cyan-600", fields: [{ key: "token", label: "API Token", type: "password" }, { key: "base_id", label: "Base ID", type: "text" }] },
  { value: "sheets", label: "Google Sheets", icon: Table2, color: "bg-green-100 text-green-700", fields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "spreadsheet_id", label: "Spreadsheet ID", type: "text" }] },
  { value: "google_drive", label: "Google Drive", icon: Cloud, color: "bg-blue-100 text-blue-500", fields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "refresh_token", label: "Refresh Token", type: "password" }] },
  { value: "google_calendar", label: "Google Calendar", icon: Calendar, color: "bg-blue-100 text-blue-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "calendar_id", label: "Calendar ID", type: "text" }] },
  { value: "wordpress", label: "WordPress", icon: Globe, color: "bg-blue-100 text-blue-700", fields: [{ key: "site_url", label: "Site URL", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "app_password", label: "App Password", type: "password" }] },
  { value: "contentful", label: "Contentful", icon: FileText, color: "bg-blue-100 text-blue-500", fields: [{ key: "access_token", label: "Management Token", type: "password" }, { key: "space_id", label: "Space ID", type: "text" }] },
  { value: "calendly", label: "Calendly", icon: Calendar, color: "bg-blue-100 text-blue-600", fields: [{ key: "api_token", label: "Personal Access Token", type: "password" }] },
  { value: "clearbit", label: "Clearbit", icon: Activity, color: "bg-blue-100 text-blue-700", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "hunter", label: "Hunter.io", icon: Mail, color: "bg-orange-100 text-orange-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  // ── Payments ───────────────────────────────────────────────────────────────
  { value: "stripe", label: "Stripe", icon: ShoppingCart, color: "bg-violet-100 text-violet-600", fields: [{ key: "secret_key", label: "Secret Key", type: "password" }, { key: "webhook_secret", label: "Webhook Secret", type: "password" }] },
  { value: "paypal", label: "PayPal", icon: ShoppingCart, color: "bg-blue-100 text-blue-700", fields: [{ key: "client_id", label: "Client ID", type: "text" }, { key: "client_secret", label: "Client Secret", type: "password" }] },
  { value: "square", label: "Square", icon: ShoppingCart, color: "bg-gray-100 text-gray-700", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "braintree", label: "Braintree", icon: ShoppingCart, color: "bg-blue-100 text-blue-600", fields: [{ key: "merchant_id", label: "Merchant ID", type: "text" }, { key: "public_key", label: "Public Key", type: "text" }, { key: "private_key", label: "Private Key", type: "password" }] },
  { value: "paddle", label: "Paddle", icon: ShoppingCart, color: "bg-green-100 text-green-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  // ── E-commerce ─────────────────────────────────────────────────────────────
  { value: "shopify", label: "Shopify", icon: ShoppingCart, color: "bg-green-100 text-green-700", fields: [{ key: "store_domain", label: "Store Domain (yourstore.myshopify.com)", type: "text" }, { key: "access_token", label: "Admin API Token", type: "password" }] },
  { value: "woocommerce", label: "WooCommerce", icon: ShoppingCart, color: "bg-purple-100 text-purple-600", fields: [{ key: "site_url", label: "Site URL", type: "text" }, { key: "consumer_key", label: "Consumer Key", type: "text" }, { key: "consumer_secret", label: "Consumer Secret", type: "password" }] },
  // ── Analytics ──────────────────────────────────────────────────────────────
  { value: "mixpanel", label: "Mixpanel", icon: Activity, color: "bg-purple-100 text-purple-600", fields: [{ key: "project_token", label: "Project Token", type: "password" }] },
  { value: "amplitude", label: "Amplitude", icon: Activity, color: "bg-blue-100 text-blue-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "segment", label: "Segment", icon: Activity, color: "bg-green-100 text-green-600", fields: [{ key: "write_key", label: "Write Key", type: "password" }] },
  { value: "posthog", label: "PostHog", icon: Activity, color: "bg-orange-100 text-orange-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "host", label: "Host URL (optional)", type: "text" }] },
  { value: "google_analytics", label: "Google Analytics 4", icon: Activity, color: "bg-orange-100 text-orange-500", fields: [{ key: "measurement_id", label: "Measurement ID", type: "text" }, { key: "api_secret", label: "API Secret", type: "password" }] },
  // ── Finance ────────────────────────────────────────────────────────────────
  { value: "quickbooks", label: "QuickBooks", icon: Activity, color: "bg-green-100 text-green-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "realm_id", label: "Company ID", type: "text" }] },
  { value: "xero", label: "Xero", icon: Activity, color: "bg-blue-100 text-blue-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "tenant_id", label: "Tenant ID", type: "text" }] },
  // ── Social ─────────────────────────────────────────────────────────────────
  { value: "twitter", label: "Twitter / X", icon: MessageSquare, color: "bg-sky-100 text-sky-600", fields: [{ key: "bearer_token", label: "Bearer Token", type: "password" }] },
  { value: "linkedin", label: "LinkedIn", icon: MessageSquare, color: "bg-blue-100 text-blue-700", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "youtube", label: "YouTube", icon: Globe, color: "bg-red-100 text-red-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  // ── Support ────────────────────────────────────────────────────────────────
  { value: "zendesk", label: "Zendesk", icon: Activity, color: "bg-green-100 text-green-600", fields: [{ key: "subdomain", label: "Subdomain", type: "text" }, { key: "email", label: "Email", type: "text" }, { key: "api_token", label: "API Token", type: "password" }] },
  { value: "intercom", label: "Intercom", icon: MessageSquare, color: "bg-blue-100 text-blue-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "freshdesk", label: "Freshdesk", icon: Activity, color: "bg-teal-100 text-teal-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "domain", label: "Domain (yourcompany.freshdesk.com)", type: "text" }] },
  // ── Marketing ──────────────────────────────────────────────────────────────
  { value: "activecampaign", label: "ActiveCampaign", icon: Mail, color: "bg-blue-100 text-blue-600", fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "base_url", label: "Account URL", type: "text" }] },
  { value: "klaviyo", label: "Klaviyo", icon: Mail, color: "bg-gray-100 text-gray-700", fields: [{ key: "api_key", label: "Private API Key", type: "password" }] },
  { value: "convertkit", label: "ConvertKit", icon: Mail, color: "bg-orange-100 text-orange-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "brevo", label: "Brevo (Sendinblue)", icon: Mail, color: "bg-blue-100 text-blue-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "typeform", label: "Typeform", icon: FileText, color: "bg-yellow-100 text-yellow-600", fields: [{ key: "api_key", label: "Personal Access Token", type: "password" }] },
  // ── Storage ────────────────────────────────────────────────────────────────
  { value: "aws_s3", label: "AWS S3", icon: Cloud, color: "bg-orange-100 text-orange-500", fields: [{ key: "access_key_id", label: "Access Key ID", type: "text" }, { key: "secret_access_key", label: "Secret Access Key", type: "password" }, { key: "region", label: "Region", type: "text" }, { key: "bucket", label: "Bucket", type: "text" }] },
  { value: "dropbox", label: "Dropbox", icon: Cloud, color: "bg-blue-100 text-blue-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "onedrive", label: "OneDrive", icon: Cloud, color: "bg-blue-100 text-blue-700", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "cloudinary", label: "Cloudinary", icon: Cloud, color: "bg-blue-100 text-blue-500", fields: [{ key: "cloud_name", label: "Cloud Name", type: "text" }, { key: "api_key", label: "API Key", type: "text" }, { key: "api_secret", label: "API Secret", type: "password" }] },
  { value: "box", label: "Box", icon: Cloud, color: "bg-blue-100 text-blue-600", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  // ── Databases ──────────────────────────────────────────────────────────────
  { value: "postgres", label: "PostgreSQL", icon: Database, color: "bg-blue-100 text-blue-700", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "database", label: "Database", type: "text" }, { key: "user", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { value: "mysql", label: "MySQL", icon: Database, color: "bg-orange-100 text-orange-600", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "database", label: "Database", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { value: "mongodb", label: "MongoDB", icon: Database, color: "bg-green-100 text-green-700", fields: [{ key: "connection_string", label: "Connection String", type: "password" }, { key: "database", label: "Database Name", type: "text" }] },
  { value: "redis", label: "Redis", icon: Server, color: "bg-red-100 text-red-600", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { value: "supabase", label: "Supabase", icon: Database, color: "bg-emerald-100 text-emerald-600", fields: [{ key: "url", label: "Project URL", type: "text" }, { key: "service_role_key", label: "Service Role Key", type: "password" }] },
  { value: "elasticsearch", label: "Elasticsearch", icon: Search, color: "bg-yellow-100 text-yellow-700", fields: [{ key: "node", label: "Node URL", type: "text" }, { key: "api_key", label: "API Key", type: "password" }] },
  // ── Message Brokers ────────────────────────────────────────────────────────
  { value: "kafka", label: "Kafka", icon: Activity, color: "bg-gray-100 text-gray-700", fields: [{ key: "brokers", label: "Brokers (comma-separated)", type: "text" }, { key: "sasl_username", label: "SASL Username", type: "text" }, { key: "sasl_password", label: "SASL Password", type: "password" }] },
  { value: "rabbitmq", label: "RabbitMQ", icon: Activity, color: "bg-orange-100 text-orange-700", fields: [{ key: "url", label: "AMQP URL", type: "password" }] },
  { value: "mqtt", label: "MQTT", icon: Activity, color: "bg-teal-100 text-teal-600", fields: [{ key: "broker_url", label: "Broker URL", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { value: "nats", label: "NATS", icon: Activity, color: "bg-blue-100 text-blue-600", fields: [{ key: "servers", label: "Servers (comma-separated)", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  // ── Dev Tools ──────────────────────────────────────────────────────────────
  { value: "gitlab", label: "GitLab", icon: GitBranch, color: "bg-orange-100 text-orange-600", fields: [{ key: "api_token", label: "Personal Access Token", type: "password" }, { key: "base_url", label: "GitLab URL (optional)", type: "text" }] },
  { value: "sentry", label: "Sentry", icon: Activity, color: "bg-purple-100 text-purple-600", fields: [{ key: "auth_token", label: "Auth Token", type: "password" }, { key: "org_slug", label: "Org Slug", type: "text" }] },
  { value: "datadog", label: "Datadog", icon: Activity, color: "bg-violet-100 text-violet-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "pagerduty", label: "PagerDuty", icon: Activity, color: "bg-green-100 text-green-600", fields: [{ key: "api_key", label: "API Key", type: "password" }] },
  { value: "vercel", label: "Vercel", icon: Globe, color: "bg-gray-100 text-gray-800", fields: [{ key: "access_token", label: "Access Token", type: "password" }] },
  { value: "circleci", label: "CircleCI", icon: Activity, color: "bg-gray-100 text-gray-700", fields: [{ key: "api_token", label: "API Token", type: "password" }] },
  { value: "bitbucket", label: "Bitbucket", icon: GitBranch, color: "bg-blue-100 text-blue-600", fields: [{ key: "username", label: "Username", type: "text" }, { key: "app_password", label: "App Password", type: "password" }, { key: "workspace", label: "Workspace", type: "text" }, { key: "repo_slug", label: "Repository Slug", type: "text" }] },
  // ── Infrastructure ─────────────────────────────────────────────────────────
  { value: "ssh", label: "SSH", icon: Server, color: "bg-gray-100 text-gray-700", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }, { key: "private_key", label: "Private Key (optional)", type: "password" }] },
  { value: "ftp", label: "FTP", icon: Server, color: "bg-blue-100 text-blue-600", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  { value: "sftp", label: "SFTP", icon: Server, color: "bg-blue-100 text-blue-700", fields: [{ key: "host", label: "Host", type: "text" }, { key: "port", label: "Port", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }, { key: "private_key", label: "Private Key (optional)", type: "password" }] },
  // ── Generic ────────────────────────────────────────────────────────────────
  { value: "webhook", label: "HTTP / Webhook", icon: Globe, color: "bg-blue-100 text-blue-600", fields: [{ key: "base_url", label: "Base URL", type: "text" }, { key: "auth_header", label: "Auth Header (optional)", type: "password" }] },
  { value: "jwt", label: "JWT / API Key", icon: Lock, color: "bg-slate-100 text-slate-600", fields: [{ key: "secret", label: "Secret / Private Key", type: "password" }, { key: "algorithm", label: "Algorithm (e.g. HS256)", type: "text" }] },
  { value: "custom", label: "Custom", icon: Zap, color: "bg-pink-100 text-pink-600", fields: [{ key: "key", label: "Key / Token", type: "password" }] },
];

const OAUTH_PROVIDERS: Record<string, {
  startUrl: string;
  label: string;
  description: string;
  buttonLabel: string;
  logo: React.ReactNode;
  colors: string;
}> = {
  google: {
    startUrl: "/api/oauth/google/start",
    label: "Connect via Google OAuth",
    description: "Authorize access to Sheets, Drive, Calendar, and Gmail for your org.",
    buttonLabel: "Sign in with Google",
    colors: "border-blue-100 bg-blue-50 text-blue-700",
    logo: (
      <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
        <path d="M44.5 20H24V28.5H35.9C34.7 33.1 30.5 36.5 24 36.5C16.5 36.5 10.5 30.5 10.5 23C10.5 15.5 16.5 9.5 24 9.5C27.3 9.5 30.3 10.7 32.6 12.7L38.6 6.7C35 3.4 29.8 1.5 24 1.5C12.4 1.5 3 10.9 3 22.5C3 34.1 12.4 43.5 24 43.5C35 43.5 44.5 34.5 44.5 23C44.5 22 44.4 21 44.5 20Z" fill="#4285F4"/>
        <path d="M6.3 13.7L13.4 19C15.4 14.1 19.3 10.5 24 9.5C27.3 9.5 30.3 10.7 32.6 12.7L38.6 6.7C35 3.4 29.8 1.5 24 1.5C16.5 1.5 10 6.7 6.3 13.7Z" fill="#EA4335"/>
        <path d="M24 43.5C29.7 43.5 34.8 41.6 38.4 38.4L31.8 32.8C29.6 34.4 26.9 35.5 24 35.5C17.6 35.5 12.2 31.1 10.6 25.1L3.5 30.3C7.2 37.6 15 43.5 24 43.5Z" fill="#34A853"/>
        <path d="M44.5 20H24V28.5H35.9C35.3 31 33.9 33.1 31.8 34.6L38.4 40.2C42.4 36.5 44.5 30.5 44.5 23C44.5 22 44.4 21 44.5 20Z" fill="#FBBC05"/>
      </svg>
    ),
  },
  airtable: {
    startUrl: "/api/oauth/airtable/start",
    label: "Connect via Airtable OAuth",
    description: "Authorize access to your Airtable bases and records for your org.",
    buttonLabel: "Sign in with Airtable",
    colors: "border-cyan-100 bg-cyan-50 text-cyan-700",
    logo: (
      <svg width="16" height="16" viewBox="0 0 200 200" fill="none">
        <rect width="200" height="200" rx="40" fill="#FCB400"/>
        <path d="M90 45L20 75v15l70-30 70 30V75L90 45z" fill="white"/>
        <path d="M20 95v60l65 28V123L20 95z" fill="white" opacity=".8"/>
        <path d="M160 95l-65 28v60l65-28V95z" fill="white" opacity=".5"/>
      </svg>
    ),
  },
  salesforce: {
    startUrl: "/api/oauth/salesforce/start",
    label: "Connect via Salesforce OAuth",
    description: "Authorize access to your Salesforce org. Use ?sandbox=1 for sandbox orgs.",
    buttonLabel: "Sign in with Salesforce",
    colors: "border-blue-100 bg-blue-50 text-blue-700",
    logo: (
      <svg width="16" height="16" viewBox="0 0 256 180" fill="none">
        <path d="M106 20c10-11 24-18 40-18 21 0 39 11 49 28 8-4 17-6 27-6 35 0 63 28 63 63s-28 63-63 63c-4 0-9 0-13-1-9 14-25 23-43 23-7 0-14-2-20-5-9 18-28 30-50 30-24 0-44-14-54-35-4 1-8 1-12 1C22 163 0 141 0 114c0-20 11-37 28-46-4-7-6-15-6-24C22 20 42 0 67 0c16 0 30 7 39 20z" fill="#00A1E0"/>
      </svg>
    ),
  },
};

function OAuthConnectPanel({ serviceType, connectionName }: { serviceType: string; connectionName: string }) {
  const provider = OAUTH_PROVIDERS[serviceType];
  if (!provider) return null;
  const href = connectionName.trim()
    ? `${provider.startUrl}?label=${encodeURIComponent(connectionName.trim())}`
    : provider.startUrl;
  return (
    <div className={`rounded-lg border p-4 text-sm ${provider.colors}`}>
      <p className="font-medium mb-1">{provider.label}</p>
      <p className="text-xs opacity-70 mb-3">{provider.description}</p>
      <a
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-current/20 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
      >
        {provider.logo}
        {provider.buttonLabel}
      </a>
    </div>
  );
}

function ServiceIcon({ type, size = 16 }: { type: string; size?: number }) {
  const svc = SERVICE_TYPES.find((s) => s.value === type);
  if (!svc) return <Link2 size={size} />;
  const Icon = svc.icon;
  return <Icon size={size} />;
}

function ServiceBadge({ type }: { type: string }) {
  const svc = SERVICE_TYPES.find((s) => s.value === type);
  if (!svc) return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{type}</span>;
  const Icon = svc.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${svc.color}`}>
      <Icon size={10} /> {svc.label}
    </span>
  );
}

function ConnectionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showing, setShowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", type: "openai", config: {} as Record<string, string> });
  const [serviceSearch, setServiceSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [inUseModal, setInUseModal] = useState<{ connName: string; workflows: { id: string; name: string }[] } | null>(null);

  const selectedService = SERVICE_TYPES.find((s) => s.value === form.type) ?? SERVICE_TYPES[0];
  const filteredServices = serviceSearch
    ? SERVICE_TYPES.filter((s) => s.label.toLowerCase().includes(serviceSearch.toLowerCase()))
    : SERVICE_TYPES;

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => setConnections(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const success = searchParams.get("success");
    const err = searchParams.get("error");
    const successMessages: Record<string, string> = {
      google_connected: "Google account connected successfully!",
      airtable_connected: "Airtable account connected successfully!",
      salesforce_connected: "Salesforce org connected successfully!",
    };
    if (success && successMessages[success]) {
      setSuccessMsg(successMessages[success]);
      setTimeout(() => setSuccessMsg(null), 4000);
      router.replace("/connections");
    } else if (err) {
      setError(`OAuth failed: ${err.replace(/_/g, " ")}`);
      router.replace("/connections");
    }
  }, [load, searchParams, router]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, type: form.type, config: form.config }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      const data = await res.json();
      setSavedId(data.id);
      setTimeout(() => setSavedId(null), 2000);
      setShowing(false);
      setForm({ name: "", type: "openai", config: {} });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const del = async (conn: Connection) => {
    const res = await fetch(`/api/connections/${conn.id}`, { method: "DELETE" });
    if (res.status === 409) {
      const body = await res.json();
      setInUseModal({ connName: conn.name, workflows: body.workflows ?? [] });
      return;
    }
    if (res.ok) setConnections((c) => c.filter((x) => x.id !== conn.id));
  };

  const startRename = (conn: Connection) => {
    setRenamingId(conn.id);
    setRenameValue(conn.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    await fetch(`/api/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setConnections((c) => c.map((x) => x.id === id ? { ...x, name: trimmed } : x));
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
    setRenamingId(null);
  };

  const filtered = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByType = filtered.reduce<Record<string, Connection[]>>((acc, c) => {
    (acc[c.type] ??= []).push(c);
    return acc;
  }, {});

  return (
    <AppShell>
      <PageHeader
        title="Connections"
        subtitle="Manage credentials for third-party services used in your scenarios"
        action={
          <button
            onClick={() => setShowing(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> Add connection
          </button>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle size={14} /> {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">×</button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={14} /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <div className="relative max-w-sm mb-6">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
          />
        </div>

        {/* Create form */}
        {showing && (
          <div className="bg-white border border-violet-200 rounded-xl p-5 mb-6 shadow-sm max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">New Connection</h3>
              <button onClick={() => setShowing(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Service</label>
                <div className="relative mb-2">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search services…"
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {filteredServices.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setForm({ ...form, type: s.value, config: {} })}
                        className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-all ${
                          form.type === s.value
                            ? "border-violet-400 bg-violet-50 text-violet-700 font-semibold"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        }`}
                      >
                        <span className={`w-4 h-4 flex items-center justify-center rounded flex-shrink-0 ${s.color}`}>
                          <Icon size={10} />
                        </span>
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Connection name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={`My ${selectedService.label}`}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                />
              </div>

              {selectedService.oauthConnect ? (
                <OAuthConnectPanel serviceType={selectedService.value} connectionName={form.name} />
              ) : (
                selectedService.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
                    {field.type === "select" ? (
                      <select
                        value={form.config[field.key] ?? ""}
                        onChange={(e) => setForm({ ...form, config: { ...form.config, [field.key]: e.target.value } })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                      >
                        <option value="">-- select --</option>
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={form.config[field.key] ?? ""}
                        onChange={(e) => setForm({ ...form, config: { ...form.config, [field.key]: e.target.value } })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {!selectedService.oauthConnect && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={save}
                  disabled={saving || !form.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Save
                </button>
                <button onClick={() => setShowing(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            )}
            {selectedService.oauthConnect && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowing(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Link2 size={24} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              {search ? `No connections match "${search}"` : "No connections yet"}
            </h2>
            <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
              Add credentials for OpenAI, Slack, Gmail, and other services to use in your workflows
            </p>
            <button
              onClick={() => setShowing(true)}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Add first connection
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByType).map(([type, conns]) => {
              const svc = SERVICE_TYPES.find((s) => s.value === type);
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <ServiceBadge type={type} />
                    <span className="text-xs text-gray-400">{conns.length} connection{conns.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {conns.map((conn, i) => (
                      <div
                        key={conn.id}
                        className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group ${i > 0 ? "border-t border-gray-100" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${svc?.color ?? "bg-gray-100 text-gray-600"}`}>
                          <ServiceIcon type={type} size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {renamingId === conn.id ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => commitRename(conn.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitRename(conn.id); if (e.key === "Escape") setRenamingId(null); }}
                              className="text-sm font-semibold text-gray-800 border-b border-violet-400 outline-none bg-transparent w-full"
                            />
                          ) : (
                            <p
                              className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-violet-600 transition-colors"
                              title="Click to rename"
                              onClick={() => startRename(conn)}
                            >{conn.name}</p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {(conn.type === "google" || conn.type === "airtable" || conn.type === "salesforce") && conn.config?.email
                              ? <>Connected as <span className="text-blue-500">{conn.config.email}</span> · </>
                              : null}
                            Added {new Date(conn.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        {savedId === conn.id && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} /> Saved
                          </span>
                        )}
                        <button
                          onClick={() => del(conn)}
                          className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* In-use modal */}
      {inUseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Connection in use</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-700">{inUseModal.connName}</span> is referenced in the following scenario{inUseModal.workflows.length !== 1 ? "s" : ""}. Remove it from those scenarios first.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-5">
              {inUseModal.workflows.map((wf) => (
                <li key={wf.id}>
                  <a
                    href={`/scenarios/${wf.id}`}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                  >
                    <Zap size={11} className="flex-shrink-0" />
                    {wf.name || "Untitled scenario"}
                  </a>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setInUseModal(null)}
              className="w-full py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectionsPageInner />
    </Suspense>
  );
}
