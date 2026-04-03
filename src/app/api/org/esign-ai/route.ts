import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await ctx.admin
    .from("org_settings")
    .select("esign_ai_enabled, esign_ai_provider, esign_ai_model, esign_ai_api_key")
    .eq("org_id", ctx.orgId)
    .single();

  return NextResponse.json(data ?? {});
}

export async function PUT(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { error } = await ctx.admin
    .from("org_settings")
    .upsert({
      org_id: ctx.orgId,
      esign_ai_enabled:  body.esign_ai_enabled  ?? false,
      esign_ai_provider: body.esign_ai_provider ?? "openai",
      esign_ai_model:    body.esign_ai_model    ?? "gpt-4o-mini",
      esign_ai_api_key:  body.esign_ai_api_key  ?? "",
      updated_at:        new Date().toISOString(),
    }, { onConflict: "org_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
