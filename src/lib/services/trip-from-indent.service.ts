import { prisma } from "../prisma";
import { nextNumber } from "../sequence";
import { logAudit } from "../audit";
import { invalidateDashboardCache } from "../invalidate-dashboard-cache";
import { indentStatusToTripStatus } from "../vendor-trip-sync";
import type { SessionUser } from "../auth";

const n = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

const TRIP_READY_STATUSES = ["VEHICLE_PLACED", "DRIVER_ASSIGNED", "IN_TRANSIT"] as const;

/**
 * Creates a trip (LR) from an indent after vehicle placement is confirmed.
 * Idempotent — returns the existing trip if one is already linked.
 */
export async function createTripFromIndent(indentId: string, actor?: SessionUser | null) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: {
      client: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      vehicle: { select: { id: true, registrationNumber: true } },
      driver: { select: { id: true, deviceType: true } },
      consignment: true,
      cargo: true,
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      clientFreight: true,
      lines: { orderBy: { lineNumber: "asc" }, take: 1 },
      trips: { take: 1 },
    },
  });
  if (!indent) return null;

  if (!TRIP_READY_STATUSES.includes(indent.status as (typeof TRIP_READY_STATUSES)[number])) {
    throw new Error("Trip can only be created after vehicle has reached (VEHICLE_PLACED or later)");
  }
  if (!indent.vendorId) throw new Error("Vendor must be allocated before creating a trip");
  if (indent.placementStatus !== "VEHICLE_REACHED") {
    throw new Error("Vehicle must reach placement before creating a trip");
  }
  if (!indent.vehicleId) throw new Error("Vehicle must be assigned before creating a trip");
  if (!indent.driverId) throw new Error("Driver must be assigned before creating a trip");

  const driverRecord = await prisma.driver.findUnique({
    where: { id: indent.driverId },
    select: { otpVerified: true },
  });
  if (!driverRecord?.otpVerified) {
    throw new Error("Driver OTP verification must be completed before creating a trip");
  }

  const activeAlloc = await prisma.indentAllocation.findFirst({
    where: { indentId, status: "ACTIVE" },
    orderBy: { allocatedAt: "desc" },
  });
  if (!activeAlloc) throw new Error("Active vendor allocation is required before creating a trip");

  if (indent.trips[0]) return indent.trips[0];
  if (indent.lines[0]?.tripId) {
    const linked = await prisma.trip.findFirst({ where: { id: indent.lines[0].tripId } });
    if (linked) return linked;
  }

  const line = indent.lines[0];
  if (!line) throw new Error("Indent has no lines");

  const vendorRate = n(activeAlloc.vendorRate);
  const clientRate = n(indent.clientFreight?.clientRate);
  const margin = clientRate - vendorRate;

  const routeFrom = [indent.loading?.city, indent.loading?.state].filter(Boolean).join(", ") || "—";
  const routeTo = [indent.unloading?.city, indent.unloading?.state].filter(Boolean).join(", ") || "—";
  const cargoSummary = indent.cargo?.description ?? indent.consignment?.cargoTypeCode ?? null;
  const trackingMode = indent.driver?.deviceType === "FEATURE_PHONE" ? "CELL" : "GPS";

  const lrNumber = await nextNumber("LR");
  const initialStatus = indentStatusToTripStatus(indent.status, indent.placementStatus) ?? "PENDING";
  const now = new Date();

  const trip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        lrNumber,
        indentId,
        clientId: indent.clientId,
        vendorId: indent.vendorId!,
        vehicleId: indent.vehicleId!,
        driverId: indent.driverId,
        routeFrom,
        routeTo,
        cargoSummary,
        loadingWeight: indent.consignment?.weightValue,
        clientRate,
        vendorRate,
        margin,
        trackingMode,
        status: initialStatus,
        driverArrivedAt: indent.driverId ? now : null,
        ...(initialStatus === "DISPATCHED" ? { dispatchedAt: now } : {}),
      },
    });

    await tx.indentLine.update({
      where: { id: line.id },
      data: { tripId: created.id, status: "TRIP_CREATED" },
    });

    return created;
  });

  const { syncTripFromIndent } = await import("../vendor-trip-sync");
  await syncTripFromIndent(indentId);

  await invalidateDashboardCache();
  await logAudit({
    user: actor,
    action: "trip.create_from_indent",
    entity: "TRIP",
    entityId: trip.id,
    meta: { indentId, lrNumber },
  });

  const synced = await prisma.trip.findFirst({ where: { id: trip.id } });
  return synced ?? trip;
}
