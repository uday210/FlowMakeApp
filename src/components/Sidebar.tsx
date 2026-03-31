"use client";

import { useState } from "react";
import { NODE_DEFINITIONS } from "@/lib/nodeDefinitions";
import type { NodeDefinition } from "@/lib/types";
import {
  Play, Globe, Clock, ArrowUpRight, Mail, MessageSquare,
  Hash, Send, Sparkles, Timer, Filter, Braces,
  GitBranch, BookOpen, Table2, Phone, MailCheck, Rss,
  CalendarDays, Calculator, Bot, Sheet,
  RefreshCw, CreditCard, ClipboardList, MailOpen, Cloud,
  PenLine, ChevronDown, ChevronRight,
  // New icons
  Repeat2, Variable, Layers, Reply, GitMerge,
  Code2, Type, Database, HardDrive, MessageCircle,
  CheckSquare, Bell, ImageIcon, BotMessageSquare, Plug,
  DatabaseZap, Leaf, Zap, Radio, Wifi, Server, SearchCode,
  FileCode, Lock, KeyRound, FileText, Image, QrCode,
  Wind, Mic, Binary, Terminal, FolderUp, MessageSquareReply,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Play, Globe, Clock, ArrowUpRight, Mail, MessageSquare,
  Hash, Send, Sparkles, Timer, Filter, Braces,
  GitBranch, BookOpen, Table2, Phone, MailCheck, Rss,
  CalendarDays, Calculator, Bot, Sheet,
  RefreshCw, CreditCard, ClipboardList, MailOpen, Cloud,
  PenLine,
  Repeat2, Variable, Layers, Reply, GitMerge,
  Code2, Type, Database, HardDrive, MessageCircle,
  CheckSquare, Bell, ImageIcon, BotMessageSquare, Plug,
  DatabaseZap, Leaf, Zap, Radio, Wifi, Server, SearchCode,
  FileCode, Lock, KeyRound, FileText, Image, QrCode,
  Wind, Mic, Binary, Terminal, FolderUp, MessageSquareReply,
};

const SUBCATEGORY_ORDER = [
  "Flow Control",
  "HTTP",
  "Email",
  "Messaging",
  "AI & ML",
  "Data Processing",
  "Storage",
  "Productivity",
  "CRM & Sales",
  "Payments",
  "E-Sign",
  "Databases",
  "Message Brokers",
  "Utilities",
  "Infrastructure",
];

const SUBCATEGORY_MAP: Record<string, string> = {
  // Flow Control
  action_if_else:          "Flow Control",
  action_switch:           "Flow Control",
  action_filter:           "Flow Control",
  action_delay:            "Flow Control",
  action_logger:           "Flow Control",
  action_transform:        "Flow Control",
  action_iterator:         "Flow Control",
  action_set_variable:     "Flow Control",
  action_get_variable:     "Flow Control",
  action_sub_workflow:     "Flow Control",
  action_webhook_response: "Flow Control",
  action_agent_reply:      "Flow Control",
  action_merge:            "Flow Control",
  action_approval:         "Flow Control",
  action_notification:     "Flow Control",
  // HTTP
  action_http:             "HTTP",
  // Email
  action_email:            "Email",
  action_sendgrid:         "Email",
  action_resend:           "Email",
  action_mailgun:          "Email",
  action_postmark:         "Email",
  action_smtp:             "Email",
  // Messaging
  action_slack:            "Messaging",
  action_discord:          "Messaging",
  action_telegram:         "Messaging",
  action_twilio:           "Messaging",
  action_whatsapp:         "Messaging",
  action_mailchimp:        "Messaging",
  // AI & ML
  action_openai:           "AI & ML",
  action_claude:           "AI & ML",
  action_dalle:            "AI & ML",
  action_agent:            "AI & ML",
  action_mcp_tool:         "AI & ML",
  // Data Processing
  action_code:             "Data Processing",
  action_formatter:        "Data Processing",
  action_csv_parse:        "Data Processing",
  action_csv_generate:     "Data Processing",
  action_math:             "Data Processing",
  action_datetime:         "Data Processing",
  action_rss:              "Data Processing",
  // Storage
  action_data_store:       "Storage",
  action_google_drive:     "Storage",
  action_s3:               "Storage",
  // Productivity
  action_google_calendar:  "Productivity",
  action_sheets:           "Productivity",
  action_notion:           "Productivity",
  action_airtable:         "Productivity",
  action_github:           "Productivity",
  action_jira:             "Productivity",
  action_linear:           "Productivity",
  // CRM & Sales
  action_salesforce:       "CRM & Sales",
  action_hubspot:          "CRM & Sales",
  // Payments
  action_stripe:           "Payments",
  // E-Sign
  action_esign_request:    "E-Sign",
  // Databases
  action_postgres:         "Databases",
  action_mysql:            "Databases",
  action_mongodb:          "Databases",
  action_redis:            "Databases",
  action_supabase_db:      "Databases",
  // Message Brokers
  action_kafka:            "Message Brokers",
  action_mqtt:             "Message Brokers",
  action_rabbitmq:         "Message Brokers",
  action_elasticsearch:    "Message Brokers",
  action_nats:             "Message Brokers",
  // Utilities
  action_xml:              "Utilities",
  action_crypto:           "Utilities",
  action_jwt:              "Utilities",
  action_pdf:              "Utilities",
  action_image:            "Utilities",
  action_qrcode:           "Utilities",
  // More AI (already under AI & ML)
  action_gemini:           "AI & ML",
  action_groq:             "AI & ML",
  action_mistral:          "AI & ML",
  action_whisper:          "AI & ML",
  action_pinecone:         "AI & ML",
  action_weaviate:         "AI & ML",
  // Infrastructure
  action_ssh:              "Infrastructure",
  action_ftp:              "Infrastructure",
  action_sftp:             "Infrastructure",
  // Custom Tables
  action_user_table:       "Storage",
};

