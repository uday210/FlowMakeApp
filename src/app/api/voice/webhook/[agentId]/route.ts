import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Public — called by Twilio, no auth cookie
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;

  // Load agent config
  const { data: agent } = await admin
    .from("voice_agents")
    .select("*")
    .eq("id", agentId)
    .eq("is_active", true)
    .single();

  if (!agent) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This number is not in service. Goodbye.</Say><Hangup/></Response>`);
  }

  // Parse Twilio form body
  const formData = await req.formData();
  const callSid   = formData.get("CallSid")  as string ?? "";
  const from      = formData.get("From")     as string ?? "";
  const to        = formData.get("To")       as string ?? "";

  // Create call record
  await admin.from("voice_calls").insert({
    org_id:      agent.org_id,
    agent_id:    agentId,
    call_sid:    callSid,
    direction:   "inbound",
    from_number: from,
    to_number:   to,
    status:      "in-progress",
    transcript:  [],
  });

  // Build gather URL
  const url = new URL(req.url);
  const gatherUrl = `${url.protocol}//${url.host}/api/voice/gather/${agentId}`;

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${agent.voice}" language="${agent.language}">${escapeXml(agent.greeting)}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" speechTimeout="auto" language="${agent.language}"/>
  <Say voice="${agent.voice}" language="${agent.language}">I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`);
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
