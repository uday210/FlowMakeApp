import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, name, nodes")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
