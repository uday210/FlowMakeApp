"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Mail, Plus, Pencil, Trash2, Clock, Tag, FileText, Loader2,
  Copy, Send, Eye, X, Search, BarChart2, ChevronDown, Check,
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  html_body: string;
  variables: { key: string; label: string }[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Pre-built template definitions ──────────────────────────────────────────

const PRESET_TEMPLATES = [
  {
    emoji: "✍️",
    name: "E-Sign Invitation",
    description: "Invite someone to sign a document with a direct signing link",
    category: "esign",
    color: "#4f46e5",
    subject: "Action required: Please sign {{document_title}}",
    html_body: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="background:#4f46e5;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Signature Required</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi {{signer_name}},</p><p style="margin:0 0 24px;color:#374151;font-size:16px;">You have been requested to review and sign the following document:</p><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 28px;"><p style="margin:0;color:#111827;font-size:18px;font-weight:600;">{{document_title}}</p></div><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="{{signing_url}}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Review &amp; Sign Document</a></td></tr></table><p style="margin:28px 0 0;color:#6b7280;font-size:14px;">This link is unique to you — please do not share it.</p></td></tr><tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#9ca3af;font-size:13px;">Sent via your e-signature platform</p></td></tr></table></td></tr></table></body></html>`,
    plain_body: `Hi {{signer_name}},\n\nYou have been requested to sign: {{document_title}}\n\nSign here: {{signing_url}}`,
    variables: [{ name: "signer_name", description: "Full name of the signer" }, { name: "document_title", description: "Title of the document" }, { name: "signing_url", description: "Unique signing link" }],
    blocks: [
      { type: "header", title: "Signature Required", subtitle: "", bgColor: "#4f46e5", textColor: "#ffffff", logoUrl: "" },
      { type: "text", content: "Hi {{signer_name}},", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "text", content: "You have been requested to review and sign the following document:", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "spacer", height: 8 },
      { type: "text", content: "{{document_title}}", fontSize: 18, color: "#111827", align: "left", bold: true },
      { type: "spacer", height: 16 },
      { type: "button", label: "Review & Sign Document", url: "{{signing_url}}", bgColor: "#4f46e5", textColor: "#ffffff", align: "center", fullWidth: false },
      { type: "spacer", height: 8 },
      { type: "text", content: "This link is unique to you — please do not share it.", fontSize: 14, color: "#6b7280", align: "left", bold: false },
      { type: "footer", content: "Sent via your e-signature platform", color: "#9ca3af", fontSize: 13 },
    ],
  },
  {
    emoji: "✅",
    name: "E-Sign Completed",
    description: "Confirm that a document has been successfully signed",
    category: "esign",
    color: "#059669",
    subject: "Document signed: {{document_title}}",
    html_body: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="background:#059669;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Document Signed ✓</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi {{signer_name}},</p><p style="margin:0 0 24px;color:#374151;font-size:16px;">The following document has been successfully signed:</p><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 28px;"><p style="margin:0 0 4px;color:#111827;font-size:18px;font-weight:600;">{{document_title}}</p><p style="margin:0;color:#059669;font-size:14px;">&#10003; Signed on {{signed_at}}</p></div><p style="margin:0;color:#6b7280;font-size:14px;">Thank you for completing this process.</p></td></tr><tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#9ca3af;font-size:13px;">Sent via your e-signature platform</p></td></tr></table></td></tr></table></body></html>`,
    plain_body: `Hi {{signer_name}},\n\nThe document "{{document_title}}" was successfully signed on {{signed_at}}.\n\nThank you.`,
    variables: [{ name: "signer_name", description: "Full name of the signer" }, { name: "document_title", description: "Title of the document" }, { name: "signed_at", description: "Date the document was signed" }],
    blocks: [
      { type: "header", title: "Document Signed ✓", subtitle: "", bgColor: "#059669", textColor: "#ffffff", logoUrl: "" },
      { type: "text", content: "Hi {{signer_name}},", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "text", content: "The following document has been successfully signed:", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "spacer", height: 8 },
      { type: "text", content: "{{document_title}}", fontSize: 18, color: "#111827", align: "left", bold: true },
      { type: "text", content: "✓ Signed on {{signed_at}}", fontSize: 14, color: "#059669", align: "left", bold: false },
      { type: "spacer", height: 16 },
      { type: "text", content: "Thank you for completing this process.", fontSize: 14, color: "#6b7280", align: "left", bold: false },
      { type: "footer", content: "Sent via your e-signature platform", color: "#9ca3af", fontSize: 13 },
    ],
  },
  {
    emoji: "👋",
    name: "Welcome Email",
    description: "Onboard new users with a warm welcome and getting-started link",
    category: "onboarding",
    color: "#2563eb",
    subject: "Welcome to {{org_name}}, {{first_name}}!",
    html_body: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="background:#2563eb;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Welcome aboard!</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi {{first_name}},</p><p style="margin:0 0 24px;color:#374151;font-size:16px;">We're thrilled to have you join <strong>{{org_name}}</strong>. Your account is ready.</p><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:0 0 28px;"><h3 style="margin:0 0 12px;color:#1d4ed8;font-size:16px;font-weight:600;">Getting started</h3><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;"><li>Complete your profile</li><li>Explore the dashboard</li><li>Connect your first integration</li></ul></div><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="{{app_url}}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Go to Dashboard</a></td></tr></table></td></tr><tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#9ca3af;font-size:13px;">&copy; {{org_name}}</p></td></tr></table></td></tr></table></body></html>`,
    plain_body: `Hi {{first_name}},\n\nWelcome to {{org_name}}! Your account is ready.\n\nGo to your dashboard: {{app_url}}`,
    variables: [{ name: "first_name", description: "User's first name" }, { name: "org_name", description: "Your organization name" }, { name: "app_url", description: "Link to the dashboard" }],
    blocks: [
      { type: "header", title: "Welcome aboard!", subtitle: "", bgColor: "#2563eb", textColor: "#ffffff", logoUrl: "" },
      { type: "text", content: "Hi {{first_name}},", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "text", content: "We're thrilled to have you join {{org_name}}. Your account is ready.", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "spacer", height: 8 },
      { type: "text", content: "Getting started:\n• Complete your profile\n• Explore the dashboard\n• Connect your first integration", fontSize: 14, color: "#374151", align: "left", bold: false },
      { type: "spacer", height: 16 },
      { type: "button", label: "Go to Dashboard", url: "{{app_url}}", bgColor: "#2563eb", textColor: "#ffffff", align: "center", fullWidth: false },
      { type: "footer", content: "© {{org_name}}", color: "#9ca3af", fontSize: 13 },
    ],
  },
  {
    emoji: "🔔",
    name: "Workflow Notification",
    description: "Generic notification email triggered from an automation workflow",
    category: "notification",
    color: "#d97706",
    subject: "{{subject_line}}",
    html_body: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="background:#374151;padding:24px 40px;"><h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{subject_line}}</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi {{recipient_name}},</p><div style="border-left:4px solid #6b7280;padding-left:16px;margin:0 0 28px;"><p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">{{message}}</p></div><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="{{action_url}}" style="display:inline-block;background:#374151;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">{{action_label}}</a></td></tr></table></td></tr><tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#9ca3af;font-size:13px;">Sent automatically by your workflow</p></td></tr></table></td></tr></table></body></html>`,
    plain_body: `Hi {{recipient_name}},\n\n{{message}}\n\n{{action_label}}: {{action_url}}`,
    variables: [{ name: "recipient_name", description: "Recipient's name" }, { name: "subject_line", description: "Email subject and header" }, { name: "message", description: "Notification message body" }, { name: "action_url", description: "Call-to-action link" }, { name: "action_label", description: "Button label text" }],
    blocks: [
      { type: "header", title: "{{subject_line}}", subtitle: "", bgColor: "#374151", textColor: "#ffffff", logoUrl: "" },
      { type: "text", content: "Hi {{recipient_name}},", fontSize: 16, color: "#374151", align: "left", bold: false },
      { type: "spacer", height: 4 },
      { type: "text", content: "{{message}}", fontSize: 15, color: "#374151", align: "left", bold: false },
      { type: "spacer", height: 16 },
      { type: "button", label: "{{action_label}}", url: "{{action_url}}", bgColor: "#374151", textColor: "#ffffff", align: "center", fullWidth: false },
      { type: "footer", content: "Sent automatically by your workflow", color: "#9ca3af", fontSize: 13 },
    ],
  },
  {
    emoji: "💳",
    name: "Invoice / Payment Receipt",
    description: "Send an invoice or payment confirmation to customers",
    category: "transactional",
    color: "#0284c7",
    subject: "Invoice #{{invoice_number}} — {{amount}} due {{due_date}}",
    html_body: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="padding:40px 40px 0;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><h2 style="margin:0;color:#111827;font-size:22px;font-weight:700;">Invoice</h2></td><td align="right"><span style="background:#fef3c7;color:#92400e;font-size:13px;font-weight:600;padding:4px 12px;border-radius:20px;">Due {{due_date}}</span></td></tr></table><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Bill to</p><p style="margin:0 0 24px;color:#111827;font-size:16px;font-weight:600;">{{customer_name}}</p><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Invoice #</td><td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Description</td><td align="right" style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Amount</td></tr><tr><td style="padding:16px;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">{{invoice_number}}</td><td style="padding:16px;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">{{description}}</td><td align="right" style="padding:16px;color:#111827;font-size:16px;font-weight:700;border-top:1px solid #e5e7eb;">{{amount}}</td></tr></table><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td align="center"><a href="{{payment_url}}" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Pay Now</a></td></tr></table><p style="margin:24px 0 0;color:#6b7280;font-size:14px;">Thank you for your business.</p></td></tr><tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;margin-top:40px;"><p style="margin:0;color:#9ca3af;font-size:13px;">&copy; {{org_name}}</p></td></tr></table></td></tr></table></body></html>`,
    plain_body: `Invoice #{{invoice_number}}\n\nBill to: {{customer_name}}\nAmount: {{amount}}\nDue: {{due_date}}\n\nPay here: {{payment_url}}\n\nThank you, {{org_name}}`,
    variables: [{ name: "customer_name", description: "Customer's name" }, { name: "invoice_number", description: "Invoice reference" }, { name: "amount", description: "Amount due" }, { name: "due_date", description: "Payment due date" }, { name: "description", description: "Line item description" }, { name: "payment_url", description: "Payment link" }, { name: "org_name", description: "Your org name" }],
    blocks: [
      { type: "text", content: "Invoice", fontSize: 22, color: "#111827", align: "left", bold: true },
      { type: "text", content: "Due {{due_date}}", fontSize: 13, color: "#92400e", align: "right", bold: false },
      { type: "divider", color: "#e5e7eb", thickness: 1, margin: 20 },
      { type: "text", content: "BILL TO", fontSize: 11, color: "#6b7280", align: "left", bold: true },
      { type: "text", content: "{{customer_name}}", fontSize: 16, color: "#111827", align: "left", bold: true },
      { type: "spacer", height: 16 },
      { type: "text", content: "Invoice #{{invoice_number}}\n{{description}}", fontSize: 14, color: "#374151", align: "left", bold: false },
      { type: "text", content: "Amount: {{amount}}", fontSize: 16, color: "#111827", align: "right", bold: true },
      { type: "spacer", height: 16 },
      { type: "button", label: "Pay Now", url: "{{payment_url}}", bgColor: "#0284c7", textColor: "#ffffff", align: "center", fullWidth: false },
      { type: "text", content: "Thank you for your business.", fontSize: 14, color: "#6b7280", align: "left", bold: false },
      { type: "footer", content: "© {{org_name}}", color: "#9ca3af", fontSize: 13 },
    ],
  },
];

