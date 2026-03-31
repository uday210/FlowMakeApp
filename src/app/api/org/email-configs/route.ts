import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("org_email_configs")
    .select("id, name, provider, from_email, from_name, is_active, verified, created_at, mailgun_region, mailgun_domain, smtp_host, smtp_port")
    .eq("org_id", ctx.orgId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from("org_email_configs")
    .insert({
      org_id:         ctx.orgId,
      name:           body.name || "Email Config",
      provider:       body.provider,
      from_email:     body.from_email,
      from_name:      body.from_name || "",
      api_key:        body.api_key || null,
      mailgun_domain: body.mailgun_domain || null,
      mailgun_region: body.mailgun_region || "us",
      smtp_host:      body.smtp_host || null,
      smtp_port:      body.smtp_port || null,
      smtp_user:      body.smtp_user || null,
      smtp_pass:      body.smtp_pass || null,
      smtp_secure:    body.smtp_secure ?? true,
      is_active:      false,
      verified:       false,
    })
    .select("id, name, provider, from_email, from_name, is_active, verified, created_at, mailgun_region, mailgun_domain, smtp_host, smtp_port")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
