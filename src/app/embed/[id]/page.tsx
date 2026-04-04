import { createClient } from "@supabase/supabase-js";
import EmbedChat, { type AgentConfig } from "./EmbedChat";

// Server component — fetches agent config at request time, no client-side fetch needed.
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  const { data } = await supabase
    .from("chatbots")
    .select("id, name, appearance, starter_questions")
    .eq("id", id)
    .single();

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🤖</div>
          <p className="text-sm font-medium text-gray-700">Agent not found</p>
          <p className="text-xs text-gray-400 mt-1">Check that the agent ID is correct.</p>
        </div>
      </div>
    );
  }

  // Pass the public app URL so EmbedChat can make absolute API calls.
  // This avoids relative-URL resolution issues when the page is in a cross-origin iframe.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return <EmbedChat agent={data as AgentConfig} appUrl={appUrl} />;
}
