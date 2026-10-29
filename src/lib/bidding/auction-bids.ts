export type AuctionBidRow = {
  id: string;
  eventId?: string;
  vendorName: string;
  vendorCompanyId?: string;
  amount: number;
  placedAtLabel: string;
  placedAtMs: number;
};

export type AuctionBidChartPoint = {
  id: string;
  vendorName: string;
  amount: number;
  placedAtMs: number;
  timeLabel: string;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function resolveVendorName(raw: Record<string, unknown>): string {
  const direct = pickString(raw, [
    "vendorName",
    "vendorDisplayName",
    "companyName",
    "displayName",
    "legalName",
    "tradeName",
  ]);
  if (direct) return direct;

  const vendor = raw.vendor;
  if (vendor && typeof vendor === "object") {
    return (
      pickString(vendor as Record<string, unknown>, [
        "name",
        "displayName",
        "legalName",
        "tradeName",
        "companyName",
      ]) || "Unknown vendor"
    );
  }

  const company = raw.company;
  if (company && typeof company === "object") {
    return (
      pickString(company as Record<string, unknown>, ["name", "legalName", "tradeName"]) ||
      "Unknown vendor"
    );
  }

  return "Unknown vendor";
}

function resolvePlacedAt(raw: Record<string, unknown>): { label: string; ms: number } {
  const iso = pickString(raw, ["occurredAt", "placedAt", "createdAt", "bidAt", "timestamp", "time"]);
  if (iso) {
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms)) {
      return { label: new Date(ms).toLocaleString(), ms };
    }
    return { label: iso, ms: 0 };
  }
  return { label: "—", ms: 0 };
}

export function normalizeAuctionBid(raw: Record<string, unknown>): AuctionBidRow | null {
  const amount =
    pickNumber(raw, [
      "amount",
      "bidAmount",
      "priceInr",
      "amountInr",
      "price",
      "newPrice",
      "lowestPrice",
      "currentPrice",
      "bidAmountInr",
    ]) ?? null;
  if (amount == null) return null;

  const bidId = pickString(raw, ["bidId", "id", "_id"]);
  const eventIdRaw = pickString(raw, ["eventId"]);
  const eventId = eventIdRaw && eventIdRaw !== "—" ? eventIdRaw : undefined;
  const id =
    eventId ||
    bidId ||
    `${raw.vendorCompanyId ?? raw.vendorId ?? "bid"}-${amount}-${Date.now()}`;

  const { label, ms } = resolvePlacedAt(raw);
  const placedAtMs = ms > 0 ? ms : Date.now();
  const placedAtLabel = ms > 0 ? label : formatBidTimeAxis(placedAtMs);

  const vendorCompanyId = pickString(raw, ["vendorCompanyId", "vendorId", "companyId"]);
  return {
    id,
    eventId,
    vendorName: resolveVendorName(raw),
    vendorCompanyId: vendorCompanyId !== "—" ? vendorCompanyId : undefined,
    amount,
    placedAtLabel,
    placedAtMs,
  };
}

/** Keys for deduping the same price-drop from API history vs Pusher. */
export function auctionEventDedupeKeys(row: AuctionBidRow): string[] {
  const vendor = row.vendorCompanyId?.trim() || row.vendorName.toLowerCase();
  const keys = new Set<string>();
  if (row.eventId?.trim()) keys.add(`event:${row.eventId.trim()}`);
  keys.add(`drop:${vendor}:${row.amount}:${row.placedAtMs}`);
  return Array.from(keys);
}

export function auctionEventDedupeKey(row: AuctionBidRow): string {
  return auctionEventDedupeKeys(row)[0];
}

function registerAuctionEventKeys(seen: Set<string>, row: AuctionBidRow): void {
  for (const key of auctionEventDedupeKeys(row)) seen.add(key);
}

function isDuplicateAuctionEvent(seen: Set<string>, row: AuctionBidRow): boolean {
  return auctionEventDedupeKeys(row).some((key) => seen.has(key));
}

/** Merge bid events chronologically; skip duplicates across live + polled sources. */
export function mergeAuctionEventRows(
  prev: AuctionBidRow[],
  incoming: AuctionBidRow[],
): AuctionBidRow[] {
  const seen = new Set<string>();
  for (const row of prev) registerAuctionEventKeys(seen, row);
  const merged = [...prev];
  for (const row of incoming) {
    if (isDuplicateAuctionEvent(seen, row)) continue;
    registerAuctionEventKeys(seen, row);
    merged.push(row);
  }
  return merged.sort((a, b) => {
    if (a.placedAtMs !== b.placedAtMs) return a.placedAtMs - b.placedAtMs;
    return a.id.localeCompare(b.id);
  });
}

export function latestAuctionEventId(events: AuctionBidRow[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const id = events[i].eventId?.trim();
    if (id) return id;
  }
  return null;
}

/** Prepend live bid; skip duplicates by id. */
export function prependAuctionBid(prev: AuctionBidRow[], incoming: AuctionBidRow): AuctionBidRow[] {
  const key = auctionEventDedupeKey(incoming);
  if (prev.some((b) => auctionEventDedupeKey(b) === key)) return prev;
  return [incoming, ...prev];
}

