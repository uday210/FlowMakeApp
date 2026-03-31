import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { generateApiKey, hashKey } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("api_keys")
    .select("id, name, key_prefix, is_active, created_at, last_used_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { raw, prefix } = generateApiKey();
  const keyHash = await hashKey(raw);

  const { data, error } = await ctx.admin
    .from("api_keys")
    .insert({ org_id: ctx.orgId, name: name.trim(), key_prefix: prefix, key_hash: keyHash })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the full raw key ONCE — never shown again
  return NextResponse.json({ ...data, raw_key: raw });
}
