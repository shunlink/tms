import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { isIndentOpenForVendorQuoting } from "../indent-vendor-visibility";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import {
  listVendorsInCities,
  normalizeCityKey,
  resolveValidReleaseCities,
  type VendorCityOption,
} from "../vendor-eligibility";

export type ReleaseResult = {
  cities: VendorCityOption[];
  vendorCount: number;
  newVendorCount: number;
  broadcast: {
    notified: number;
    sent: number;
    failed: number;
    skipped: number;
  };
};

export async function getReleaseCityOptions(zones?: string[]) {
  const { listVendorCitiesWithCounts } = await import("../vendor-eligibility");
  return listVendorCitiesWithCounts(zones);
}

/**
 * Release an indent to vendors in admin-selected cities.
 * Cities are append-only; re-release adds new cities/vendors without removing prior releases.
 */
export async function releaseIndentToCities(
  indentId: string,
  selectedCities: string[],
  selectedZones: string[] = [],
  user?: SessionUser
): Promise<ReleaseResult | null> {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: { id: true, indentNumber: true, status: true, vendorId: true, releasedAt: true },
  });
  if (!indent) return null;

  const releasableStatuses = [
    "DRAFT",
    "WAITING_FOR_ADVANCE",
    "ADVANCE_PENDING",
    "ADVANCE_PAID",
    "RELEASED_TO_VENDORS",
    "QUOTING",
  ];
  if (!isIndentOpenForVendorQuoting(indent) && !releasableStatuses.includes(indent.status)) {
    throw new Error("This indent cannot be released to vendors in its current state");
  }

  const zoneFilter = selectedZones.filter(Boolean);
  const { valid, invalid } = await resolveValidReleaseCities(selectedCities, zoneFilter);
  if (valid.length === 0) {
    throw new Error(
      invalid.length > 0
        ? `No valid vendor cities selected (${invalid.join(", ")})`
        : "Select at least one vendor city"
    );
  }
  if (invalid.length > 0) {
    throw new Error(`Unknown vendor cities: ${invalid.join(", ")}`);
  }

  const vendors = await listVendorsInCities(valid.map((c) => c.city), zoneFilter);
  if (vendors.length === 0) {
    throw new Error(
      zoneFilter.length > 0
        ? "No eligible vendors found in the selected cities and delivery zones"
        : "No eligible vendors found in the selected cities"
    );
  }

  const existingReleases = await prisma.indentVendorRelease.findMany({
    where: { indentId },
    select: { vendorId: true },
  });
  const alreadyReleased = new Set(existingReleases.map((r) => r.vendorId));
  const newVendors = vendors.filter((v) => !alreadyReleased.has(v.id));

  const isFirstRelease = !indent.releasedAt;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (isFirstRelease) {
      assertTransition(indent.status, "RELEASED_TO_VENDORS");
      await tx.indent.update({
        where: { id: indentId },
        data: { status: "RELEASED_TO_VENDORS", releasedAt: now },
      });
    }

    for (const city of valid) {
      await tx.indentReleaseCity.upsert({
        where: { indentId_city: { indentId, city: city.city } },
        create: {
          indentId,
          city: city.city,
          releasedAt: now,
          releasedById: user?.id ?? null,
        },
        update: {},
      });
    }

    for (const zone of zoneFilter) {
      await tx.indentReleaseZone.upsert({
        where: { indentId_zone: { indentId, zone } },
        create: {
          indentId,
          zone,
          releasedAt: now,
          releasedById: user?.id ?? null,
        },
        update: {},
      });
    }

    for (const vendor of vendors) {
      const vendorCity = vendor.city ?? valid[0].city;
      await tx.indentVendorRelease.upsert({
        where: { indentId_vendorId: { indentId, vendorId: vendor.id } },
        create: {
          indentId,
          vendorId: vendor.id,
          city: vendorCity,
          releasedAt: now,
        },
        update: {},
      });
    }
  });

  const { broadcastIndentToVendors } = await import("./broadcast.service");
  const broadcast = await broadcastIndentToVendors(
    indentId,
    newVendors.map((v) => v.id)
  );

  await logAudit({
    user,
    action: "indent.released",
    entity: "INDENT",
    entityId: indentId,
    meta: {
      cities: valid.map((c) => c.city),
      zones: zoneFilter,
      vendorCount: vendors.length,
      newVendorCount: newVendors.length,
      broadcast,
    },
  });

  return {
    cities: valid,
    vendorCount: vendors.length,
    newVendorCount: newVendors.length,
    broadcast,
  };
}

/** Cities already released for an indent (for display in the release dialog). */
export async function listReleasedCities(indentId: string) {
  const rows = await prisma.indentReleaseCity.findMany({
    where: { indentId },
    orderBy: { releasedAt: "asc" },
    select: { city: true, releasedAt: true },
  });
  return rows;
}

export async function listReleasedZones(indentId: string) {
  const rows = await prisma.indentReleaseZone.findMany({
    where: { indentId },
    orderBy: { releasedAt: "asc" },
    select: { zone: true, releasedAt: true },
  });
  return rows;
}

/** Whether a vendor was released this indent (portal visibility). */
export async function isVendorReleasedIndent(vendorId: string, indentId: string) {
  const row = await prisma.indentVendorRelease.findUnique({
    where: { indentId_vendorId: { indentId, vendorId } },
    select: { id: true },
  });
  return Boolean(row);
}

/** Match vendor primary city against a released city label (case-insensitive). */
export function cityMatchesReleased(vendorCity: string | null, releasedCity: string) {
  if (!vendorCity) return false;
  return normalizeCityKey(vendorCity) === normalizeCityKey(releasedCity);
}
