import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkText(text: string, maxChars = 1500, overlap = 150): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      // Prefer breaking at paragraph boundary, then sentence boundary
      const paraBreak = text.lastIndexOf("\n\n", end);
      const sentBreak = text.lastIndexOf(". ", end);
      if (paraBreak > start + maxChars * 0.5) {
        end = paraBreak + 2;
      } else if (sentBreak > start + maxChars * 0.5) {
        end = sentBreak + 2;
      }
    }
    const chunk = text.slice(start, Math.min(end, text.length)).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = end - overlap;
  }
  return chunks;
}

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Embedding API error ${res.status}`);
  }
  const data = await res.json() as { data: { index: number; embedding: number[] }[] };
  // Sort by index to preserve order
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

function polyfillForPdfParse() {
  const g = global as unknown as Record<string, unknown>;
  if (!g.DOMMatrix) g.DOMMatrix = class DOMMatrix { constructor() { return this; } };
  if (!g.Path2D) g.Path2D = class Path2D {};
  if (!g.ImageData) g.ImageData = class ImageData {};
}

// ─── GET — list uploaded files for this agent ─────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify agent belongs to this org
  const { data: agent } = await ctx.admin.from("chatbots").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.admin
    .from("agent_knowledge_chunks")
    .select("filename, chunk_index")
    .eq("agent_id", id)
    .order("filename");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by filename → chunk count
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[row.filename] = (map[row.filename] ?? 0) + 1;
  }
  const files = Object.entries(map).map(([filename, chunks]) => ({ filename, chunks }));
  return NextResponse.json({ files });
}

// ─── POST — upload, parse, chunk, embed, store ────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. Required for generating embeddings." },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  try {
    if (name.endsWith(".pdf")) {
      polyfillForPdfParse();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse") as {
        PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
      };
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
    } else {
      text = new TextDecoder("utf-8").decode(buffer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  text = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!text) return NextResponse.json({ error: "File appears to be empty" }, { status: 400 });

  // Chunk
  const chunks = chunkText(text);

  // Embed in batches of 100 (OpenAI limit per request is 2048 inputs, but keep batches manageable)
  const BATCH = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vecs = await embedTexts(batch, openaiKey);
    embeddings.push(...vecs);
  }

  // Verify agent belongs to this org
  const { data: agentCheck } = await ctx.admin.from("chatbots").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!agentCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete existing chunks for this file (re-upload replaces)
  await ctx.admin
    .from("agent_knowledge_chunks")
    .delete()
    .eq("agent_id", id)
    .eq("filename", file.name);

  // Insert new chunks
  const rows = chunks.map((content, i) => ({
    agent_id: id,
    filename: file.name,
    content,
    embedding: `[${embeddings[i].join(",")}]`,
    chunk_index: i,
  }));

  const { error: insertError } = await ctx.admin
    .from("agent_knowledge_chunks")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ filename: file.name, chunks_created: chunks.length });
}

// ─── DELETE — remove all chunks for a filename ────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const filename = url.searchParams.get("filename");
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

  // Verify agent belongs to this org
  const { data: agent } = await ctx.admin.from("chatbots").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await ctx.admin
    .from("agent_knowledge_chunks")
    .delete()
    .eq("agent_id", id)
    .eq("filename", filename);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
