import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("esign_documents")
    .select("file_url")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !data?.file_url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = await fetch(data.file_url);
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-cache",
    },
  });
}