const SUBCATEGORY_COLORS: Record<string, string> = {
  "Flow Control":   "#0891b2",
  "HTTP":           "#7c3aed",
  "Email":          "#1a82e2",
  "Messaging":      "#4a154b",
  "AI & ML":        "#10a37f",
  "Data Processing":"#1e293b",
  "Storage":        "#0284c7",
  "Productivity":   "#1a73e8",
  "CRM & Sales":    "#00a1e0",
  "Payments":       "#6772e5",
  "E-Sign":         "#4f46e5",
  "Databases":        "#336791",
  "Message Brokers":  "#000000",
  "Utilities":        "#8e44ad",
  "Infrastructure":   "#1a1a2e",
};

function NodeCard({ def }: { def: NodeDefinition }) {
  const IconComponent = ICONS[def.icon as keyof typeof ICONS] || Play;

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/nodeType", def.type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group"
    >
      {/* Circular icon matching canvas node */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform"
        style={{ backgroundColor: def.color }}
      >
        <IconComponent size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate leading-tight">{def.label}</p>
        <p className="text-[9px] text-gray-400 truncate leading-tight mt-0.5">
          {def.description.length > 38 ? def.description.slice(0, 36) + "…" : def.description}
        </p>
      </div>
    </div>
  );
}

function SubcategorySection({ name, defs }: { name: string; defs: NodeDefinition[] }) {
  const [open, setOpen] = useState(true);
  const color = SUBCATEGORY_COLORS[name] || "#6b7280";

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left px-1 mb-1.5 group"
      >
        {open ? (
          <ChevronDown size={10} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />
        )}
        <span
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {name}
        </span>
        <span className="text-[9px] text-gray-300 ml-auto">{defs.length}</span>
      </button>
      {open && (
        <div className="space-y-1.5 mb-3 pl-0.5">
          {defs.map((def) => (
            <NodeCard key={def.type} def={def} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [search, setSearch] = useState("");

  const triggers = NODE_DEFINITIONS.filter((d) => d.category === "trigger");
  const actions = NODE_DEFINITIONS.filter((d) => d.category === "action");

  const grouped: Record<string, NodeDefinition[]> = {};
  for (const def of actions) {
    const sub = SUBCATEGORY_MAP[def.type];
    if (sub) (grouped[sub] ??= []).push(def);
  }

  // Apply search filter
  const filterDefs = (defs: NodeDefinition[]) =>
    search
      ? defs.filter(
          (d) =>
            d.label.toLowerCase().includes(search.toLowerCase()) ||
            d.description.toLowerCase().includes(search.toLowerCase())
        )
      : defs;

  const filteredTriggers = filterDefs(triggers);

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Modules</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full text-xs rounded-xl border border-gray-200 px-3 py-1.5 bg-gray-50 outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 placeholder-gray-300 transition-all"
        />
      </div>

      <div className="px-2 py-2 space-y-0.5 flex-1 overflow-y-auto">
        {/* Triggers */}
        {filteredTriggers.length > 0 && (
          <div className="mb-1">
            <p className="text-[9px] font-bold text-violet-500 uppercase tracking-widest mb-1 px-2.5 pt-1">
              Triggers
            </p>
            {filteredTriggers.map((def) => (
              <NodeCard key={def.type} def={def} />
            ))}
          </div>
        )}

        {/* Actions by subcategory */}
        {filteredTriggers.length > 0 && <div className="border-t border-gray-100 my-1" />}
        {SUBCATEGORY_ORDER.map((sub) => {
          const defs = filterDefs(grouped[sub] ?? []);
          if (!defs || defs.length === 0) return null;
          return <SubcategorySection key={sub} name={sub} defs={defs} />;
        })}
      </div>
    </aside>
  );
}
