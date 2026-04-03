"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get("code");
    const redirectTo = searchParams.get("redirect") ?? "/org";

    if (!code) {
      router.replace(redirectTo);
      return;
    }

    // Exchange the code client-side — the PKCE code_verifier is in localStorage here
    supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ data, error }) => {
        if (error || !data?.user) {
          console.error("[callback] exchange error:", error?.message);
          router.replace("/auth/login?error=auth_failed");
          return;
        }

        // Upsert profile via API route (needs service role key)
        try {
          await fetch("/api/auth/ensure-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id, userMeta: data.user.user_metadata }),
          });
        } catch (_) {
          // Non-fatal — profile creation failure shouldn't block login
        }

        router.replace(redirectTo);
      })
      .catch((err) => {
        console.error("[callback] unexpected error:", err);
        router.replace("/auth/login?error=unexpected");
      });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a0a2e] via-[#2d1052] to-[#1a0a2e]">
      <div className="flex flex-col items-center gap-3 text-white/60">
        <Loader2 size={28} className="animate-spin text-violet-400" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
