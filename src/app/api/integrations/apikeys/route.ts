import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/apikeys
 * Returns active API keys as { value: id, label: name (prefix) } for use in node config dropdowns.
 */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("api_keys")
    .select("id, name, key_prefix")
    .eq("org_id", ctx.orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const keys = (data ?? []).map((k) => ({
    value: k.id as string,
    label: `${k.name} (${k.key_prefix}…)`,
  }));

  return NextResponse.json({ keys });
}
