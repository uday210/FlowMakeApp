"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Zap,
  LayoutTemplate,
  Shield,
  Globe,
  Database,
  KeyRound,
  Plug,
  FileText,
  Home,
  HelpCircle,
  Building2,
  Table2,
  Bot,
  LogOut,
  Crown,
  Mail,
} from "lucide-react";

const USER_NAV = [
  { href: "/org", icon: Building2, label: "Organization" },
  { href: "/workflows", icon: Home, label: "Scenarios" },
  { href: "/tables", icon: Table2, label: "My Tables" },
  { href: "/agents", icon: Bot, label: "AI Agents" },
  { href: "/connections", icon: Shield, label: "Credentials" },
  { href: "/webhooks", icon: Globe, label: "Webhooks" },
  { href: "/datastores", icon: Database, label: "Data stores" },
  { href: "/mcp", icon: Plug, label: "MCP Toolboxes" },
  { href: "/secrets", icon: KeyRound, label: "Secrets" },
  { href: "/api-keys", icon: KeyRound, label: "API Keys" },
  { href: "/documents", icon: FileText, label: "E-Sign" },
  { href: "/doc-templates", icon: LayoutTemplate, label: "Doc Composer" },
  { href: "/email-templates", icon: Mail, label: "Email Templates" },
  { href: "/help", icon: HelpCircle, label: "Help & Docs" },
];

const ADMIN_NAV = [
  { href: "/admin", icon: Crown, label: "Admin Panel" },
  { href: "/help", icon: HelpCircle, label: "Help & Docs" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userInitial, setUserInitial] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name ?? user.email ?? "";
        setUserInitial(name.charAt(0).toUpperCase());
        setUserEmail(user.email ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsSuperAdmin(profile?.role === "superadmin");
      }
      setRoleLoaded(true);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[72px] bg-[#1a0a2e] flex flex-col items-center py-4 gap-1 flex-shrink-0">
        {/* Logo */}
        <button
          onClick={() => router.push(isSuperAdmin ? "/admin" : "/workflows")}
          className="mb-4 p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)" }}>
            <Zap size={18} className="text-white" />
          </div>
        </button>

        {/* Nav items — only render after role is confirmed to avoid flash of wrong nav */}
        {roleLoaded && (isSuperAdmin ? ADMIN_NAV : USER_NAV).map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              title={label}
              className={`group relative flex flex-col items-center gap-1 w-14 py-2 rounded-xl transition-all ${
                active
                  ? "text-white"
                  : isSuperAdmin
                  ? "text-amber-400/70 hover:bg-white/10 hover:text-amber-300"
                  : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
              style={active ? { background: "var(--gradient-brand)" } : undefined}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium leading-none">{label.split(" ")[0]}</span>

              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 hidden group-hover:block">
                {label}
              </div>
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* User avatar + logout */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <div
            title={userEmail}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-default"
            style={{ background: "var(--gradient-brand)" }}
          >
            {userInitial || "?"}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
