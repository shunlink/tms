export type AddressSuggestionSide = "consignor" | "consignee";

export type AddressSuggestion = {
  label: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  partyName: string | null;
  gstin: string | null;
  contactName: string | null;
  phone: string | null;
};

export type RawAddressRow = {
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  partyName?: string | null;
  gstin?: string | null;
  contactName?: string | null;
  phone?: string | null;
};

export const ADDRESS_SUGGESTION_LIMIT = 5;

export function formatAddressSuggestionLabel(parts: {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): string {
  return [parts.addressLine1, parts.city, parts.state, parts.pincode]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function normalizeAddressDedupeKey(parts: {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): string {
  return [parts.addressLine1, parts.city, parts.state, parts.pincode]
    .map((p) => (p ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

export function toAddressSuggestion(row: RawAddressRow): AddressSuggestion | null {
  const addressLine1 = (row.addressLine1 ?? "").trim();
  const city = (row.city ?? "").trim();
  const state = (row.state ?? "").trim();
  const pincode = (row.pincode ?? "").trim();
  if (!addressLine1 && !city) return null;

  const label = formatAddressSuggestionLabel({ addressLine1, city, state, pincode });
  if (!label) return null;

  return {
    label,
    addressLine1,
    city,
    state,
    pincode,
    partyName: row.partyName?.trim() || null,
    gstin: row.gstin?.trim() || null,
    contactName: row.contactName?.trim() || null,
    phone: row.phone?.trim() || null,
  };
}

/** Merge candidates in priority order, dedupe by address key, return at most `limit`. */
export function mergeAndLimitSuggestions(
  groups: RawAddressRow[][],
  limit = ADDRESS_SUGGESTION_LIMIT
): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const group of groups) {
    for (const row of group) {
      const suggestion = toAddressSuggestion(row);
      if (!suggestion) continue;
      const key = normalizeAddressDedupeKey(suggestion);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(suggestion);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
