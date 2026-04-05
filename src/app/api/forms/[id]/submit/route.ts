import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load form (public — no auth)
  const { data: form, error: formErr } = await admin.from("forms").select("*").eq("id", id).eq("is_published", true).single();
  if (formErr || !form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const body = await req.json();
  const answers = body.answers ?? {};
  const metadata = {
    user_agent: req.headers.get("user-agent") ?? "",
    submitted_at: new Date().toISOString(),
  };

  const { data: response, error: resErr } = await admin.from("form_responses").insert({
    form_id:      id,
    org_id:       form.org_id,
    answers,
    metadata,
  }).select().single();

  if (resErr) return NextResponse.json({ error: resErr.message }, { status: 500 });

  // Increment response count
  await admin.from("forms").update({ response_count: (form.response_count ?? 0) + 1 }).eq("id", id);

  // Fire trigger_form workflows connected to this form
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { data: workflows } = await admin
      .from("workflows")
      .select("id, nodes")
      .eq("org_id", form.org_id)
      .eq("is_active", true);

    for (const wf of workflows ?? []) {
      const nodes = wf.nodes as { data?: { type?: string; config?: Record<string, unknown> } }[];
      const triggerNode = nodes.find(n => n.data?.type === "trigger_form");
      if (!triggerNode) continue;
      const formId = triggerNode.data?.config?.form_id as string | undefined;
      if (formId && formId !== id) continue;

      await fetch(`${base}/api/execute/${wf.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, form_id: id, response_id: response.id }),
      });
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({ ok: true, response_id: response.id });
}
