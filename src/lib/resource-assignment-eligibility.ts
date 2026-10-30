import { prisma } from "./prisma";
import { TRIP_DELIVERED_GROUP } from "./dashboard-metrics";

/** Indent statuses where driver/vehicle are no longer reserved for that indent. */
export const INDENT_RELEASED_STATUSES = [
  "CANCELLED",
  "COMPLETED",
  "DELIVERED",
  "POD_PENDING",
  "POD_RECEIVED",
] as const;

const TRIP_RELEASED_STATUSES = [...TRIP_DELIVERED_GROUP, "CANCELLED"] as const;

type ExcludeOptions = {
  excludeTripId?: string | null;
  excludeIndentLineId: string;
};

async function findBlockingTripForDriver(driverId: string, opts: ExcludeOptions) {
  return prisma.trip.findFirst({
    where: {
      driverId,
      status: { notIn: [...TRIP_RELEASED_STATUSES] },
      ...(opts.excludeTripId ? { id: { not: opts.excludeTripId } } : {}),
    },
    select: {
      id: true,
      lrNumber: true,
      status: true,
      indent: { select: { indentNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function findBlockingTripForVehicle(vehicleId: string, opts: ExcludeOptions) {
  return prisma.trip.findFirst({
    where: {
      vehicleId,
      status: { notIn: [...TRIP_RELEASED_STATUSES] },
      ...(opts.excludeTripId ? { id: { not: opts.excludeTripId } } : {}),
    },
    select: {
      id: true,
      lrNumber: true,
      status: true,
      indent: { select: { indentNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function findBlockingAllocationForDriver(driverId: string, excludeIndentLineId: string) {
  return prisma.indentAllocation.findFirst({
    where: {
      status: "ACTIVE",
      driverId,
      indentLineId: { not: excludeIndentLineId },
      indent: { status: { notIn: [...INDENT_RELEASED_STATUSES] } },
    },
    select: {
      indentLine: { select: { lineNumber: true } },
      indent: { select: { indentNumber: true, status: true } },
    },
    orderBy: { allocatedAt: "desc" },
  });
}

async function findBlockingAllocationForVehicle(vehicleId: string, excludeIndentLineId: string) {
  return prisma.indentAllocation.findFirst({
    where: {
      status: "ACTIVE",
      vehicleId,
      indentLineId: { not: excludeIndentLineId },
      indent: { status: { notIn: [...INDENT_RELEASED_STATUSES] } },
    },
    select: {
      indentLine: { select: { lineNumber: true } },
      indent: { select: { indentNumber: true, status: true } },
    },
    orderBy: { allocatedAt: "desc" },
  });
}

function formatTripConflict(resourceLabel: string, trip: {
  lrNumber: string;
  indent: { indentNumber: string } | null;
}) {
  const indentPart = trip.indent?.indentNumber
    ? ` (indent ${trip.indent.indentNumber})`
    : "";
  return `${resourceLabel} is already on trip ${trip.lrNumber}${indentPart} until delivery.`;
}

function formatAllocationConflict(
  resourceLabel: string,
  alloc: {
    indent: { indentNumber: string };
    indentLine: { lineNumber: number };
  }
) {
  return `${resourceLabel} is already allocated on indent ${alloc.indent.indentNumber} (vehicle slot ${alloc.indentLine.lineNumber}).`;
}

/** Ensures driver is not on another open trip or active indent allocation. */
export async function assertDriverAvailableForIndentLine(
  driverId: string,
  indentLineId: string,
  excludeTripId?: string | null
) {
  const opts: ExcludeOptions = { excludeIndentLineId: indentLineId, excludeTripId };

  const trip = await findBlockingTripForDriver(driverId, opts);
  if (trip) {
    throw new Error(formatTripConflict("Driver", trip));
  }

  const alloc = await findBlockingAllocationForDriver(driverId, indentLineId);
  if (alloc) {
    throw new Error(formatAllocationConflict("Driver", alloc));
  }
}

/** Ensures vehicle is not on another open trip or active indent allocation. */
export async function assertVehicleAvailableForIndentLine(
  vehicleId: string,
  indentLineId: string,
  excludeTripId?: string | null
) {
  const opts: ExcludeOptions = { excludeIndentLineId: indentLineId, excludeTripId };

  const trip = await findBlockingTripForVehicle(vehicleId, opts);
  if (trip) {
    throw new Error(formatTripConflict("Vehicle", trip));
  }

  const alloc = await findBlockingAllocationForVehicle(vehicleId, indentLineId);
  if (alloc) {
    throw new Error(formatAllocationConflict("Vehicle", alloc));
  }
}

/** True when the message should be returned as HTTP 400 from indent assignment APIs. */
export function isResourceAssignmentConflictMessage(message: string) {
  return (
    message.includes("is already on trip") || message.includes("is already allocated on indent")
  );
}
