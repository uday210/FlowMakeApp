import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  // Railway (and most proxies) set x-forwarded-host to the real public domain
  const fwdHost  = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto");
  if (fwdHost) {
    const proto = (fwdProto ?? "https").split(",")[0].trim();
    return `${proto}://${fwdHost}`;
  }
  // Fallback: env var set in Railway dashboard
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  // Last resort (will be localhost in local dev — that's fine)
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function errorTwiml(msg = "An application error occurred. Goodbye.") {
  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>${escapeXml(msg)}</Say><Hangup/></Response>`);
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    params.forEach((v, k) => { result[k] = v; });
    return result;
  } catch {
    return {};
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const admin = getAdmin();

    const body    = await parseBody(req);
    const callSid = body.CallSid  ?? "";
    const from    = body.From     ?? "";
    const to      = body.To       ?? "";

    // Load agent config
    const { data: agent, error: agentErr } = await admin
      .from("voice_agents")
      .select("*")
      .eq("id", agentId)
      .eq("is_active", true)
      .single();

    if (agentErr || !agent) {
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This number is not in service. Goodbye.</Say><Hangup/></Response>`);
    }

    // Create call record (ignore insert errors — don't block the call)
    await admin.from("voice_calls").insert({
      org_id:      agent.org_id,
      agent_id:    agentId,
      call_sid:    callSid,
      direction:   "inbound",
      from_number: from,
      to_number:   to,
      status:      "in-progress",
      transcript:  [],
    }).then(() => {}, () => {});

    const base = getBaseUrl(req);
    const gatherUrl = `${base}/api/voice/gather/${agentId}`;
    const statusUrl = `${base}/api/voice/status/${agentId}`;

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(agent.voice)}" language="${escapeXml(agent.language)}">${escapeXml(agent.greeting)}</Say>
  <Gather input="speech" action="${escapeXml(gatherUrl)}" method="POST" speechTimeout="auto" language="${escapeXml(agent.language)}" actionOnEmptyResult="true"/>
  <Say voice="${escapeXml(agent.voice)}" language="${escapeXml(agent.language)}">I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`);

  } catch (err) {
    console.error("[voice/webhook] error:", err);
    return errorTwiml();
  }
}
