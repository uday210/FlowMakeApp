import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { WorkflowNode } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public endpoint — renders the form for a workflow whose trigger is `trigger_form`.
// Returns only the trigger node's presentation config, never the rest of the workflow.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: workflow, error } = await supabase
    .from("workflows")
    .select("id, name, nodes, is_active")
    .eq("id", id)
    .single();

  if (error || !workflow) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const triggerNode = ((workflow.nodes ?? []) as WorkflowNode[]).find(
    (n) => n.data?.type === "trigger_form"
  );

  if (!triggerNode) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const cfg = triggerNode.data.config ?? {};

  return NextResponse.json({
    id: workflow.id,
    title: (cfg.title as string) || workflow.name,
    submit_label: (cfg.submit_label as string) || "Submit",
    fields: (cfg.fields as string) ?? "",
    is_active: workflow.is_active !== false,
  });
}
