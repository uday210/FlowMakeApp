import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/auth/reset-password",
  "/org-disabled",
];

// Route prefixes that are always public (webhooks, public forms, embed)
const PUBLIC_PREFIXES = [
  "/api/webhook/",
  "/api/esign/",
  "/api/v1/",
  "/api/oauth/",
  "/api/approvals/",
  "/api/scheduler/",
  "/api/mcp/hosted/",
  "/api/tracker",
  "/api/t",
  "/embed/",
  "/form/",
  "/sign/",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public prefixes
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Always allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.endsWith(".html")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated user trying to access auth pages or landing → redirect to app
  if (user && (pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/")) {
    return NextResponse.redirect(new URL("/org", request.url));
  }

  // Unauthenticated user trying to access protected route → redirect to login
  if (!user && !PUBLIC_ROUTES.includes(pathname)) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user with no org → must complete onboarding
  // Skip this check for API routes, onboarding, admin panel, and superadmins
  if (user && pathname !== "/onboarding" && pathname !== "/org-disabled" && !pathname.startsWith("/api/") && !pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role, orgs(is_active)")
      .eq("id", user.id)
      .single();

    // Superadmins bypass org requirements — they control the whole platform
    if (profile?.role === "superadmin") {
      return response;
    }

    if (!profile?.org_id) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Org is disabled by admin
    const orgActive = (profile.orgs as { is_active?: boolean } | null)?.is_active;
    if (orgActive === false) {
      return NextResponse.redirect(new URL("/org-disabled", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
