import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { forbiddenErrorBody } from "./lib/api-errors";

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

/** Files in `public/portal/` (e.g. onboarding/dashboard WebP heroes). Not app routes under /portal/client|vendor. */
function isPublicPortalStaticAsset(pathname: string) {
  return /^\/portal\/[^/]+\.(webp|jpe?g|png|gif|svg)$/i.test(pathname);
}

function forwardWithPathname(req: { headers: Headers; nextUrl: { pathname: string } }) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function apiAllowed(role: string, method: string, pathname: string) {
  if (pathname.startsWith("/api/portal/")) return true;
  if (pathname === "/api/geocode" && method === "GET") return true;

  if (role === "CLIENT") {
    return (
      (method === "POST" && pathname === "/api/requirements") ||
      (method === "GET" && pathname === "/api/sidebar/pending-counts") ||
      (method === "GET" && pathname === "/api/geocode") ||
      (method === "GET" && pathname === "/api/maps/config")
    );
  }
  if (role === "VENDOR") {
    return (
      (method === "POST" && /^\/api\/indents\/[^/]+\/quotes$/.test(pathname)) ||
      (method === "GET" && /^\/api\/indents\/[^/]+\/quotes$/.test(pathname)) ||
      (method === "GET" && pathname === "/api/sidebar/pending-counts") ||
      /^\/api\/portal\/vendor\/trips\/[^/]+\/advance$/.test(pathname) ||
      /^\/api\/trips\/[^/]+\/documents$/.test(pathname) ||
      (method === "GET" && pathname === "/api/geocode") ||
      (method === "GET" && pathname === "/api/maps/config")
    );
  }
  if (role === "DRIVER") {
    return (
      (method === "GET" && pathname === "/api/drivers/me") ||
      (method === "GET" && pathname === "/api/drivers/me/trips") ||
      (method === "GET" && pathname === "/api/drivers/me/current-indent") ||
      (method === "GET" && /^\/api\/drivers\/me\/trips\/[^/]+$/.test(pathname)) ||
      (method === "GET" && /^\/api\/drivers\/me\/trips\/[^/]+\/map-display$/.test(pathname)) ||
      (method === "POST" && /^\/api\/drivers\/me\/trips\/[^/]+\/pod$/.test(pathname)) ||
      (method === "POST" && pathname === "/api/drivers/me/pod") ||
      (method === "GET" && /^\/api\/trips\/[^/]+\/documents$/.test(pathname)) ||
      (method === "GET" && pathname === "/api/maps/config") ||
      (method === "PATCH" && pathname === "/api/portal/profile") ||
      (method === "GET" && pathname === "/api/portal/documents") ||
      (method === "POST" && pathname === "/api/portal/documents") ||
      (method === "POST" && /^\/api\/drivers\/[^/]+\/(send-otp|verify-otp)$/.test(pathname)) ||
      (method === "POST" && /^\/api\/indents\/[^/]+\/(pod|tracking)$/.test(pathname)) ||
      (method === "GET" && /^\/api\/indents\/[^/]+\/tracking$/.test(pathname)) ||
      (method === "POST" && /^\/api\/trips\/[^/]+\/tracking$/.test(pathname)) ||
      (method === "POST" && /^\/api\/trips\/[^/]+\/documents$/.test(pathname))
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

    // Public marketing / portal chooser — not the employee dashboard
    if (pathname === "/" && !token?.sub) {
      return NextResponse.redirect(new URL("/welcome", req.url));
    }

    if (isPublicPortalStaticAsset(pathname)) {
      return forwardWithPathname(req);
    }

    if (pathname.startsWith("/superadmin")) {
      if (realRole !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return forwardWithPathname(req);
    }

    const isPortal = pathname.startsWith("/portal");
    const isDriver = pathname === "/driver" || pathname.startsWith("/driver/");
    const isApi = pathname.startsWith("/api");
    const isFile = pathname.startsWith("/files");
    const isCapture = pathname.startsWith("/capture");

    if (isApi && method === "GET" && pathname === "/api/maps/config") {
      return forwardWithPathname(req);
    }

    if (role === "CLIENT") {
      if (pathname.startsWith("/portal/client") || pathname.startsWith("/onboard/client") || isCapture) {
        return forwardWithPathname(req);
      }
      if (isFile) return forwardWithPathname(req);
      if (isApi) {
        return apiAllowed(role, method, pathname)
          ? forwardWithPathname(req)
          : NextResponse.json(forbiddenErrorBody(), { status: 403 });
      }
      return NextResponse.redirect(new URL("/portal/client", req.url));
    }

    if (role === "VENDOR") {
      if (pathname.startsWith("/portal/vendor") || pathname.startsWith("/onboard/vendor") || isCapture) {
        return forwardWithPathname(req);
      }
      if (isFile) return forwardWithPathname(req);
      if (isApi) {
        return apiAllowed(role, method, pathname)
          ? forwardWithPathname(req)
          : NextResponse.json(forbiddenErrorBody(), { status: 403 });
      }
      return NextResponse.redirect(new URL("/portal/vendor", req.url));
    }

    if (role === "DRIVER") {
      if (isDriver || isCapture) return forwardWithPathname(req);
      if (isFile) return forwardWithPathname(req);
      if (isApi) {
        return apiAllowed(role, method, pathname)
          ? forwardWithPathname(req)
          : NextResponse.json(forbiddenErrorBody(), { status: 403 });
      }
      return NextResponse.redirect(new URL("/driver", req.url));
    }

    // Internal roles (SUPER_ADMIN / ADMIN / SALES / OPERATIONS / FINANCE)
    if (INTERNAL_ROLES.includes(role)) {
      if (isPortal) return NextResponse.redirect(new URL("/", req.url));
      if (isDriver) return NextResponse.redirect(new URL("/", req.url));
      return forwardWithPathname(req);
    }

    return NextResponse.redirect(new URL("/login", req.url));
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === "/") return true;
        if (req.nextUrl.pathname === "/api/maps/config") return true;
        return !!token?.sub;
      },
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/webhooks|api/webhook|api/public|api/integration/bidding|api/drivers/otp|api/drivers/register|login(?:/|$)|signup|welcome|quote(?:/|$)|_next/static|_next/image|favicon.ico|brand/|auth/|images/|portal/[^/]+\\.(?:webp|jpg|jpeg|png|gif|svg)).*)",
  ],
};
