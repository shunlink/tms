import { readJsonBody, resolveApiError } from "@/lib/api-client";
import { extractListPayload, normalizeRequirementPayload } from "@/lib/bidding/requirement-display";

const PROXY = "/api/bidding-proxy";

/** Bidding often returns `{ error: { code, message } }` instead of a string `error`. */
function normalizeBiddingErrorBody(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const o = data as Record<string, unknown>;
  const nested = o.error;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const e = nested as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) {
      return { ...o, error: e.message.trim(), code: e.code ?? o.code };
    }
  }
  return data;
}

export function formatBiddingProxyError(
  status: number,
  data: unknown,
  fallback = "Bidding request failed"
): string {
  const err = resolveApiError(
    { ok: false, status } as Response,
    normalizeBiddingErrorBody(data),
    fallback
  );
  if (status === 404) {
    const base =
      err.message ||
      "Not found on the Bidding server (404). Auction APIs need auction.id in the URL, not the requirement id.";
    return `${base} If this is GET admin/requirements/:id, the Bidding app may only support the active list — TMS will fall back to list data when possible.`;
  }
  if (status === 401) {
    return "Bidding rejected TMS credentials (401). Set BIDDING_TMS_INTEGRATION_SECRET (or BIDDING_TMS_ADMIN_SECRET) to match the Bidding app.";
  }
  if (status === 502) return "TMS could not reach the Bidding service or received non-JSON.";
  if (status === 503) return "Bidding integration is not configured on this server.";
  if (data && typeof data === "object" && (data as Record<string, unknown>).parseError) {
    return "Bidding proxy returned an invalid response (expected JSON).";
  }
  return err.message;
}

export async function fetchBiddingProxyGet(path: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const normalized = path.replace(/^\//, "");
  const res = await fetch(`${PROXY}/${normalized}`);
  const data = await readJsonBody(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchBiddingProxyPost(
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const normalized = path.replace(/^\//, "");
  const res = await fetch(`${PROXY}/${normalized}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : "{}",
  });
  const data = await readJsonBody(res);
  return { ok: res.ok, status: res.status, data };
}

export async function loadActiveRequirements(): Promise<{
  ok: boolean;
  error?: string;
  items: Record<string, unknown>[];
}> {
  const { ok, status, data } = await fetchBiddingProxyGet("admin/requirements/active");
  if (!ok) {
    const hint =
      status === 503
        ? "Check BIDDING_SERVICE_URL and BIDDING_TMS_INTEGRATION_SECRET on the TMS server."
        : status >= 500
          ? "The Bidding service returned an error or TMS could not reach it."
          : undefined;
    const fallback = hint ? `Failed to load requirements. ${hint}` : "Failed to load requirements";
    const err = resolveApiError({ ok, status } as Response, data, fallback);
    return { ok: false, error: err.message, items: [] };
  }
  return { ok: true, items: extractListPayload(data) };
}

function findRequirementInList(
  items: Record<string, unknown>[],
  requirementId: string
): Record<string, unknown> | null {
  const id = requirementId.trim();
  for (const item of items) {
    const flat = normalizeRequirementPayload(item);
    const rid = String(flat.id ?? flat.requirementId ?? "").trim();
    if (rid === id) return flat;
  }
  return null;
}

export async function loadRequirementDetail(requirementId: string): Promise<{
  data: Record<string, unknown> | null;
  error?: string;
  status?: number;
}> {
  const { ok, status, data } = await fetchBiddingProxyGet(
    `admin/requirements/${encodeURIComponent(requirementId)}`
  );
  if (ok && data && typeof data === "object") {
    return {
      data: normalizeRequirementPayload(data as Record<string, unknown>),
      status,
    };
  }

  // Bidding often exposes active list but not GET /requirements/:id — reuse list row for TMS detail chrome.
  if (status === 404) {
    const active = await loadActiveRequirements();
    if (active.ok) {
      const fromList = findRequirementInList(active.items, requirementId);
      if (fromList) {
        return { data: fromList, status: 200 };
      }
    }
  }

  return {
    data: null,
    status,
    error: formatBiddingProxyError(status, data, "Could not load requirement detail"),
  };
}

export type CurationSort = "lowest_bid" | "latest_bid" | "name_asc";

export type CurateQuoteInput = {
  vendorCompanyId: string;
  vendorPrice: number;
  clientPrice: number;
};

/** Bidding POST curate expects a JSON array of quotes (not `{ quotes }`). */
export async function submitAuctionCuration(
  auctionId: string,
  quotes: CurateQuoteInput[]
): Promise<{ ok: boolean; data: unknown; status: number }> {
  return fetchBiddingProxyPost(`admin/auctions/${encodeURIComponent(auctionId)}/curate`, quotes);
}

export async function loadCurationCandidates(
  auctionId: string,
  q: string,
  sort: CurationSort
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("sort", sort);
  const qs = params.toString();
  return fetchBiddingProxyGet(
    `admin/auctions/${encodeURIComponent(auctionId)}/curation-candidates${qs ? `?${qs}` : ""}`
  );
}
