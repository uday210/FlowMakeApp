import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, string> = {
  "completed": "completed",
  "failed":    "failed",
  "busy":      "busy",
  "no-answer": "no-answer",
  "canceled":  "failed",
};

export async function POST(req: Request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const text   = await req.text();
    const params = new URLSearchParams(text);
    const callSid      = params.get("CallSid")      ?? "";
    const callStatus   = params.get("CallStatus")   ?? "completed";
    const callDuration = params.get("CallDuration") ?? "0";

    if (!callSid) return new NextResponse("OK", { status: 200 });

    await admin
      .from("voice_calls")
      .update({
        status:           STATUS_MAP[callStatus] ?? "completed",
        duration_seconds: parseInt(callDuration) || 0,
        ended_at:         new Date().toISOString(),
      })
      .eq("call_sid", callSid);

  } catch (err) {
    console.error("[voice/status] error:", err);
  }

  return new NextResponse("OK", { status: 200 });
}
