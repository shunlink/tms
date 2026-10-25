import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Ensure line count matches consignment.vehicleQuantity; backfill allocations when vendor exists. */
export async function reconcileIndentLines(
  indentId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const indent = await db.indent.findFirst({
    where: { id: indentId },
    include: {
      consignment: { select: { vehicleQuantity: true, vehicleTypeCode: true, bodyTypeCode: true } },
      lines: { orderBy: { lineNumber: "asc" } },
    },
  });
  if (!indent?.consignment) return;

  const qty = Math.max(1, indent.consignment.vehicleQuantity ?? 1);
  const lines = indent.lines;

  if (lines.length < qty) {
    for (let n = lines.length + 1; n <= qty; n++) {
      await db.indentLine.create({
        data: {
          indentId,
          lineNumber: n,
          vehicleTypeCode: indent.consignment.vehicleTypeCode,
          bodyTypeCode: indent.consignment.bodyTypeCode,
          placementStatus:
            indent.placementStatus === "VEHICLE_REACHED" && n === 1
              ? "VEHICLE_REACHED"
              : "PLACEMENT_PENDING",
        },
      });
    }
  }

  if (!indent.vendorId) return;

  const refreshed = await db.indentLine.findMany({
    where: { indentId },
    orderBy: { lineNumber: "asc" },
  });

  const templateAlloc = await db.indentAllocation.findFirst({
    where: { indentId, status: "ACTIVE" },
    orderBy: { allocatedAt: "desc" },
  });

  const vendorRate = templateAlloc?.vendorRate ?? 0;
  const acceptedQuoteId = templateAlloc?.acceptedQuoteId ?? null;
  const deadlineAt = indent.placementDeadlineAt ?? templateAlloc?.deadlineAt ?? null;

  for (const line of refreshed) {
    const active = await db.indentAllocation.findFirst({
      where: { indentLineId: line.id, status: "ACTIVE" },
    });
    if (!active) {
      await db.indentAllocation.create({
        data: {
          indentId,
          indentLineId: line.id,
          vendorId: indent.vendorId,
          vendorRate,
          acceptedQuoteId,
          status: "ACTIVE",
          deadlineAt,
          allocatedAt: indent.vendorAllocatedAt ?? new Date(),
        },
      });
      if (line.status === "OPEN") {
        await db.indentLine.update({ where: { id: line.id }, data: { status: "ALLOCATED" } });
      }
    }
  }
}
