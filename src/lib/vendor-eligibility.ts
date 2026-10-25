import { vendorMatchesDeliveryZones } from "./delivery-zones";
import { prisma } from "./prisma";
import { filterEligibleVendorIds, isVendorEligibleForIndentOps } from "./vendor-onboarding-eligibility";

export type EligibleVendor = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  deliveryZones: string[];
};

export type VendorCityOption = {
  city: string;
  vendorCount: number;
};

const vendorPrimaryAddressSelect = {
  orderBy: { isPrimary: "desc" as const },
  take: 1,
  select: { address: { select: { city: true } } },
};

/** Case-insensitive city key for grouping and matching. */
export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

const PLACEHOLDER_CITIES = new Set(["—", "-", "n/a", "na", "none"]);

export function isRegisteredVendorCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const trimmed = city.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_CITIES.has(trimmed.toLowerCase());
}

export function getVendorPrimaryCity(
  vendor: { addresses: Array<{ address: { city: string } }> }
): string | null {
  const city = vendor.addresses[0]?.address.city?.trim();
  return isRegisteredVendorCity(city) ? city! : null;
}

async function loadActiveVendorsWithCity() {
  const rows = await prisma.vendor.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
      addresses: vendorPrimaryAddressSelect,
      deliveryZones: { select: { zone: true } },
    },
  });
  const eligibleIds = await filterEligibleVendorIds(rows.map((v) => v.id));
  return rows.filter((v) => eligibleIds.has(v.id));
}

export { isVendorEligibleForIndentOps };

function getVendorDeliveryZones(vendor: { deliveryZones: Array<{ zone: string }> }): string[] {
  return vendor.deliveryZones.map((z) => z.zone);
}

function vendorPassesZoneFilter(vendor: { deliveryZones: Array<{ zone: string }> }, zones?: string[]) {
  if (!zones || zones.length === 0) return true;
  return vendorMatchesDeliveryZones(getVendorDeliveryZones(vendor), zones);
}

/** Distinct vendor cities with eligible vendor counts (for the release city picker). */
export async function listVendorCitiesWithCounts(zones?: string[]): Promise<VendorCityOption[]> {
  const vendors = await loadActiveVendorsWithCity();
  const counts = new Map<string, { display: string; count: number }>();

  for (const vendor of vendors) {
    if (!vendorPassesZoneFilter(vendor, zones)) continue;
    const city = getVendorPrimaryCity(vendor);
    if (!city) continue;
    const key = normalizeCityKey(city);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { display: city, count: 1 });
    }
  }

  return Array.from(counts.values())
    .map(({ display, count }) => ({ city: display, vendorCount: count }))
    .sort((a, b) => a.city.localeCompare(b.city, "en", { sensitivity: "base" }));
}

/** Active vendors whose primary address city matches any of the selected cities. */
export async function listVendorsInCities(
  cities: string[],
  zones?: string[]
): Promise<EligibleVendor[]> {
  const keys = new Set(cities.map(normalizeCityKey).filter(Boolean));
  if (keys.size === 0) return [];

  const vendors = await loadActiveVendorsWithCity();
  return vendors
    .filter((vendor) => {
      if (!vendorPassesZoneFilter(vendor, zones)) return false;
      const city = getVendorPrimaryCity(vendor);
      return city ? keys.has(normalizeCityKey(city)) : false;
    })
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      phone: vendor.phone,
      whatsapp: vendor.whatsapp,
      city: getVendorPrimaryCity(vendor),
      deliveryZones: getVendorDeliveryZones(vendor),
    }));
}

/**
 * Validates admin-selected cities against the current vendor registry.
 * Returns canonical city labels for valid selections.
 */
export async function resolveValidReleaseCities(
  cities: string[],
  zones?: string[]
): Promise<{
  valid: VendorCityOption[];
  invalid: string[];
}> {
  const trimmed = cities.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { valid: [], invalid: [] };
  }

  const available = await listVendorCitiesWithCounts(zones);
  const byKey = new Map(available.map((row) => [normalizeCityKey(row.city), row]));

  const valid: VendorCityOption[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const city of trimmed) {
    const key = normalizeCityKey(city);
    if (seen.has(key)) continue;
    seen.add(key);

    const match = byKey.get(key);
    if (match) valid.push(match);
    else invalid.push(city);
  }

  return { valid, invalid };
}
