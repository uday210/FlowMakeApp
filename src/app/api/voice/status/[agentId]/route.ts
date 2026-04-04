import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const formData       = await req.formData();
  const callSid        = formData.get("CallSid")      as string ?? "";
  const callStatus     = formData.get("CallStatus")   as string ?? "completed";
  const callDuration   = formData.get("CallDuration") as string ?? "0";

  const statusMap: Record<string, string> = {
    "completed":   "completed",
    "failed":      "failed",
    "busy":        "busy",
    "no-answer":   "no-answer",
    "canceled":    "failed",
  };

  await admin
    .from("voice_calls")
    .update({
      status:           statusMap[callStatus] ?? "completed",
      duration_seconds: parseInt(callDuration) || 0,
      ended_at:         new Date().toISOString(),
    })
    .eq("call_sid", callSid);

  return new NextResponse("OK", { status: 200 });
}
