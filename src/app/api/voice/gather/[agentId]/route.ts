import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;

  const formData    = await req.formData();
  const callSid     = formData.get("CallSid")     as string ?? "";
  const speechText  = (formData.get("SpeechResult") as string ?? "").trim();

  // Load agent
  const { data: agent } = await admin
    .from("voice_agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>`);
  }

  // Load call record
  const { data: call } = await admin
    .from("voice_calls")
    .select("id, transcript")
    .eq("call_sid", callSid)
    .single();

  if (!call) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>`);
  }

  const transcript: { role: string; text: string; ts: string }[] = call.transcript ?? [];

  // Handle no speech
  if (!speechText) {
    const url = new URL(req.url);
    const gatherUrl = `${url.protocol}//${url.host}/api/voice/gather/${agentId}`;
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${agent.voice}" language="${agent.language}">I didn't catch that. Could you repeat?</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" speechTimeout="auto" language="${agent.language}"/>
  <Hangup/>
</Response>`);
  }

  // Append user turn
  transcript.push({ role: "user", text: speechText, ts: new Date().toISOString() });

  // Check max turns
  const userTurns = transcript.filter(t => t.role === "user").length;
  if (userTurns > agent.max_turns) {
    await admin.from("voice_calls").update({ transcript }).eq("id", call.id);
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${agent.voice}" language="${agent.language}">We've reached the end of our conversation. Thank you for calling. Goodbye!</Say>
  <Hangup/>
</Response>`);
  }

  // Call LLM
  let agentReply = "I'm sorry, I encountered an error. Please try again.";
  try {
    const messages = [
      {
        role: "system",
        content: agent.system_prompt + "\n\nIMPORTANT: Keep your response under 2 sentences. No markdown, no lists, no special characters.",
      },
      ...transcript.map(t => ({ role: t.role as "user" | "assistant", content: t.text })),
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
    }
  } catch {
    // keep default error reply
  }

  // Append assistant turn
  transcript.push({ role: "assistant", text: agentReply, ts: new Date().toISOString() });

  // Save updated transcript
  await admin.from("voice_calls").update({ transcript }).eq("id", call.id);

  const url = new URL(req.url);
  const gatherUrl = `${url.protocol}//${url.host}/api/voice/gather/${agentId}`;

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${agent.voice}" language="${agent.language}">${escapeXml(agentReply)}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" speechTimeout="auto" language="${agent.language}"/>
  <Say voice="${agent.voice}" language="${agent.language}">Is there anything else I can help you with?</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" speechTimeout="auto" language="${agent.language}"/>
  <Hangup/>
</Response>`);
}
