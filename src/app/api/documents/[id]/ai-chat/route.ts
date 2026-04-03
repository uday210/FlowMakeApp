import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Public endpoint — no org auth needed (signers aren't logged in).
// We verify the document exists and has AI enabled before calling the LLM.

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  // 1. Fetch document (no org restriction — signer has the doc id from the signing URL)
  const { data: doc } = await supabase
    .from("esign_documents")
    .select("id, name, ai_enabled, extracted_text, org_id")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!doc.ai_enabled) return NextResponse.json({ error: "AI not enabled for this document" }, { status: 403 });

  // 2. Fetch org AI settings
  const { data: orgSettings } = await supabase
    .from("org_settings")
    .select("esign_ai_enabled, esign_ai_provider, esign_ai_model, esign_ai_api_key")
    .eq("org_id", doc.org_id)
    .single();

  if (!orgSettings?.esign_ai_enabled || !orgSettings.esign_ai_api_key) {
    return NextResponse.json({ error: "AI not configured for this organization" }, { status: 403 });
  }

  const { message, history } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const systemPrompt = `You are a helpful document assistant. A signer is about to sign a document and has questions about it.
Be clear, concise, and helpful. Only answer questions about this document.
${doc.extracted_text ? `\n\nDocument content:\n${doc.extracted_text.slice(0, 12000)}` : "\n\nNote: document text was not extracted — answer based on general knowledge of document signing."}`;

  const provider = orgSettings.esign_ai_provider ?? "openai";
  const model    = orgSettings.esign_ai_model    ?? "gpt-4o-mini";
  const apiKey   = orgSettings.esign_ai_api_key;

  // 3. Build messages array
  const messages = [
    ...(Array.isArray(history) ? history.slice(-10) : []),
    { role: "user", content: message },
  ];

  // 4. Stream from the configured provider
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return new NextResponse(res.body, {
      headers: {
        "Content-Type":                "text/event-stream",
        "Cache-Control":               "no-cache",
        "Access-Control-Allow-Origin": "*",
        "X-Provider":                  "anthropic",
      },
    });
  }

  // Default: OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type":                "text/event-stream",
      "Cache-Control":               "no-cache",
      "Access-Control-Allow-Origin": "*",
      "X-Provider":                  "openai",
    },
  });
}
