import { prisma } from "./prisma";

/** Map indent execution status to the linked trip status. */
export function indentStatusToTripStatus(
  indentStatus: string,
  placementStatus?: string | null
): string | null {
  if (placementStatus === "VEHICLE_REACHED") {
    if (["PLACEMENT_PENDING", "VENDOR_ALLOCATED", "VEHICLE_PLACED", "DRIVER_ASSIGNED"].includes(indentStatus)) {
      return "DISPATCHED";
    }
  }

  const map: Record<string, string> = {
    PLACEMENT_PENDING: "PENDING",
    VENDOR_ALLOCATED: "PENDING",
    VEHICLE_PLACED: "DISPATCHED",
    DRIVER_ASSIGNED: "DISPATCHED",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    POD_PENDING: "DELIVERED",
    POD_RECEIVED: "POD_RECEIVED",
    COMPLETED: "CLOSED",
  };
  return map[indentStatus] ?? null;
}

/** Vendor-facing label — prefers live trip/indent state over raw PENDING. */
export function resolveVendorDisplayStatus(input: {
  tripStatus?: string | null;
  indentStatus?: string | null;
  placementStatus?: string | null;
  kind?: "trip" | "indent";
}) {
  if (input.kind === "indent" && input.indentStatus) {
    if (input.placementStatus === "VEHICLE_REACHED") return "VEHICLE_PLACED";
    return input.indentStatus;
  }

  if (input.tripStatus === "PENDING") {
    if (input.placementStatus === "VEHICLE_REACHED") return "VEHICLE_PLACED";
    if (input.indentStatus === "VEHICLE_PLACED" || input.indentStatus === "DRIVER_ASSIGNED") {
      return "DISPATCHED";
    }
    if (input.indentStatus === "IN_TRANSIT") return "IN_TRANSIT";
    if (input.indentStatus === "PLACEMENT_PENDING" || input.indentStatus === "VENDOR_ALLOCATED") {
      return "PLACEMENT_PENDING";
    }
  }

  return input.tripStatus ?? input.indentStatus ?? "PENDING";
}

const TERMINAL_TRIP_STATUSES = new Set(["CLOSED", "CANCELLED", "INVOICED"]);

const TRIP_STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  DISPATCHED: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
  POD_RECEIVED: 4,
};

const INDENT_EXECUTION_RANK: Record<string, number> = {
  VENDOR_ALLOCATED: 0,
  PLACEMENT_PENDING: 0,
  VEHICLE_PLACED: 1,
  DRIVER_ASSIGNED: 2,
  IN_TRANSIT: 3,
  DELIVERED: 4,
  POD_PENDING: 5,
  POD_RECEIVED: 6,
  COMPLETED: 7,
};

/** Keep trip status aligned with indent when ops updates the main portal (forward-only). */
export async function syncTripFromIndent(indentId: string) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: { status: true, placementStatus: true },
  });
  if (!indent) return null;

  if (indent.status === "CANCELLED") {
    await cancelTripsForIndent(indentId);
    return prisma.trip.findFirst({ where: { indentId } });
  }

  const nextStatus = indentStatusToTripStatus(indent.status, indent.placementStatus);
  if (!nextStatus) return null;

  const trip = await prisma.trip.findFirst({ where: { indentId } });
  if (!trip || TERMINAL_TRIP_STATUSES.has(trip.status)) return trip;

  if (trip.status === nextStatus) return trip;
  // Never move a trip backwards — the driver/vendor may legitimately be ahead of the indent.
  if ((TRIP_STATUS_RANK[nextStatus] ?? -1) <= (TRIP_STATUS_RANK[trip.status] ?? -1)) return trip;

  const now = new Date();
  const data: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "DISPATCHED" && !trip.dispatchedAt) data.dispatchedAt = now;
  if (nextStatus === "DELIVERED" && !trip.deliveredAt) data.deliveredAt = now;
  if (nextStatus === "POD_RECEIVED" && !trip.podReceivedAt) data.podReceivedAt = now;

  return prisma.trip.update({ where: { id: trip.id }, data });
}

/** Advance the parent indent when the trip moves ahead (driver/staff trip updates). Forward-only. */
export async function syncIndentFromTrip(tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { status: true, indentId: true },
  });
  if (!trip?.indentId) return null;

  let target: string | null = null;
  if (trip.status === "IN_TRANSIT") target = "IN_TRANSIT";
  if (trip.status === "DELIVERED") {
    const pendingPod = await prisma.indentPod.findFirst({
      where: { tripId, status: { in: ["PENDING_VERIFICATION", "BAD_POD"] } },
      select: { id: true },
    });
    target = pendingPod ? "POD_PENDING" : "DELIVERED";
  }
  if (!target) return null;

  const indent = await prisma.indent.findFirst({
    where: { id: trip.indentId },
    select: { id: true, status: true },
  });
  if (!indent) return null;
  const currentRank = INDENT_EXECUTION_RANK[indent.status];
  if (currentRank == null || INDENT_EXECUTION_RANK[target] <= currentRank) return indent;

  return prisma.indent.update({ where: { id: indent.id }, data: { status: target } });
}

/** Cancel the non-terminal trip(s) and open advance workflow of a cancelled indent. */
export async function cancelTripsForIndent(indentId: string) {
  const trips = await prisma.trip.findMany({
    where: { indentId, status: { notIn: Array.from(TERMINAL_TRIP_STATUSES) } },
    select: { id: true },
  });
  if (trips.length === 0) return 0;
  const tripIds = trips.map((t) => t.id);
  await prisma.trip.updateMany({ where: { id: { in: tripIds } }, data: { status: "CANCELLED" } });
  await cancelOpenAdvanceRequestsForTrips(tripIds, "Indent cancelled");
  return trips.length;
}

/** Cancel in-flight advance requests (and their SLA/alerts) for trips that will never run. */
export async function cancelOpenAdvanceRequestsForTrips(tripIds: string[], reason: string) {
  const { ACTIVE_ADVANCE_REQUEST_STATUSES } = await import("./advance-request-states");
  const activeAdvances = await prisma.advanceRequest.findMany({
    where: { tripId: { in: tripIds }, status: { in: ACTIVE_ADVANCE_REQUEST_STATUSES } },
    select: { id: true, status: true },
  });
  if (activeAdvances.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const adv of activeAdvances) {
      await tx.advanceRequest.update({ where: { id: adv.id }, data: { status: "CANCELLED" } });
      await tx.advanceRequestEvent.create({
        data: {
          advanceRequestId: adv.id,
          action: "CANCELLED",
          fromStatus: adv.status,
          toStatus: "CANCELLED",
          remarks: reason,
        },
      });
    }
  });

  const { cancelSlaTask } = await import("./services/sla.service");
  const { SLA_TYPES } = await import("./sla-types");
  const { resolveImportantEvents } = await import("./services/important-event.service");
  for (const adv of activeAdvances) await cancelSlaTask(SLA_TYPES.ADVANCE_REQUEST, adv.id);
  await resolveImportantEvents(
    { types: ["ADVANCE_PENDING", "ADVANCE_SLA_BREACHED"], relatedEntityIds: activeAdvances.map((a) => a.id) },
    { status: "DISMISSED" }
  );
  return activeAdvances.length;
}
