export const DELIVERY_ZONE_VALUES = ["NORTH", "SOUTH", "EAST", "WEST", "ALL"] as const;
export type DeliveryZone = (typeof DELIVERY_ZONE_VALUES)[number];

/** Zones admins can filter on release (excludes ALL). */
export const RELEASE_FILTER_ZONE_VALUES = ["NORTH", "SOUTH", "EAST", "WEST"] as const;
export type ReleaseFilterZone = (typeof RELEASE_FILTER_ZONE_VALUES)[number];

export const DELIVERY_ZONE_OPTIONS: { value: DeliveryZone; label: string }[] = [
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "ALL", label: "All India" },
];

export function deliveryZoneLabel(zone: string): string {
  const found = DELIVERY_ZONE_OPTIONS.find((o) => o.value === zone);
  return found?.label ?? zone;
}

export function formatDeliveryZones(zones: string[]): string {
  if (!zones.length) return "All India (not set)";
  if (zones.includes("ALL")) return "All India";
  return zones.map(deliveryZoneLabel).join(", ");
}

function isDeliveryZone(z: string): z is DeliveryZone {
  return (DELIVERY_ZONE_VALUES as readonly string[]).includes(z);
}

function isReleaseFilterZone(z: string): z is ReleaseFilterZone {
  return (RELEASE_FILTER_ZONE_VALUES as readonly string[]).includes(z);
}

/**
 * Normalize vendor-selected zones for persistence.
 * If ALL is selected, only ALL is stored. Otherwise dedupe cardinal directions.
 */
export function normalizeVendorDeliveryZones(input: string[]): DeliveryZone[] {
  const trimmed = input.map((z) => z.trim().toUpperCase()).filter(Boolean);
  const valid = trimmed.filter(isDeliveryZone);
  if (valid.includes("ALL")) return ["ALL"];
  const unique = new Set<DeliveryZone>();
  for (const z of valid) {
    if (z !== "ALL") unique.add(z);
  }
  return Array.from(unique);
}

/** Parse admin release filter zones (no ALL). */
export function normalizeReleaseFilterZones(input: string[]): ReleaseFilterZone[] {
  const trimmed = input.map((z) => z.trim().toUpperCase()).filter(Boolean);
  const unique = new Set<ReleaseFilterZone>();
  for (const z of trimmed) {
    if (isReleaseFilterZone(z)) unique.add(z);
  }
  return Array.from(unique);
}

/**
 * Whether a vendor's delivery zones satisfy an admin zone filter.
 * Empty filter → all vendors. Empty vendor zones (legacy) → matches any filter.
 */
export function vendorMatchesDeliveryZones(
  vendorZones: string[],
  filterZones: string[]
): boolean {
  const filter = normalizeReleaseFilterZones(filterZones);
  if (filter.length === 0) return true;

  const vendor = normalizeVendorDeliveryZones(vendorZones);
  if (vendor.length === 0 || vendor.includes("ALL")) return true;

  return filter.some((z) => vendor.includes(z));
}
