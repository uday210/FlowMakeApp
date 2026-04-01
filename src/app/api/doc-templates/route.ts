import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { detectFields } from "@/lib/docMerge";

export const dynamic = "force-dynamic";

// GET /api/doc-templates — list all templates for the org
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("doc_templates")
    .select("id, name, description, category, file_name, file_size, detected_fields, usage_count, created_at, updated_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/doc-templates — upload a new DOCX template
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null) ?? "";
  const description = (formData.get("description") as string | null) ?? "";
  const category = (formData.get("category") as string | null) ?? "general";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.name.endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx files are supported" }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const filePath = `${ctx.orgId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await ctx.admin.storage
    .from("doc-templates")
    .upload(filePath, fileBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Detect merge fields
  let detectedFields: ReturnType<typeof detectFields> = [];
  try {
    detectedFields = detectFields(fileBuffer);
  } catch {
    // Non-fatal — template still saved, fields can be detected later
  }

  // Insert record
  const { data, error } = await ctx.admin
    .from("doc_templates")
    .insert({
      org_id: ctx.orgId,
      name: name || file.name.replace(".docx", ""),
      description,
      category,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      detected_fields: detectedFields,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
