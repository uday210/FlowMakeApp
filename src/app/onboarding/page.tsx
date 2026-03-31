"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Zap, Building2, Loader2, AlertCircle, ArrowRight } from "lucide-react";

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setError("");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Create org
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), slug: slugify(orgName) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed to create org"); }

      router.push("/org");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a0a2e] via-[#2d1052] to-[#1a0a2e] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)" }}>
              <Zap size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">FlowMake</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Set up your workspace</h1>
          <p className="text-sm text-white/50 mt-1">Give your organization a name to get started</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1.5">Organization name</label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Inc."
                  required
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              {orgName && (
                <p className="text-[11px] text-white/30 mt-1.5">Slug: <span className="font-mono text-white/50">{slugify(orgName)}</span></p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button type="submit" disabled={loading || !orgName.trim()}
              className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : <>Create workspace <ArrowRight size={15} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
