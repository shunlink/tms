export type AuctionBidRow = {
  id: string;
  vendorName: string;
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
  const iso = pickString(raw, ["placedAt", "createdAt", "bidAt", "timestamp", "time"]);
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

  const id =
    pickString(raw, ["id", "bidId", "_id"]) ||
    `${raw.vendorCompanyId ?? raw.vendorId ?? "bid"}-${amount}-${Date.now()}`;

  const { label, ms } = resolvePlacedAt(raw);
  const placedAtMs = ms > 0 ? ms : Date.now();
  const placedAtLabel = ms > 0 ? label : formatBidTimeAxis(placedAtMs);

  return {
    id,
    vendorName: resolveVendorName(raw),
    amount,
    placedAtLabel,
    placedAtMs,
  };
}

/** Prepend live bid; skip duplicates by id. */
export function prependAuctionBid(prev: AuctionBidRow[], incoming: AuctionBidRow): AuctionBidRow[] {
  if (prev.some((b) => b.id === incoming.id)) return prev;
  return [incoming, ...prev];
}

export function extractBidsPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["bids", "items", "data", "history"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
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
