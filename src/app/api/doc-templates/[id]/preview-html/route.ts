import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { mergeDocx } from "@/lib/docMerge";

export const dynamic = "force-dynamic";

const MAMMOTH_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "b => strong",
  "i => em",
  "u => u",
];

async function toHtml(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const { value, messages } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: MAMMOTH_STYLE_MAP }
  );
  const warnings = messages.filter(m => m.type === "warning").map(m => m.message);
  return { html: value, warnings };
}

// GET /api/doc-templates/[id]/preview-html
// Returns raw template HTML (merge fields shown as-is, no data needed)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: tpl, error: tplErr } = await ctx.admin
    .from("doc_templates")
    .select("id, file_path")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (tplErr || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!tpl.file_path) return NextResponse.json({ error: "Template file not uploaded" }, { status: 400 });

  const { data: fileData, error: dlErr } = await ctx.admin.storage
    .from("doc-templates")
    .download(tpl.file_path);
  if (dlErr || !fileData) return NextResponse.json({ error: "Could not load template file" }, { status: 500 });

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const { html, warnings } = await toHtml(buffer);

  return NextResponse.json({ html, warnings, raw: true });
}

// POST /api/doc-templates/[id]/preview-html
// Body: { data: Record<string,unknown> }
// Returns merged HTML
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const mergeData: Record<string, unknown> = body.data ?? {};

  const { data: tpl, error: tplErr } = await ctx.admin
    .from("doc_templates")
    .select("id, file_path")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (tplErr || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!tpl.file_path) return NextResponse.json({ error: "Template file not uploaded" }, { status: 400 });

  const { data: fileData, error: dlErr } = await ctx.admin.storage
    .from("doc-templates")
    .download(tpl.file_path);
  if (dlErr || !fileData) return NextResponse.json({ error: "Could not load template file" }, { status: 500 });

  const templateBuffer = Buffer.from(await fileData.arrayBuffer());

  let mergedBuffer: Buffer;
  let mergeWarnings: string[] = [];
  try {
    const result = await mergeDocx(templateBuffer, mergeData);
    mergedBuffer = result.buffer;
    mergeWarnings = result.warnings;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Merge failed: ${msg}` }, { status: 422 });
  }

  const { html, warnings } = await toHtml(mergedBuffer);

  return NextResponse.json({ html, warnings: [...mergeWarnings, ...warnings], raw: false });
}
