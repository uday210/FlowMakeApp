import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { detectFields } from "@/lib/docMerge";

export const dynamic = "force-dynamic";

// GET /api/doc-templates/[id]/fields — re-detect fields and update record
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: tpl } = await ctx.admin
    .from("doc_templates")
    .select("file_path")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!tpl?.file_path) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data: fileData } = await ctx.admin.storage
    .from("doc-templates")
    .download(tpl.file_path);

  if (!fileData) return NextResponse.json({ error: "Could not load file" }, { status: 500 });

  const buf = Buffer.from(await fileData.arrayBuffer());
  const fields = detectFields(buf);

  // Persist detected fields
  await ctx.admin
    .from("doc_templates")
    .update({ detected_fields: fields })
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  return NextResponse.json(fields);
}
