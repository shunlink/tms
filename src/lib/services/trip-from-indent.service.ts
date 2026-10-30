import { prisma } from "../prisma";
import { nextNumber } from "../sequence";
import { logAudit } from "../audit";
import { invalidateDashboardCache } from "../invalidate-dashboard-cache";
import { indentStatusToTripStatus } from "../vendor-trip-sync";
import type { SessionUser } from "../auth";
import { resolveTargetLine, syncIndentHeaderFromLines } from "../indent-line-rollup";
import { reconcileIndentLines } from "../indent-line-sync";
import {
  assertDriverAvailableForIndentLine,
  assertVehicleAvailableForIndentLine,
} from "../resource-assignment-eligibility";

const n = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

const TRIP_READY_STATUSES = ["VEHICLE_PLACED", "DRIVER_ASSIGNED", "IN_TRANSIT"] as const;

export type CreateTripFromIndentOptions = {
  indentLineId?: string | null;
};

/**
 * Creates a trip (LR) from an indent line after vehicle placement is confirmed.
 * Idempotent — returns the existing trip if one is already linked to the line.
 */
export async function createTripFromIndent(
  indentId: string,
  actor?: SessionUser | null,
  options?: CreateTripFromIndentOptions
) {
  await reconcileIndentLines(indentId);
  const line = await resolveTargetLine(indentId, options?.indentLineId);

  if (line.tripId) {
    const linked = await prisma.trip.findFirst({ where: { id: line.tripId } });
    if (linked) {
      const { generateTripLrPdf } = await import("./lr-document.service");
      void generateTripLrPdf(linked.id, actor).catch((err) => {
        console.error("[createTripFromIndent] LR PDF", linked.id, err);
      });
      return linked;
    }
  }

  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: {
      client: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      consignment: true,
      cargo: true,
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      clientFreight: true,
      lines: { select: { id: true } },
    },
  });
  if (!indent) return null;

  if (!TRIP_READY_STATUSES.includes(indent.status as (typeof TRIP_READY_STATUSES)[number])) {
    throw new Error("Trip can only be created after vehicle has reached (VEHICLE_PLACED or later)");
  }
  if (!indent.vendorId) throw new Error("Vendor must be allocated before creating a trip");
  if (line.placementStatus !== "VEHICLE_REACHED") {
    throw new Error("Vehicle must reach placement for this slot before creating a trip");
  }

  const activeAlloc = await prisma.indentAllocation.findFirst({
    where: { indentLineId: line.id, status: "ACTIVE" },
    orderBy: { allocatedAt: "desc" },
  });
  if (!activeAlloc) throw new Error("Active vendor allocation is required before creating a trip");
  if (!activeAlloc.vehicleId) throw new Error("Vehicle must be assigned before creating a trip");
  if (!activeAlloc.driverId) throw new Error("Driver must be assigned before creating a trip");

  const driverRecord = await prisma.driver.findUnique({
    where: { id: activeAlloc.driverId },
    select: { otpVerified: true, deviceType: true },
  });
  if (!driverRecord?.otpVerified) {
    throw new Error("Driver OTP verification must be completed before creating a trip");
  }

  await assertDriverAvailableForIndentLine(activeAlloc.driverId, line.id, line.tripId);
  await assertVehicleAvailableForIndentLine(activeAlloc.vehicleId, line.id, line.tripId);

  const vehicleQty = Math.max(1, indent.consignment?.vehicleQuantity ?? indent.lines.length ?? 1);
  const vendorRate = n(activeAlloc.vendorRate) / vehicleQty;
  const clientRate = n(indent.clientFreight?.clientRate) / vehicleQty;
  const margin = clientRate - vendorRate;

  const routeFrom = [indent.loading?.city, indent.loading?.state].filter(Boolean).join(", ") || "—";
  const routeTo = [indent.unloading?.city, indent.unloading?.state].filter(Boolean).join(", ") || "—";
  const cargoSummary = indent.cargo?.description ?? indent.consignment?.cargoTypeCode ?? null;
  const trackingMode = driverRecord.deviceType === "FEATURE_PHONE" ? "CELL" : "GPS";

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
        vehicleId: activeAlloc.vehicleId!,
        driverId: activeAlloc.driverId,
        routeFrom,
        routeTo,
        cargoSummary,
        loadingWeight: indent.consignment?.weightValue,
        clientRate,
        vendorRate,
        margin,
        trackingMode,
        status: initialStatus,
        driverArrivedAt: activeAlloc.driverId ? now : null,
        ...(initialStatus === "DISPATCHED" ? { dispatchedAt: now } : {}),
      },
    });

    await tx.indentLine.update({
      where: { id: line.id },
      data: { tripId: created.id, status: "TRIP_CREATED" },
    });

    return created;
  });

  await syncIndentHeaderFromLines(indentId);

  const { syncTripFromIndent } = await import("../vendor-trip-sync");
  await syncTripFromIndent(indentId);

  await invalidateDashboardCache();
  await logAudit({
    user: actor,
    action: "trip.create_from_indent",
    entity: "TRIP",
    entityId: trip.id,
    meta: { indentId, lrNumber, indentLineId: line.id, lineNumber: line.lineNumber },
  });

  const synced = await prisma.trip.findFirst({ where: { id: trip.id } });
  const finalTrip = synced ?? trip;

  const { generateTripLrPdf } = await import("./lr-document.service");
  void generateTripLrPdf(finalTrip.id, actor).catch((err) => {
    console.error("[createTripFromIndent] LR PDF", finalTrip.id, err);
  });

  return finalTrip;
}
