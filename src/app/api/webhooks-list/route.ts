import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workflows, error } = await ctx.admin
    .from("workflows")
    .select("id, name, nodes")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { headers } = request;
  const proto = headers.get("x-forwarded-proto") ?? (headers.get("host")?.includes("localhost") ? "http" : "https");
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const appUrl = `${proto}://${host}`;

  const webhooks = (workflows ?? []).flatMap((wf: { id: string; name: string; nodes: unknown }) => {
    const nodes: Array<{ id: string; data: { type: string; label: string; config: Record<string, unknown> } }> =
      Array.isArray(wf.nodes) ? wf.nodes : [];
    return nodes
      .filter((n) => n?.data?.type === "trigger_webhook")
      .map((n) => ({
        id: `${wf.id}__${n.id}`,
        workflow_id: wf.id,
        workflow_name: wf.name,
        node_id: n.id,
        node_label: n.data?.label ?? "Webhook",
        url: `${appUrl}/api/webhook/${wf.id}`,
        method: (n.data?.config?.method as string) ?? "ANY",
        created_at: null,
      }));
  });

  return NextResponse.json(webhooks);
}
