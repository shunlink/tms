import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { resolveTargetLine, syncIndentHeaderFromLines, summarizeLines } from "../indent-line-rollup";
import { reconcileIndentLines } from "../indent-line-sync";

/** Indents where a vendor is allocated but the vehicle is not yet placed. */
export async function listPlacementQueue() {
  const indents = await prisma.indent.findMany({
    where: {
      vendorId: { not: null },
      placementStatus: { in: ["PLACEMENT_PENDING", "PLACEMENT_FAILED", "PARTIALLY_REACHED"] },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    orderBy: { vendorAllocatedAt: "asc" },
    include: {
      client: { select: { name: true } },
      vendor: { select: { id: true, name: true, phone: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      consignment: { select: { vehicleQuantity: true } },
      lines: { select: { placementStatus: true, tripId: true, lineNumber: true } },
    },
  });

  return indents.map((i) => {
    const summary = summarizeLines(
      i.lines.map((l) => ({
        placementStatus: l.placementStatus,
        tripId: l.tripId,
        allocations: [],
      }))
    );
    return {
      id: i.id,
      indentNumber: i.indentNumber,
      client: i.client.name,
      route: `${i.loading?.city ?? "—"} → ${i.unloading?.city ?? "—"}`,
      vendor: i.vendor?.name ?? null,
      vendorPhone: i.vendor?.phone ?? null,
      allocatedAt: i.vendorAllocatedAt,
      deadlineAt: i.placementDeadlineAt,
      placementStatus: i.placementStatus,
      status: i.status,
      vehicleQuantity: i.consignment?.vehicleQuantity ?? 1,
      placementProgress: `${summary.reached}/${summary.total} reached`,
    };
  });
}

export async function markVehicleReached(
  indentId: string,
  actor?: SessionUser | null,
  indentLineId?: string | null
) {
  await reconcileIndentLines(indentId);
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;

  const line = await resolveTargetLine(indentId, indentLineId);
  const now = new Date();

  if (indent.status === "PLACEMENT_PENDING") {
    assertTransition(indent.status, "VEHICLE_PLACED");
  }

  await prisma.$transaction(async (tx) => {
    await tx.indentLine.update({
      where: { id: line.id },
      data: {
        placementStatus: "VEHICLE_REACHED",
        placementReachedAt: now,
      },
    });

    const lines = await tx.indentLine.findMany({
      where: { indentId },
      select: { placementStatus: true, tripId: true },
    });
    const summary = summarizeLines(
      lines.map((l) => ({
        placementStatus: l.placementStatus,
        tripId: l.tripId,
        allocations: [],
      }))
    );

    const statusPatch =
      indent.status === "PLACEMENT_PENDING" && summary.reached > 0
        ? { status: "VEHICLE_PLACED" as const }
        : {};

    await tx.indent.update({
      where: { id: indentId },
      data: statusPatch,
    });
    await syncIndentHeaderFromLines(indentId, tx);
  });

  await prisma.importantEvent.updateMany({
    where: {
      indentId,
      status: "OPEN",
      type: { in: ["PLACEMENT_DEADLINE_EXCEEDED", "ALLOCATION_PLACEMENT_DEADLINE"] },
    },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: actor?.id ?? null },
  });

  await logAudit({
    user: actor,
    action: "placement.vehicle_reached",
    entity: "INDENT",
    entityId: indentId,
    meta: { indentLineId: line.id, lineNumber: line.lineNumber },
  });

  const { syncTripFromIndent } = await import("../vendor-trip-sync");
  await syncTripFromIndent(indentId);

  return (await import("./indent.service")).getIndentById(indentId);
}

/**
 * Evaluate placement deadlines (call on dashboard/placement reads).
 * Does NOT auto-reallocate or cancel — only raises an important event.
 */
export async function evaluatePlacementDeadlines() {
  const now = new Date();
  const overdue = await prisma.indent.findMany({
    where: {
      placementStatus: "PLACEMENT_PENDING",
      placementDeadlineAt: { lt: now },
      status: { notIn: ["CANCELLED", "COMPLETED", "VEHICLE_PLACED"] },
    },
    select: { id: true, indentNumber: true, vendorId: true },
  });

  let raised = 0;
  for (const i of overdue) {
    const existing = await prisma.importantEvent.findFirst({
      where: { indentId: i.id, type: "PLACEMENT_DEADLINE_EXCEEDED", status: "OPEN" },
    });
    if (existing) continue;

    await prisma.indent.update({
      where: { id: i.id },
      data: { placementStatus: "PLACEMENT_FAILED" },
    });

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "PLACEMENT_DEADLINE_EXCEEDED",
      severity: "CRITICAL",
      title: `Placement deadline exceeded for ${i.indentNumber}`,
      description: "Vehicle has not reached within 24 hours. Admin review required (reallocate / continue / follow up).",
      indentId: i.id,
    });
    raised++;
  }

  return raised;
}
