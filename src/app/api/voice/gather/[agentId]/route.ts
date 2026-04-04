import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  const fwdHost  = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto");
  if (fwdHost) {
    const proto = (fwdProto ?? "https").split(",")[0].trim();
    return `${proto}://${fwdHost}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
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

    const body       = await parseBody(req);
    const callSid    = body.CallSid      ?? "";
    const speechText = (body.SpeechResult ?? "").trim();

    const gatherUrl  = `${getBaseUrl(req)}/api/voice/gather/${agentId}`;

    // Load agent
    const { data: agent, error: agentErr } = await admin
      .from("voice_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentErr || !agent) {
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Configuration error. Goodbye.</Say><Hangup/></Response>`);
    }

    const voice    = escapeXml(agent.voice);
    const language = escapeXml(agent.language);

    // Load call record by callSid
    const { data: call } = await admin
      .from("voice_calls")
      .select("id, transcript")
      .eq("call_sid", callSid)
      .single();

    const transcript: { role: string; text: string; ts: string }[] =
      (call?.transcript as { role: string; text: string; ts: string }[]) ?? [];

    // No speech detected
    if (!speechText) {
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">I didn't catch that. Could you please repeat?</Say>
  <Gather input="speech" action="${escapeXml(gatherUrl)}" method="POST" speechTimeout="auto" language="${language}" actionOnEmptyResult="true"/>
  <Hangup/>
</Response>`);
    }

    // Append user turn
    transcript.push({ role: "user", text: speechText, ts: new Date().toISOString() });

    // Check max turns
    const userTurns = transcript.filter(t => t.role === "user").length;
    if (userTurns > agent.max_turns) {
      if (call) {
        await admin.from("voice_calls").update({ transcript }).eq("id", call.id).then(() => {}).catch(() => {});
      }
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">We have reached the end of our conversation. Thank you for calling. Goodbye!</Say>
  <Hangup/>
</Response>`);
    }

    // Call OpenAI
    let agentReply = "I'm sorry, I'm having trouble responding right now. Please try again later.";
    try {
      const messages = [
        {
          role: "system",
          content: agent.system_prompt +
            "\n\nCRITICAL: This is a phone call. Keep every response under 2 short sentences. No markdown, no lists, no special characters.",
        },
        ...transcript.map((t: { role: string; text: string }) => ({
          role: t.role as "user" | "assistant",
          content: t.text,
        })),
      ];

      const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${agent.llm_api_key}`,
        },
        body: JSON.stringify({
          model: agent.llm_model,
          messages,
          max_tokens: 120,
          temperature: 0.7,
        }),
      });

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        agentReply = llmData.choices?.[0]?.message?.content?.trim() ?? agentReply;
      } else {
        console.error("[voice/gather] OpenAI error:", await llmRes.text());
      }
    } catch (llmErr) {
      console.error("[voice/gather] LLM call failed:", llmErr);
    }

    // Append assistant turn & save
    transcript.push({ role: "assistant", text: agentReply, ts: new Date().toISOString() });
    if (call) {
      await admin.from("voice_calls").update({ transcript }).eq("id", call.id).then(() => {}).catch(() => {});
    }

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(agentReply)}</Say>
  <Gather input="speech" action="${escapeXml(gatherUrl)}" method="POST" speechTimeout="auto" language="${language}" actionOnEmptyResult="true"/>
  <Hangup/>
</Response>`);

  } catch (err) {
    console.error("[voice/gather] unhandled error:", err);
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>An error occurred. Please try again. Goodbye.</Say><Hangup/></Response>`);
  }
}
