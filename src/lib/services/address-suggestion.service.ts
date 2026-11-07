import { prisma } from "../prisma";
import {
  mergeAndLimitSuggestions,
  type AddressSuggestion,
  type AddressSuggestionSide,
  type RawAddressRow,
  ADDRESS_SUGGESTION_LIMIT,
} from "../address-suggestion";

export type { AddressSuggestion, AddressSuggestionSide };

const FETCH_CAP = 40;
const CACHE_TTL_MS = 45_000;
const CACHE_MAX = 200;

type CacheEntry = { expiresAt: number; suggestions: AddressSuggestion[] };
const suggestionCache = new Map<string, CacheEntry>();

function cacheGet(key: string): AddressSuggestion[] | null {
  const hit = suggestionCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    suggestionCache.delete(key);
    return null;
  }
  return hit.suggestions;
}

function cacheSet(key: string, suggestions: AddressSuggestion[]) {
  if (suggestionCache.size >= CACHE_MAX) {
    const first = suggestionCache.keys().next().value;
    if (first) suggestionCache.delete(first);
  }
  suggestionCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, suggestions });
}

/** Exposed for tests — clears process-local suggestion cache. */
export function clearAddressSuggestionCache() {
  suggestionCache.clear();
}

function matchesQuery(row: RawAddressRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const city = (row.city ?? "").toLowerCase();
  const pincode = (row.pincode ?? "").toLowerCase();
  const line1 = (row.addressLine1 ?? "").toLowerCase();
  const state = (row.state ?? "").toLowerCase();
  return (
    city.startsWith(needle) ||
    pincode.startsWith(needle) ||
    line1.includes(needle) ||
    state.startsWith(needle)
  );
}

export async function getAddressSuggestions(opts: {
  clientId: string;
  side: AddressSuggestionSide;
  q: string;
}): Promise<AddressSuggestion[]> {
  const clientId = opts.clientId.trim();
  if (!clientId) return [];

  const q = opts.q.trim();
  if (!q) return [];

  const cacheKey = `${clientId}|${opts.side}|${q.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const clientExists = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!clientExists) return [];

  const textFilter = {
    OR: [
      { city: { startsWith: q, mode: "insensitive" as const } },
      { pincode: { startsWith: q } },
      { addressLine1: { contains: q, mode: "insensitive" as const } },
      { state: { startsWith: q, mode: "insensitive" as const } },
    ],
  };

  const locationSelect = {
    addressLine1: true,
    city: true,
    state: true,
    pincode: true,
    partyName: true,
    gstin: true,
    contactName: true,
    phone: true,
  } as const;

  const historyPromise =
    opts.side === "consignor"
      ? prisma.indentLoadingLocation.findMany({
          where: {
            indent: { clientId },
            ...textFilter,
          },
          orderBy: { indent: { indentDate: "desc" } },
          take: FETCH_CAP,
          select: locationSelect,
        })
      : prisma.indentUnloadingLocation.findMany({
          where: {
            indent: { clientId },
            ...textFilter,
          },
          orderBy: { indent: { indentDate: "desc" } },
          take: FETCH_CAP,
          select: locationSelect,
        });

  const profilePromise = prisma.clientAddress.findMany({
    where: {
      clientId,
      type: { in: ["BILLING", "SHIPPING"] },
    },
    include: {
      address: {
        select: {
          line1: true,
          city: true,
          state: true,
          pincode: true,
        },
      },
    },
    take: 4,
  });

  const [historyRows, profileLinks] = await Promise.all([historyPromise, profilePromise]);

  const profileRows: RawAddressRow[] = profileLinks
    .map((link) => ({
      addressLine1: link.address.line1,
      city: link.address.city,
      state: link.address.state,
      pincode: link.address.pincode,
      partyName: null,
      gstin: null,
      contactName: null,
      phone: null,
    }))
    .filter((row) => matchesQuery(row, q));

  const suggestions = mergeAndLimitSuggestions(
    [profileRows, historyRows],
    ADDRESS_SUGGESTION_LIMIT
  );
  cacheSet(cacheKey, suggestions);
  return suggestions;
}
