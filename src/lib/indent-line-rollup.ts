import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type LinePlacementSummary = {
  total: number;
  reached: number;
  withVehicle: number;
  withVerifiedDriver: number;
  tripsCreated: number;
};

export function activeAllocationOnLine<
  T extends {
    allocations: {
      status: string;
      vehicleId: string | null;
      driverId: string | null;
      driver?: { otpVerified: boolean } | null;
    }[];
  },
>(line: T) {
  return line.allocations.find((a) => a.status === "ACTIVE") ?? null;
}

export function summarizeLines(
  lines: {
    placementStatus: string;
    tripId: string | null;
    allocations: {
      status: string;
      vehicleId: string | null;
      driverId: string | null;
      driver?: { otpVerified: boolean } | null;
    }[];
  }[]
): LinePlacementSummary {
  let reached = 0;
  let withVehicle = 0;
  let withVerifiedDriver = 0;
  let tripsCreated = 0;
  for (const line of lines) {
    if (line.placementStatus === "VEHICLE_REACHED") reached++;
    if (line.tripId) tripsCreated++;
    const alloc = activeAllocationOnLine(line);
    if (alloc?.vehicleId) withVehicle++;
    if (alloc?.driverId && alloc.driver?.otpVerified) withVerifiedDriver++;
  }
  return {
    total: lines.length,
    reached,
    withVehicle,
    withVerifiedDriver,
    tripsCreated,
  };
}

/** Mirror first incomplete slot on indent header for legacy readers. */
export async function syncIndentHeaderFromLines(indentId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const indent = await db.indent.findFirst({
    where: { id: indentId },
    include: {
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            include: { driver: { select: { otpVerified: true } } },
          },
        },
      },
    },
  });
  if (!indent) return;

  const summary = summarizeLines(
    indent.lines.map((l) => ({
      placementStatus: l.placementStatus,
      tripId: l.tripId,
      allocations: l.allocations,
    }))
  );

  let placementStatus = indent.placementStatus;
  if (summary.reached === 0) {
    placementStatus = "PLACEMENT_PENDING";
  } else if (summary.reached < summary.total) {
    placementStatus = "PARTIALLY_REACHED";
  } else {
    placementStatus = "VEHICLE_REACHED";
  }

  const firstOpen = indent.lines.find((l) => !l.tripId);
  const alloc = firstOpen ? activeAllocationOnLine(firstOpen) : null;

  await db.indent.update({
    where: { id: indentId },
    data: {
      placementStatus,
      vehicleId: alloc?.vehicleId ?? indent.vehicleId,
      driverId: alloc?.driverId ?? indent.driverId,
    },
  });
}

export async function resolveTargetLine(
  indentId: string,
  indentLineId?: string | null
) {
  const lines = await prisma.indentLine.findMany({
    where: { indentId },
    orderBy: { lineNumber: "asc" },
  });
  if (!lines.length) throw new Error("Indent has no lines");
  if (indentLineId) {
    const line = lines.find((l) => l.id === indentLineId);
    if (!line) throw new Error("Vehicle slot not found on this indent");
    return line;
  }
  if (lines.length === 1) return lines[0];
  throw new Error("indentLineId is required when indent has multiple vehicles");
}

export async function activeAllocationForLine(indentLineId: string) {
  return prisma.indentAllocation.findFirst({
    where: { indentLineId, status: "ACTIVE" },
    orderBy: { allocatedAt: "desc" },
  });
}
