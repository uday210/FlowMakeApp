"use client";

import { usePathname, useRouter } from "next/navigation";
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
} from "lucide-react";

const NAV = [
  { href: "/org", icon: Building2, label: "Organization" },
  { href: "/", icon: Home, label: "Scenarios" },
  { href: "/templates", icon: LayoutTemplate, label: "Templates" },
  { href: "/tables", icon: Table2, label: "My Tables" },
  { href: "/agents", icon: Bot, label: "AI Agents" },
  { href: "/connections", icon: Shield, label: "Credentials" },
  { href: "/webhooks", icon: Globe, label: "Webhooks" },
  { href: "/datastores", icon: Database, label: "Data stores" },
  { href: "/mcp", icon: Plug, label: "MCP Toolboxes" },
  { href: "/secrets", icon: KeyRound, label: "Secrets" },
  { href: "/documents", icon: FileText, label: "E-Sign" },
  { href: "/help", icon: HelpCircle, label: "Help & Docs" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[72px] bg-[#1a0a2e] flex flex-col items-center py-4 gap-1 flex-shrink-0">
        {/* Logo */}
        <button
          onClick={() => router.push("/")}
          className="mb-4 p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)" }}>
            <Zap size={18} className="text-white" />
          </div>
        </button>

        {/* Nav items */}
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/workflows") : pathname.startsWith(href);
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              title={label}
              className={`group relative flex flex-col items-center gap-1 w-14 py-2 rounded-xl transition-all ${
                active
                  ? "text-white"
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
