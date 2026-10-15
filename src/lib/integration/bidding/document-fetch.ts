/**
 * Fetch onboarding documents from Bidding.
 *
 * Supported:
 * - Absolute `downloadUrl` (public or same-origin internal path)
 * - Relative paths resolved with `BIDDING_SERVICE_URL`
 * - `documentId` → `{BIDDING_SERVICE_URL}/api/internal/tms-admin/documents/{id}/preview`
 *
 * Internal Bidding URLs are fetched with `Authorization: Bearer BIDDING_TMS_ADMIN_SECRET`.
 * Raw `storageKey`-only payloads are not supported in Phase 2 (Bidding must send URL or documentId).
 */

export type BiddingDocumentRef = {
  downloadUrl?: string | null;
  documentId?: string | null;
};

export function getBiddingServiceBaseUrl(): string | null {
  const raw = process.env.BIDDING_SERVICE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function resolveBiddingDocumentUrl(doc: BiddingDocumentRef): string | null {
  if (doc.downloadUrl?.trim()) {
    const url = doc.downloadUrl.trim();
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = getBiddingServiceBaseUrl();
    if (!base) return null;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
  }
  if (doc.documentId?.trim()) {
    const base = getBiddingServiceBaseUrl();
    if (!base) return null;
    return `${base}/api/internal/tms-admin/documents/${encodeURIComponent(doc.documentId.trim())}/preview`;
  }
  return null;
}

export function biddingDocumentNeedsAdminAuth(url: string): boolean {
  if (url.includes("/api/internal/tms-admin/")) return true;
  const base = getBiddingServiceBaseUrl();
  if (!base) return false;
  try {
    const resolved = new URL(url);
    const baseUrl = new URL(base);
    return resolved.origin === baseUrl.origin && resolved.pathname.includes("/api/internal/");
  } catch {
    return false;
  }
}

export async function fetchBiddingDocument(url: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (biddingDocumentNeedsAdminAuth(url)) {
    const secret = process.env.BIDDING_TMS_ADMIN_SECRET?.trim();
    if (!secret) {
      throw new Error(
        "BIDDING_TMS_ADMIN_SECRET is required to fetch Bidding internal document URLs"
      );
    }
    headers.Authorization = `Bearer ${secret}`;
  }
  return fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
}
