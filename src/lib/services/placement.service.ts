import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";

/** Indents where a vendor is allocated but the vehicle is not yet placed. */
export async function listPlacementQueue() {
  const indents = await prisma.indent.findMany({
    where: {
      vendorId: { not: null },
      placementStatus: { in: ["PLACEMENT_PENDING", "PLACEMENT_FAILED"] },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    orderBy: { vendorAllocatedAt: "asc" },
    include: {
      client: { select: { name: true } },
      vendor: { select: { id: true, name: true, phone: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
    },
  });

  return indents.map((i) => ({
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
  }));
}

export async function markVehicleReached(indentId: string, actor?: SessionUser | null) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;

  if (indent.status === "PLACEMENT_PENDING") {
    assertTransition(indent.status, "VEHICLE_PLACED");
  }

  await prisma.indent.update({
    where: { id: indentId },
    data: {
      placementStatus: "VEHICLE_REACHED",
      ...(indent.status === "PLACEMENT_PENDING" ? { status: "VEHICLE_PLACED" } : {}),
    },
  });

  // Resolve any open placement-deadline event.
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
