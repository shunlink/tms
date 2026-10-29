export type RequirementRow = {
  id: string;
  clientName: string;
  origin: string;
  destination: string;
  material: string;
  quantityDisplay: string;
  vehicleType: string;
  status: string;
  lowestPrice: number | null;
  raw: Record<string, unknown>;
};

export function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return "—";
}

export function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function resolveOrigin(item: Record<string, unknown>): string {
  const direct = pickString(item, ["origin"]);
  if (direct !== "—") return direct;
  const lane = item.lane as Record<string, unknown> | undefined;
  const from = (lane?.from ?? item.routeFrom) as Record<string, unknown> | string | undefined;
  if (typeof from === "string" && from.trim()) return from.trim();
  return pickString((from as Record<string, unknown>) ?? {}, ["city", "addressLine1", "partyName"]);
}

export function resolveDestination(item: Record<string, unknown>): string {
  const direct = pickString(item, ["destination"]);
  if (direct !== "—") return direct;
  const lane = item.lane as Record<string, unknown> | undefined;
  const to = (lane?.to ?? item.routeTo) as Record<string, unknown> | string | undefined;
  if (typeof to === "string" && to.trim()) return to.trim();
  return pickString((to as Record<string, unknown>) ?? {}, ["city", "addressLine1", "partyName"]);
}

export function resolveClientName(item: Record<string, unknown>): string {
  const direct = pickString(item, ["clientName"]);
  if (direct !== "—") return direct;
  const clientObj = item.client as Record<string, unknown> | undefined;
  if (clientObj && typeof item.client === "object") {
    return pickString(clientObj, ["name", "legalName", "tradeName", "displayName"]);
  }
  return pickString(item, ["client"]);
}

export function resolveCargoField(item: Record<string, unknown>, keys: string[]): string {
  const direct = pickString(item, keys);
  if (direct !== "—") return direct;
  const cargo = item.cargo as Record<string, unknown> | undefined;
  if (cargo) return pickString(cargo, keys);
  return "—";
}

export function coerceStatus(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.code === "string") return o.code;
    if (typeof o.name === "string") return o.name;
    if (typeof o.status === "string") return o.status;
  }
  return String(value);
}

/** Flatten `{ requirement: { ... } }` admin payloads from Bidding. */
export function normalizeRequirementPayload(data: Record<string, unknown>): Record<string, unknown> {
  const req = data.requirement;
  if (req && typeof req === "object") {
    const inner = req as Record<string, unknown>;
    return { ...data, ...inner, requirement: req };
  }
  return data;
}

function splitRouteSummary(routeSummary: string): { origin: string; destination: string } | null {
  const parts = routeSummary.split(/\s*(?:→|->)\s*/);
  if (parts.length >= 2) {
    return { origin: parts[0].trim(), destination: parts.slice(1).join(" → ").trim() };
  }
  return null;
}

/** Status for TMS actions — never use trip.status. */
export function resolveRequirementStatus(
  detail: Record<string, unknown> | null,
  requirementStatusFromBids?: string | null
): string {
  if (requirementStatusFromBids?.trim()) {
    return coerceStatus(requirementStatusFromBids.trim());
  }
  if (!detail) return "—";
  const flat = normalizeRequirementPayload(detail);
  const nested = flat.requirement;
  if (nested && typeof nested === "object") {
    const s = coerceStatus((nested as Record<string, unknown>).status);
    if (s !== "—") return s;
  }
  const top = coerceStatus(flat.requirementStatus ?? flat.status);
  if (top !== "—") return top;
  return "—";
}

export type AuctionHeaderDisplay = {
  clientName: string;
  origin: string;
  destination: string;
  title: string;
};

export function resolveAuctionHeaderDisplay(
  detail: Record<string, unknown> | null,
  bidsMeta?: {
    routeSummary?: string;
    requirementTitle?: string;
    clientCompany?: string;
  } | null
): AuctionHeaderDisplay {
  const fromBids = bidsMeta ?? {};
  const routeFromBids = fromBids.routeSummary?.trim();
  if (routeFromBids) {
    const split = splitRouteSummary(routeFromBids);
    const client =
      fromBids.clientCompany?.trim() ||
      (detail ? resolveClientName(normalizeRequirementPayload(detail)) : "—");
    return {
      clientName: client !== "—" ? client : "—",
      origin: split?.origin ?? routeFromBids,
      destination: split?.destination ?? "—",
      title: fromBids.requirementTitle?.trim() || "—",
    };
  }

  if (detail) {
    const flat = normalizeRequirementPayload(detail);
    const nested = flat.requirement;
    const routeNested =
      nested && typeof nested === "object"
        ? pickString(nested as Record<string, unknown>, ["routeSummary"])
        : "—";
    if (routeNested !== "—") {
      const split = splitRouteSummary(routeNested);
      return {
        clientName: resolveClientName(flat),
        origin: split?.origin ?? routeNested,
        destination: split?.destination ?? "—",
        title:
          pickString(flat, ["title", "requirementTitle"]) !== "—"
            ? pickString(flat, ["title", "requirementTitle"])
            : nested && typeof nested === "object"
              ? pickString(nested as Record<string, unknown>, ["title"])
              : "—",
      };
    }
    return {
      clientName: resolveClientName(flat),
      origin: resolveOrigin(flat),
      destination: resolveDestination(flat),
      title: pickString(flat, ["title", "requirementTitle"]),
    };
  }

  return {
    clientName: "—",
    origin: "—",
    destination: "—",
    title: "—",
  };
}

