import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const INTERNAL_ROLES = ["SUPER_ADMIN", "ADMIN", "SALES", "OPERATIONS", "FINANCE", "VENDOR_TEAM"];

type PortalAccessToken = {
  targetRole?: string;
  expiresAt?: number;
};

function effectiveRole(token: { role?: string; portalAccess?: PortalAccessToken | null }) {
  const pa = token.portalAccess;
  if (pa?.targetRole && pa.expiresAt && pa.expiresAt > Date.now()) {
    return pa.targetRole;
  }
  return (token.role as string) ?? "OPERATIONS";
}

function actorRole(token: { role?: string }) {
  return (token.role as string) ?? "OPERATIONS";
}

function apiAllowed(role: string, method: string, pathname: string) {
  if (pathname.startsWith("/api/portal/")) return true;
  if (pathname === "/api/geocode" && method === "GET") return true;

  if (role === "CLIENT") {
    return (
      (method === "POST" && pathname === "/api/requirements") ||
      (method === "GET" && pathname === "/api/sidebar/pending-counts")
    );
  }
  if (role === "VENDOR") {
    return (
      (method === "POST" && /^\/api\/indents\/[^/]+\/quotes$/.test(pathname)) ||
      (method === "GET" && /^\/api\/indents\/[^/]+\/quotes$/.test(pathname)) ||
      (method === "GET" && pathname === "/api/sidebar/pending-counts") ||
      /^\/api\/portal\/vendor\/trips\/[^/]+\/advance$/.test(pathname) ||
      /^\/api\/trips\/[^/]+\/documents$/.test(pathname)
    );
  }
  if (role === "DRIVER") {
    return (
      (method === "GET" && pathname === "/api/drivers/me/current-indent") ||
      (method === "POST" && /^\/api\/drivers\/[^/]+\/(send-otp|verify-otp)$/.test(pathname)) ||
      (method === "POST" && /^\/api\/indents\/[^/]+\/(pod|tracking)$/.test(pathname)) ||
      (method === "GET" && /^\/api\/indents\/[^/]+\/tracking$/.test(pathname)) ||
      (method === "POST" && /^\/api\/trips\/[^/]+\/tracking$/.test(pathname))
    );
  }
  return true;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token ?? {};
    const role = effectiveRole(token);
    const realRole = actorRole(token);
    const { pathname } = req.nextUrl;
    const method = req.method ?? "GET";

    if (pathname.startsWith("/superadmin")) {
      if (realRole !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return NextResponse.next();
    }

    const isPortal = pathname.startsWith("/portal");
    const isDriver = pathname === "/driver" || pathname.startsWith("/driver/");
    const isApi = pathname.startsWith("/api");
    const isFile = pathname.startsWith("/files");
    const isCapture = pathname.startsWith("/capture");

    if (role === "CLIENT") {
      if (pathname.startsWith("/portal/client") || pathname.startsWith("/onboard/client") || isCapture) return NextResponse.next();
      if (isFile) return NextResponse.next();
      if (isApi) {
        return apiAllowed(role, method, pathname)
          ? NextResponse.next()
          : NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/portal/client", req.url));
    }

    if (role === "VENDOR") {
      if (pathname.startsWith("/portal/vendor") || pathname.startsWith("/onboard/vendor") || isCapture) return NextResponse.next();
      if (isFile) return NextResponse.next();
      if (isApi) {
        return apiAllowed(role, method, pathname)
          ? NextResponse.next()
          : NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/portal/vendor", req.url));
    }

    if (role === "DRIVER") {
      if (isDriver || isCapture) return NextResponse.next();
      if (isFile) return NextResponse.next();
      if (isApi) {
        return apiAllowed(role, method, pathname)
          ? NextResponse.next()
          : NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/driver", req.url));
    }

    // Internal roles (SUPER_ADMIN / ADMIN / SALES / OPERATIONS / FINANCE)
    if (INTERNAL_ROLES.includes(role)) {
      if (isPortal) return NextResponse.redirect(new URL("/", req.url));
      if (isDriver) return NextResponse.redirect(new URL("/", req.url));
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/login", req.url));
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token?.sub,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/webhooks|api/webhook|api/integration/bidding|api/drivers/otp|login(?:/|$)|signup|welcome|_next/static|_next/image|favicon.ico|brand/|auth/|images/).*)",
  ],
};
