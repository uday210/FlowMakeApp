import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Called by the signing page on first load — marks when the signer opened the link.
// Only sets viewed_at once (if not already set).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  await supabase
    .from("esign_requests")
    .update({ viewed_at: new Date().toISOString() })
    .eq("token", token)
    .is("viewed_at", null); // only set once

  return NextResponse.json({ ok: true });
}
