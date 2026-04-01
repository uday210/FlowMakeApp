import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;

  const { data, error } = await ctx.admin
    .from("generated_docs")
    .select("id, name, output_path")
    .eq("id", docId)
    .eq("template_id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!data.output_path) return NextResponse.json({ error: "File path missing" }, { status: 400 });

  const { data: signed, error: signErr } = await ctx.admin.storage
    .from("generated-docs")
    .createSignedUrl(data.output_path, 3600);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not create download URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, name: data.name });
}