export function normalizeRequirement(item: Record<string, unknown>): RequirementRow {
  const lowest =
    pickNumber(item, ["lowestPrice", "currentLowestPrice", "lowestBidPrice"]) ??
    pickNumber(item, ["lowestPriceInr", "currentLowestPriceInr"]);

  const id = pickString(item, ["id", "requirementId", "_id"]);
  return {
    id: id === "—" ? String(item.id ?? "") : id,
    clientName: resolveClientName(item),
    origin: resolveOrigin(item),
    destination: resolveDestination(item),
    material: resolveCargoField(item, [
      "material",
      "materialDescription",
      "cargoDescription",
      "description",
    ]),
    quantityDisplay: resolveCargoField(item, ["quantityDisplay", "quantity", "packageCount"]),
    vehicleType: resolveCargoField(item, ["vehicleType", "vehicleTypeCode", "vehicleCategory"]),
    status: resolveRequirementStatus(item, null),
    lowestPrice: lowest,
    raw: item,
  };
}

export function displayFromDetail(
  detail: Record<string, unknown> | null,
  fallback: RequirementRow | null
): Pick<
  RequirementRow,
  "clientName" | "origin" | "destination" | "material" | "quantityDisplay" | "vehicleType"
> {
  if (detail) {
    return {
      clientName: resolveClientName(detail),
      origin: resolveOrigin(detail),
      destination: resolveDestination(detail),
      material: resolveCargoField(detail, [
        "material",
        "materialDescription",
        "cargoDescription",
        "description",
      ]),
      quantityDisplay: resolveCargoField(detail, ["quantityDisplay", "quantity", "packageCount"]),
      vehicleType: resolveCargoField(detail, ["vehicleType", "vehicleTypeCode", "vehicleCategory"]),
    };
  }
  if (fallback) {
    return {
      clientName: fallback.clientName,
      origin: fallback.origin,
      destination: fallback.destination,
      material: fallback.material,
      quantityDisplay: fallback.quantityDisplay,
      vehicleType: fallback.vehicleType,
    };
  }
  return {
    clientName: "—",
    origin: "—",
    destination: "—",
    material: "—",
    quantityDisplay: "—",
    vehicleType: "—",
  };
}

export function resolveAuctionId(
  detail: Record<string, unknown> | null,
  raw?: Record<string, unknown>
): string {
  const sources = [detail, raw].filter((s): s is Record<string, unknown> => Boolean(s));
  for (const item of sources) {
    for (const key of ["auction", "activeAuction", "currentAuction"]) {
      const auction = item[key];
      if (auction && typeof auction === "object") {
        const id = (auction as Record<string, unknown>).id;
        if (id != null && String(id).trim()) return String(id).trim();
      }
    }
    const auctionId = item.auctionId ?? item.activeAuctionId;
    if (auctionId != null && String(auctionId).trim()) return String(auctionId).trim();
  }
  return "";
}

/** Auction-scoped APIs must use Bidding `auction.id`, never the load requirement id. */
export function resolveEffectiveAuctionId(
  auctionIdParam: string,
  requirementId: string,
  detail: Record<string, unknown> | null,
  raw?: Record<string, unknown>
): string {
  const req = requirementId.trim();
  const fromPayload = resolveAuctionId(detail, raw);
  const param = auctionIdParam.trim();

  if (param && param !== "pending" && param !== req) {
    return param;
  }
  return fromPayload;
}

export function extractListPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["requirements", "items", "data", "active"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export function auctionDetailHref(requirementId: string, auctionId: string, status: string): string | null {
  const req = requirementId.trim();
  if (!req) return null;
  const auction = auctionId.trim();
  if (auction) {
    return `/bidding-management/auctions/${encodeURIComponent(auction)}?requirementId=${encodeURIComponent(req)}`;
  }
  if (status === "PUBLISHED") {
    return `/bidding-management/auctions/pending?requirementId=${encodeURIComponent(req)}`;
  }
  if (status === "AUCTION_LIVE" || status === "AUCTION_CLOSED" || status === "AWARDED") {
    return null;
  }
  return `/bidding-management/auctions/pending?requirementId=${encodeURIComponent(req)}`;
}

export function isRealAuctionId(auctionId: string, requirementId?: string): boolean {
  const id = auctionId.trim();
  if (!id || id === "pending") return false;
  if (requirementId && id === requirementId.trim()) return false;
  return true;
}
