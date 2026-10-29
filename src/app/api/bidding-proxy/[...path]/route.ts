import { NextResponse } from "next/server";
import { requireAuth, unauthorized, forbidden, serverError } from "@/lib/api";
import { BiddingProxyError, fetchBiddingApi } from "@/lib/integration/bidding/proxy";

function isBiddingAdmin(role: string | undefined | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

async function guardBiddingProxy() {
  const auth = await requireAuth();
  if (!auth) return { error: unauthorized() as NextResponse };
  if (!isBiddingAdmin(auth.actor.role)) {
    return { error: forbidden("Bidding System is restricted to Admins") as NextResponse };
  }
  return { auth };
}

function buildEndpoint(path: string[], search: string) {
  const joined = path.join("/");
  if (!search || search === "?") return joined;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${joined}?${qs}`;
}

async function forward(
  req: Request,
  path: string[],
  method: "GET" | "POST"
): Promise<NextResponse> {
  const guard = await guardBiddingProxy();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const endpoint = buildEndpoint(path, url.search);

  try {
    let body: unknown;
    if (method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        body = await req.json().catch(() => ({}));
      }
    }

    const result = await fetchBiddingApi(endpoint, method, body);

    if (!result.ok || result.parseError) {
      const payload =
        result.data && typeof result.data === "object"
          ? (result.data as Record<string, unknown>)
          : {};
      const message =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.message === "string" && payload.message) ||
        (result.status === 401
          ? "Bidding rejected credentials (401). Check BIDDING_TMS_INTEGRATION_SECRET matches the Bidding app."
          : result.parseError
            ? "Invalid response from Bidding (expected JSON)."
            : "Bidding request failed");
      const status = result.parseError
        ? 502
        : result.status === 401
          ? 401
          : result.status;
      return NextResponse.json(
        { error: message, code: payload.code ?? null, ...(result.parseError ? { parseError: true } : {}) },
        { status }
      );
    }

    return NextResponse.json(result.data ?? null, { status: result.status });
  } catch (e) {
    if (e instanceof BiddingProxyError) {
      const status = e.code === "REQUEST_FAILED" ? 502 : 503;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return serverError(e);
  }
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? [], "GET");
}

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? [], "POST");
}
