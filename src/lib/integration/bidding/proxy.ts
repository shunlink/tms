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
};

/**
 * Server-side HTTP client for TMS → Bidding admin/internal APIs.
 * Attaches `x-tms-integration-secret` (same contract as inbound Bidding → TMS calls).
 */
export async function fetchBiddingApi(
  endpoint: string,
  method: string,
  body?: unknown
): Promise<FetchBiddingApiResult> {
  const secret = process.env.BIDDING_TMS_INTEGRATION_SECRET?.trim();
  if (!secret) {
    throw new BiddingProxyError(
      "Bidding integration is not configured (BIDDING_SERVICE_URL / BIDDING_TMS_INTEGRATION_SECRET)",
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
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  return { ok: res.ok, status: res.status, data };
}
