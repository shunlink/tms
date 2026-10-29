import { getBiddingServiceBaseUrl } from "./document-fetch";

export class BiddingProxyError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "REQUEST_FAILED" = "NOT_CONFIGURED"
  ) {
    super(message);
    this.name = "BiddingProxyError";
  }
}

/** Bidding app is mounted at `/bidding`; API routes live under `/bidding/api/...`. */
export function resolveBiddingApiRoot(): string {
  const base = getBiddingServiceBaseUrl();
  if (!base) {
    throw new BiddingProxyError(
      "Bidding integration is not configured (BIDDING_SERVICE_URL / BIDDING_TMS_INTEGRATION_SECRET)",
      "NOT_CONFIGURED"
    );
  }
  return base.endsWith("/bidding") ? base : `${base}/bidding`;
}

export function buildBiddingTargetUrl(endpoint: string): string {
  const root = resolveBiddingApiRoot();
  const normalized = endpoint.replace(/^\//, "");
  const [pathOnly, query = ""] = normalized.split("?");
  const path = pathOnly.replace(/^\/+/, "").replace(/\/+/g, "/");
  const baseForUrl = root.endsWith("/") ? root : `${root}/`;
  const url = new URL(`api/${path}`, baseForUrl);
  if (query) {
    url.search = query;
  }
  return url.toString();
}

export type FetchBiddingApiResult = {
  ok: boolean;
  status: number;
  data: unknown;
  /** True when body was HTML or non-JSON (e.g. misconfigured proxy URL). */
  parseError?: boolean;
};

function resolveBiddingOutboundSecret(): string {
  return (
    process.env.BIDDING_TMS_INTEGRATION_SECRET?.trim() ||
    process.env.BIDDING_TMS_ADMIN_SECRET?.trim() ||
    ""
  );
}

function parseBiddingResponseBody(
  text: string,
  contentType: string | null
): { data: unknown; parseError: boolean } {
  if (!text.trim()) return { data: null, parseError: false };
  const trimmed = text.trim();
  const looksHtml =
    trimmed.startsWith("<") || (contentType?.toLowerCase().includes("text/html") ?? false);
  if (looksHtml) {
    return {
      data: {
        error: "Bidding returned HTML instead of JSON. Check BIDDING_SERVICE_URL includes /bidding if needed.",
        code: "INVALID_RESPONSE",
      },
      parseError: true,
    };
  }
  try {
    return { data: JSON.parse(text) as unknown, parseError: false };
  } catch {
    return {
      data: {
        error: "Bidding returned a non-JSON response",
        code: "INVALID_RESPONSE",
        raw: trimmed.slice(0, 300),
      },
      parseError: true,
    };
  }
}

/**
 * Server-side HTTP client for TMS → Bidding admin/internal APIs.
 * Attaches `x-tms-integration-secret` (same contract as inbound Bidding → TMS calls).
 */
export async function fetchBiddingApi(
  endpoint: string,
  method: string,
  body?: unknown
): Promise<FetchBiddingApiResult> {
  const secret = resolveBiddingOutboundSecret();
  if (!secret) {
    throw new BiddingProxyError(
      "Bidding integration is not configured (BIDDING_SERVICE_URL and BIDDING_TMS_INTEGRATION_SECRET or BIDDING_TMS_ADMIN_SECRET)",
      "NOT_CONFIGURED"
    );
  }

  let targetUrl: string;
  try {
    targetUrl = buildBiddingTargetUrl(endpoint);
  } catch (e) {
    if (e instanceof BiddingProxyError) throw e;
    throw new BiddingProxyError("Invalid Bidding API endpoint", "NOT_CONFIGURED");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-tms-integration-secret": secret,
    Authorization: `Bearer ${secret}`,
  };

  const init: RequestInit = {
    method: method.toUpperCase(),
    headers,
    cache: "no-store",
  };

  if (body !== undefined && method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    console.log("Proxying to:", targetUrl);
    res = await fetch(targetUrl, init);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Network error";
    throw new BiddingProxyError(`Could not reach Bidding service: ${reason}`, "REQUEST_FAILED");
  }
  const text = await res.text();
  const contentType = res.headers.get("content-type");
  const { data, parseError } = parseBiddingResponseBody(text, contentType);
  const ok = res.ok && !parseError;

  return { ok, status: res.status, data, parseError };
}
