import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

// GET /api/approvals/[token]?decision=approved|rejected
// Called when approver clicks the link in the email
export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  const { searchParams } = new URL(req.url);
  const decision = searchParams.get("decision");

  if (decision !== "approved" && decision !== "rejected") {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#ef4444">Invalid decision</h2>
        <p>The link you followed is missing a valid decision parameter.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const supabase = createServerClient();
  const { data: approval, error } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !approval) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#ef4444">Not found</h2>
        <p>This approval link is invalid or has expired.</p>
      </body></html>`,
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  if (approval.status !== "pending") {
    const color = approval.status === "approved" ? "#22c55e" : "#ef4444";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:${color}">Already ${approval.status}</h2>
        <p>This request was already actioned on ${new Date(approval.decision_at).toLocaleString()}.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  await supabase
    .from("workflow_approvals")
    .update({ status: decision, decision_at: new Date().toISOString() })
    .eq("token", token);

  const color = decision === "approved" ? "#22c55e" : "#ef4444";
  const emoji = decision === "approved" ? "✅" : "❌";

  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f9fafb">
      <div style="max-width:400px;margin:0 auto;background:white;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="font-size:48px;margin-bottom:16px">${emoji}</div>
        <h2 style="color:${color};margin:0 0 8px">Request ${decision}</h2>
        <p style="color:#6b7280;margin:0">Your decision has been recorded. You may close this tab.</p>
      </div>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// GET /api/approvals/[token]/status — poll approval status
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("workflow_approvals")
    .select("status, decision_at")
    .eq("token", token)
    .single();
  return NextResponse.json(data ?? { status: "not_found" });
}