const BUILT_IN_CATEGORIES = ["esign", "onboarding", "notification", "transactional", "workflow", "custom"];

const CATEGORY_COLORS: Record<string, string> = {
  esign:         "bg-indigo-100 text-indigo-700",
  onboarding:    "bg-blue-100 text-blue-700",
  notification:  "bg-amber-100 text-amber-700",
  transactional: "bg-green-100 text-green-700",
  workflow:      "bg-purple-100 text-purple-700",
  custom:        "bg-gray-100 text-gray-600",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-teal-100 text-teal-700";
}

type SortKey = "updated_at" | "name" | "usage_count" | "created_at";

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Search / filter / sort
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  // Preview modal
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Test email
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  // Category manager modal
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  // Template carousel
  const [templateLoading, setTemplateLoading] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/email-templates")
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allCategories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    BUILT_IN_CATEGORIES.forEach(c => cats.add(c));
    return Array.from(cats);
  }, [templates]);

  const filtered = useMemo(() => {
    let list = [...templates];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    if (filterCategory !== "all") list = list.filter(t => t.category === filterCategory);
    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else if (sortKey === "usage_count") diff = (a.usage_count ?? 0) - (b.usage_count ?? 0);
      else if (sortKey === "created_at") diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else diff = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [templates, search, filterCategory, sortKey, sortAsc]);

  const handleUseTemplate = async (tpl: (typeof PRESET_TEMPLATES)[number], index: number) => {
    setTemplateLoading(index);
    try {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          subject: tpl.subject,
          html_body: tpl.html_body,
          plain_body: tpl.plain_body,
          variables: tpl.variables,
          blocks: tpl.blocks ?? [],
          settings: {},
        }),
      });
      const data = await res.json();
      if (data.id) router.push(`/email-templates/${data.id}`);
    } catch {
      // fail silently
    } finally {
      setTemplateLoading(null);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    const res = await fetch("/api/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled Template", category: "custom" }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.id) router.push(`/email-templates/${data.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    setDeletingId(id);
    await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
    setDeletingId(null);
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    const res = await fetch(`/api/email-templates/${id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (data.id) setTemplates(prev => [data, ...prev]);
    setDuplicatingId(null);
  };

  const startRename = (t: EmailTemplate) => {
    setRenamingId(t.id);
    setRenameVal(t.name);
  };

  const commitRename = async (id: string) => {
    const name = renameVal.trim();
    if (!name) { setRenamingId(null); return; }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t));
    setRenamingId(null);
    const current = templates.find(t => t.id === id);
    if (!current) return;
    await fetch(`/api/email-templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...current, name }),
    });
  };

  const sendTest = async () => {
    if (!testingId || !testEmail.trim()) return;
    setTestSending(true);
    setTestMsg("");
    const res = await fetch(`/api/email-templates/${testingId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail }),
    });
    const data = await res.json();
    setTestSending(false);
    if (res.ok) {
      setTestMsg("✓ Test email sent!");
      setTimeout(() => { setTestingId(null); setTestEmail(""); setTestMsg(""); }, 2000);
    } else {
      setTestMsg(data.error || "Failed to send");
    }
  };

  const previewTemplate = templates.find(t => t.id === previewId);

  const SORT_LABELS: Record<SortKey, string> = {
    updated_at:  "Last Updated",
    name:        "Name",
    usage_count: "Usage",
    created_at:  "Date Created",
  };

  return (
    <AppShell>
      <PageHeader
        title="Email Templates"
        subtitle="Design reusable email templates for esign notifications, workflows, and more."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCatManager(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Tag size={14} /> Categories
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              New Template
            </button>
          </div>
        }
      />

      {/* Pre-built templates carousel */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Pre-built Templates</h2>
          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">{PRESET_TEMPLATES.length}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {PRESET_TEMPLATES.map((tpl, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-56 bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{tpl.emoji}</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize text-white"
                  style={{ backgroundColor: tpl.color }}
                >
                  {tpl.category}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-800 leading-tight">{tpl.name}</p>
              <p className="text-xs text-gray-400 leading-relaxed flex-1 line-clamp-2">{tpl.description}</p>
              <button
                onClick={() => handleUseTemplate(tpl, i)}
                disabled={templateLoading === i}
                className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: tpl.color }}
              >
                {templateLoading === i ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-gray-50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory("all")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterCategory === "all" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            All
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat === filterCategory ? "all" : cat)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-colors ${filterCategory === cat ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative ml-auto" ref={sortRef}>
          <button
            onClick={() => setShowSortMenu(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            <BarChart2 size={12} /> {SORT_LABELS[sortKey]}
            <ChevronDown size={11} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-40 py-1">
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => { if (sortKey === k) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(false); } setShowSortMenu(false); }}
                  className="w-full text-left text-xs px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                >
                  {SORT_LABELS[k]}
                  {sortKey === k && <Check size={11} className="text-indigo-600" />}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => { setSortAsc(a => !a); setShowSortMenu(false); }}
                  className="w-full text-left text-xs px-4 py-2 hover:bg-gray-50 text-gray-500"
                >
                  {sortAsc ? "↑ Ascending" : "↓ Descending"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Mail className="text-indigo-400" size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">No email templates yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first template to use in esign and workflows</p>
            </div>
            <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={14} /> New Template
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">No templates match your search.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all group flex flex-col">
                <div className="p-5 flex-1">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-indigo-500" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${categoryColor(t.category)}`}>
                        {t.category}
                      </span>
                      {(t.usage_count ?? 0) > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                          {t.usage_count} use{t.usage_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name — inline editable */}
                  {renamingId === t.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => commitRename(t.id)}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(t.id); if (e.key === "Escape") setRenamingId(null); }}
                      className="w-full text-sm font-semibold text-gray-800 border border-indigo-400 rounded px-2 py-0.5 mb-1 outline-none"
                    />
                  ) : (
                    <h3
                      className="font-semibold text-gray-800 text-sm leading-tight mb-1 cursor-pointer hover:text-indigo-600 transition-colors"
                      title="Click to rename"
                      onClick={() => startRename(t)}
                    >
                      {t.name}
                    </h3>
                  )}

                  {t.description && (
                    <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{t.description}</p>
                  )}
                  {t.subject && (
                    <p className="text-xs text-gray-500 truncate mb-3">
                      <span className="font-medium">Subject:</span> {t.subject}
                    </p>
                  )}
                  {t.variables?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      <Tag size={10} className="text-gray-400 flex-shrink-0" />
                      {t.variables.slice(0, 4).map(v => (
                        <span key={v.key} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {`{{${v.key}}}`}
                        </span>
                      ))}
                      {t.variables.length > 4 && (
                        <span className="text-xs text-gray-400">+{t.variables.length - 4} more</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={10} />
                    {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>

                {/* Test email inline row */}
                {testingId === t.id && (
                  <div className="px-5 pb-3">
                    <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-2">
                      <input
                        type="email"
                        autoFocus
                        placeholder="Send test to…"
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && sendTest()}
                        className="flex-1 text-xs bg-white border border-indigo-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={sendTest}
                        disabled={testSending || !testEmail.trim()}
                        className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {testSending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      </button>
                      <button onClick={() => { setTestingId(null); setTestEmail(""); setTestMsg(""); }} className="text-gray-400 hover:text-gray-600">
                        <X size={13} />
                      </button>
                    </div>
                    {testMsg && (
                      <p className={`text-xs mt-1 px-1 ${testMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{testMsg}</p>
                    )}
                  </div>
                )}

                {/* Action bar */}
                <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/email-templates/${t.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => { setPreviewId(t.id); }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    <Eye size={11} /> Preview
                  </button>
                  <button
                    onClick={() => { setTestingId(testingId === t.id ? null : t.id); setTestEmail(""); setTestMsg(""); }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                    title="Send test email"
                  >
                    <Send size={11} /> Test
                  </button>
                  <button
                    onClick={() => handleDuplicate(t.id)}
                    disabled={duplicatingId === t.id}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
                    title="Duplicate"
                  >
                    {duplicatingId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 ml-auto"
                  >
                    {deletingId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewId && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">{previewTemplate.name}</p>
                {previewTemplate.subject && (
                  <p className="text-xs text-gray-400 mt-0.5">Subject: {previewTemplate.subject}</p>
                )}
              </div>
              <button onClick={() => setPreviewId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewTemplate.html_body ? (
                <iframe
                  srcDoc={previewTemplate.html_body}
                  className="w-full rounded-lg border border-gray-100"
                  style={{ minHeight: 480 }}
                  sandbox="allow-same-origin"
                  title="Email preview"
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No content yet — open the editor to build your template.</div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-between">
              <button
                onClick={() => { setPreviewId(null); setTestingId(previewTemplate.id); }}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <Send size={12} /> Send Test Email
              </button>
              <button
                onClick={() => { setPreviewId(null); router.push(`/email-templates/${previewTemplate.id}`); }}
                className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                <Pencil size={12} /> Open Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category manager modal */}
      {showCatManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Manage Categories</h2>
              <button onClick={() => setShowCatManager(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Categories are derived from your templates. Create a new category by typing a name below — it will appear when you next edit a template.</p>
            <div className="space-y-2 mb-4">
              {allCategories.map(cat => (
                <div key={cat} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${categoryColor(cat)}`}>{cat}</span>
                  <span className="text-xs text-gray-400">{templates.filter(t => t.category === cat).length} template{templates.filter(t => t.category === cat).length !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New category name…"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={() => {
                  if (newCategory && !allCategories.includes(newCategory)) {
                    // Categories are stored on templates; just note it for user
                    alert(`Category "${newCategory}" noted. Assign it to a template in the editor.`);
                  }
                  setNewCategory("");
                }}
                className="text-xs font-semibold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
