import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_TEMPLATES = [
  {
    name: "E-Sign Invitation",
    description: "Sent to signers when a document is ready for their signature",
    category: "esign",
    subject: "Action required: Please sign {{document_title}}",
    html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#7c3aed;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Signature Required</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi {{signer_name}},</p>
          <p style="margin:0 0 24px;color:#374151;font-size:16px;">
            You have been requested to review and sign the following document:
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 28px;">
            <p style="margin:0;color:#111827;font-size:18px;font-weight:600;">{{document_title}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="{{signing_url}}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Review &amp; Sign Document
              </a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;color:#6b7280;font-size:14px;">
            This link is unique to you — please do not share it. If you did not expect this request, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">Sent via your e-signature platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_body: `Hi {{signer_name}},\n\nYou have been requested to sign: {{document_title}}\n\nClick the link below to review and sign:\n{{signing_url}}\n\nThis link is unique to you — please do not share it.`,
    variables: [
      { name: "signer_name", description: "Full name of the signer" },
      { name: "document_title", description: "Title of the document to sign" },
      { name: "signing_url", description: "Unique signing link for this signer" },
    ],
  },
  {
    name: "E-Sign Completed",
    description: "Sent to confirm that a document has been successfully signed",
    category: "esign",
    subject: "Document signed: {{document_title}}",
    html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#059669;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Document Signed</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi {{signer_name}},</p>
          <p style="margin:0 0 24px;color:#374151;font-size:16px;">
            Great news! The following document has been successfully signed:
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 28px;">
            <p style="margin:0 0 4px;color:#111827;font-size:18px;font-weight:600;">{{document_title}}</p>
            <p style="margin:0;color:#059669;font-size:14px;">&#10003; Signed on {{signed_at}}</p>
          </div>
          <p style="margin:0;color:#6b7280;font-size:14px;">
            A copy of the signed document has been recorded. Thank you for completing this process.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">Sent via your e-signature platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_body: `Hi {{signer_name}},\n\nThe document "{{document_title}}" has been successfully signed on {{signed_at}}.\n\nThank you for completing this process.`,
    variables: [
      { name: "signer_name", description: "Full name of the signer" },
      { name: "document_title", description: "Title of the signed document" },
      { name: "signed_at", description: "Date and time the document was signed" },
    ],
  },
  {
    name: "Welcome Email",
    description: "Sent to new users when they join your platform or service",
    category: "onboarding",
    subject: "Welcome to {{org_name}}, {{first_name}}!",
    html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#2563eb;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Welcome aboard! 🎉</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi {{first_name}},</p>
          <p style="margin:0 0 24px;color:#374151;font-size:16px;">
            We're thrilled to have you join <strong>{{org_name}}</strong>. Your account is ready and you can start right away.
          </p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:0 0 28px;">
            <h3 style="margin:0 0 12px;color:#1d4ed8;font-size:16px;font-weight:600;">Getting started</h3>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
              <li>Complete your profile</li>
              <li>Explore the dashboard</li>
              <li>Connect your first integration</li>
            </ul>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="{{app_url}}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Go to Dashboard
              </a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;color:#6b7280;font-size:14px;">
            If you have any questions, just reply to this email — we're happy to help.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">&copy; {{org_name}}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_body: `Hi {{first_name}},\n\nWelcome to {{org_name}}! Your account is ready.\n\nGo to your dashboard: {{app_url}}\n\nIf you have any questions, just reply to this email.`,
    variables: [
      { name: "first_name", description: "User's first name" },
      { name: "org_name", description: "Your organization name" },
      { name: "app_url", description: "Link to the dashboard" },
    ],
  },
  {
    name: "Workflow Notification",
    description: "Generic notification email triggered from an automation workflow",
    category: "notification",
    subject: "{{subject_line}}",
    html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#374151;padding:24px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{subject_line}}</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi {{recipient_name}},</p>
          <div style="border-left:4px solid #6b7280;padding-left:16px;margin:0 0 28px;">
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">{{message}}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="{{action_url}}" style="display:inline-block;background:#374151;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
                {{action_label}}
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">Sent automatically by your workflow</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_body: `Hi {{recipient_name}},\n\n{{message}}\n\n{{action_label}}: {{action_url}}`,
    variables: [
      { name: "recipient_name", description: "Person receiving the notification" },
      { name: "subject_line", description: "Email subject and header" },
      { name: "message", description: "Main notification message body" },
      { name: "action_url", description: "Link for the call-to-action button" },
      { name: "action_label", description: "Button label text" },
    ],
  },
  {
    name: "Invoice / Payment Receipt",
    description: "Payment confirmation or invoice email for customers",
    category: "transactional",
    subject: "Invoice #{{invoice_number}} — {{amount}} due {{due_date}}",
    html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><h2 style="margin:0;color:#111827;font-size:22px;font-weight:700;">Invoice</h2></td>
              <td align="right"><span style="background:#fef3c7;color:#92400e;font-size:13px;font-weight:600;padding:4px 12px;border-radius:20px;">Due {{due_date}}</span></td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Bill to</p>
          <p style="margin:0 0 24px;color:#111827;font-size:16px;font-weight:600;">{{customer_name}}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Invoice #</td>
              <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Description</td>
              <td align="right" style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:600;">Amount</td>
            </tr>
            <tr>
              <td style="padding:16px;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">{{invoice_number}}</td>
              <td style="padding:16px;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">{{description}}</td>
              <td align="right" style="padding:16px;color:#111827;font-size:16px;font-weight:700;border-top:1px solid #e5e7eb;">{{amount}}</td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr><td align="center">
              <a href="{{payment_url}}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Pay Now
              </a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;color:#6b7280;font-size:14px;">
            Thank you for your business. If you have questions about this invoice, please reply to this email.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;margin-top:40px;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">&copy; {{org_name}}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    plain_body: `Invoice #{{invoice_number}}\n\nBill to: {{customer_name}}\nAmount: {{amount}}\nDue: {{due_date}}\nDescription: {{description}}\n\nPay here: {{payment_url}}\n\nThank you, {{org_name}}`,
    variables: [
      { name: "customer_name", description: "Customer's full name" },
      { name: "invoice_number", description: "Invoice reference number" },
      { name: "amount", description: "Amount due (e.g. $99.00)" },
      { name: "due_date", description: "Payment due date" },
      { name: "description", description: "Invoice line item description" },
      { name: "payment_url", description: "Link to pay the invoice" },
      { name: "org_name", description: "Your organization name" },
    ],
  },
];

export async function POST() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find which defaults don't exist yet for this org
  const { data: existing } = await ctx.admin
    .from("email_templates")
    .select("name")
    .eq("org_id", ctx.orgId);

  const existingNames = new Set((existing ?? []).map((t: { name: string }) => t.name));
  const toInsert = DEFAULT_TEMPLATES.filter(t => !existingNames.has(t.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, message: "All default templates already exist" });
  }

  const { data, error } = await ctx.admin
    .from("email_templates")
    .insert(toInsert.map(t => ({ ...t, org_id: ctx.orgId, blocks: [], settings: {} })))
    .select("id, name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data?.length ?? 0, templates: data });
}
