"use client";

import { supabase } from "@/lib/supabase";
import { ShieldOff, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrgDisabledPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100">
          <ShieldOff size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Suspended</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your organization has been suspended by an administrator. If you believe this is a mistake, please contact support.
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