function extractArrayField(data: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of keys) {
      const v = o[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

/** All bid events for chart / event tape (chronological). */
export function extractEventsPayload(data: unknown): Record<string, unknown>[] {
  return extractArrayField(data, ["recentEvents", "events", "history", "bids", "items", "data"]);
}

/** Current standing bids per vendor for leaderboard. */
export function extractStandingBidsPayload(data: unknown): Record<string, unknown>[] {
  const standing = extractArrayField(data, ["standingBids", "standings", "leaderboard"]);
  if (standing.length > 0) return standing;
  return extractArrayField(data, ["bids", "items", "data"]);
}

/** @deprecated Use extractEventsPayload / extractStandingBidsPayload */
export function extractBidsPayload(data: unknown): Record<string, unknown>[] {
  return extractEventsPayload(data);
}

export function normalizeEventList(rawItems: Record<string, unknown>[]): AuctionBidRow[] {
  const rows: AuctionBidRow[] = [];
  for (const item of rawItems) {
    const row = normalizeAuctionBid(item);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => a.placedAtMs - b.placedAtMs);
}

/** Lowest bid per vendor from event stream (fallback when API omits standingBids). */
function standingKeyForBid(row: AuctionBidRow): string {
  if (row.vendorCompanyId?.trim()) return row.vendorCompanyId.trim();
  return row.vendorName.toLowerCase();
}

export function deriveStandingFromEvents(events: AuctionBidRow[]): AuctionBidRow[] {
  const byVendor = new Map<string, AuctionBidRow>();
  for (const e of events) {
    const key = standingKeyForBid(e);
    const prev = byVendor.get(key);
    if (!prev || e.amount < prev.amount || (e.amount === prev.amount && e.placedAtMs > prev.placedAtMs)) {
      byVendor.set(key, e);
    }
  }
  return sortLeaderboardBids(Array.from(byVendor.values()));
}

export type AuctionBidsApiMeta = {
  requirementStatus?: string;
  routeSummary?: string;
  requirementTitle?: string;
  clientCompany?: string;
  participantCount?: number;
  bidCount?: number;
};

export function extractBidsApiMeta(data: unknown): AuctionBidsApiMeta {
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  const req = o.requirement;
  const nested =
    req && typeof req === "object" ? (req as Record<string, unknown>) : null;
  return {
    requirementStatus:
      (typeof o.requirementStatus === "string" && o.requirementStatus) ||
      (nested && typeof nested.status === "string" ? String(nested.status) : undefined) ||
      undefined,
    routeSummary:
      (typeof o.routeSummary === "string" && o.routeSummary) ||
      (nested && typeof nested.routeSummary === "string" ? String(nested.routeSummary) : undefined) ||
      undefined,
    requirementTitle:
      (typeof o.requirementTitle === "string" && o.requirementTitle) ||
      (nested && typeof nested.title === "string" ? String(nested.title) : undefined) ||
      undefined,
    clientCompany:
      (typeof o.clientCompany === "string" && o.clientCompany) ||
      (typeof o.clientName === "string" && o.clientName) ||
      (nested && typeof nested.clientName === "string" ? String(nested.clientName) : undefined) ||
      undefined,
    participantCount: pickNumber(o, ["participantCount"]) ?? undefined,
    bidCount: pickNumber(o, ["bidCount"]) ?? undefined,
  };
}

export function parseAuctionBidsResponse(data: unknown): {
  events: AuctionBidRow[];
  standing: AuctionBidRow[];
  meta: AuctionBidsApiMeta;
} {
  const events = normalizeEventList(extractEventsPayload(data));
  let standingRaw: Record<string, unknown>[] = [];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["standingBids", "standings", "leaderboard", "bids"]) {
      const v = o[key];
      if (Array.isArray(v)) {
        standingRaw = v as Record<string, unknown>[];
        break;
      }
    }
  }
  const standing =
    standingRaw.length > 0 ? normalizeBidList(standingRaw) : deriveStandingFromEvents(events);
  return { events, standing, meta: extractBidsApiMeta(data) };
}

/** Lowest bid first (winning row at top); newer bids break ties. */
export function sortLeaderboardBids(bids: AuctionBidRow[]): AuctionBidRow[] {
  return [...bids].sort((a, b) => {
    if (a.amount !== b.amount) return a.amount - b.amount;
    return b.placedAtMs - a.placedAtMs;
  });
}

export function mergeBidIntoLeaderboard(
  current: AuctionBidRow[],
  incoming: AuctionBidRow
): AuctionBidRow[] {
  const withoutDup = current.filter((b) => b.id !== incoming.id);
  return sortLeaderboardBids([incoming, ...withoutDup]);
}

export function normalizeBidList(rawItems: Record<string, unknown>[]): AuctionBidRow[] {
  const rows: AuctionBidRow[] = [];
  for (const item of rawItems) {
    const row = normalizeAuctionBid(item);
    if (row) rows.push(row);
  }
  return sortLeaderboardBids(rows);
}

export function formatBidTimeAxis(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function bidToChartPoint(bid: AuctionBidRow): AuctionBidChartPoint {
  const placedAtMs = bid.placedAtMs || Date.now();
  return {
    id: bid.id,
    vendorName: bid.vendorName,
    amount: bid.amount,
    placedAtMs,
    timeLabel: formatBidTimeAxis(placedAtMs),
  };
}

export function buildChartSeries(bids: AuctionBidRow[]): AuctionBidChartPoint[] {
  return bids.map(bidToChartPoint).sort((a, b) => a.placedAtMs - b.placedAtMs);
}

export function appendChartPoint(
  series: AuctionBidChartPoint[],
  bid: AuctionBidRow
): AuctionBidChartPoint[] {
  const point = bidToChartPoint(bid);
  if (series.some((p) => p.id === point.id)) return series;
  return [...series, point].sort((a, b) => a.placedAtMs - b.placedAtMs);
}

export function extractBidFromPusherPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const nested =
    o.bid && typeof o.bid === "object"
      ? (o.bid as Record<string, unknown>)
      : o.latestBid && typeof o.latestBid === "object"
        ? (o.latestBid as Record<string, unknown>)
        : null;

  if (nested) {
    return { ...nested, ...o };
  }
  return o;
}

export function auctionPusherChannelName(auctionId: string): string {
  return `auction_${auctionId}`;
}
