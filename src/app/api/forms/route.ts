import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("forms")
    .select("id, name, description, is_published, response_count, created_at, updated_at")
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { data, error } = await ctx.admin
    .from("forms")
    .insert({
      org_id:      ctx.orgId,
      name:        body.name || "Untitled Form",
      description: body.description || "",
      questions:   [],
      settings:    {
        accent_color: "#6366f1",
        bg_color:     "#ffffff",
        font:         "Inter, sans-serif",
        show_progress: true,
        show_branding: true,
      },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
