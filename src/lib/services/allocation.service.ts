import type { Prisma } from "@prisma/client";
import { resolveIndentPromisedAdvanceAmount, tripAdvanceSummarySelect } from "../advance";
import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { PLACEMENT_DEADLINE_MS } from "../constants";
import { resolveWhatsAppRecipient } from "../phone";
import { labelOf, resolveLookupLabels } from "../lookup";
import { isAllocatableStatus } from "../indent-allocation";
import { reconcileIndentLines } from "../indent-line-sync";
import { assertVendorEligibleForIndentOps } from "../vendor-onboarding-eligibility";

const REALLOCATABLE_STATUSES = [
  "VENDOR_ALLOCATED",
  "PLACEMENT_PENDING",
  "VEHICLE_PLACED",
  "DRIVER_ASSIGNED",
] as const;

function placementDeadline() {
  return new Date(Date.now() + PLACEMENT_DEADLINE_MS);
}

/** Set bidding vs manual allocation before vendor is assigned. */
export async function setAllocationMode(
  indentId: string,
  mode: "BIDDING" | "MANUAL",
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  if (indent.vendorId) {
    throw new Error("Cannot change allocation mode after a vendor is allocated");
  }
  const editable = ["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING", "ADVANCE_PAID"];
  if (!editable.includes(indent.status)) {
    throw new Error(`Cannot change allocation mode when indent is ${indent.status}`);
  }

  await prisma.indent.update({ where: { id: indentId }, data: { allocationMode: mode } });

  await logAudit({
    user: actor,
    action: "indent.allocation_mode_set",
    entity: "INDENT",
    entityId: indentId,
    meta: { mode },
  });

  return (await import("./indent.service")).getIndentById(indentId);
}

export type AllocateVendorInput = {
  vendorId?: string | null;
  quoteId?: string | null;
  vendorRate?: number | null;
};

export type ResolvedVendorAllocation = {
  vendorId: string;
  vendorRate: number;
  acceptedQuoteId: string | null;
};

/** Resolve vendor + rate from quote or direct manual input. */
export async function resolveVendorAllocation(
  tx: Prisma.TransactionClient | typeof prisma,
  indentId: string,
  data: AllocateVendorInput
): Promise<ResolvedVendorAllocation> {
  let vendorId = data.vendorId ?? null;
  let acceptedQuoteId = data.quoteId ?? null;
  let vendorRate = 0;

  if (acceptedQuoteId) {
    const quote = await tx.vendorQuote.findFirst({
      where: { id: acceptedQuoteId, indentId, status: "ACTIVE" },
    });
    if (!quote) throw new Error("Quote not found or already used");
    vendorId = quote.vendorId;
    vendorRate = quote.quotedRate.toNumber();
  } else if (vendorId) {
    const quote = await tx.vendorQuote.findFirst({
      where: { indentId, vendorId, status: "ACTIVE" },
      orderBy: { quotedRate: "asc" },
    });
    if (quote) {
      vendorRate = quote.quotedRate.toNumber();
      acceptedQuoteId = quote.id;
    } else if (data.vendorRate != null && data.vendorRate > 0) {
      vendorRate = data.vendorRate;
    }
  }

  if (!vendorId) throw new Error("Vendor is required");
  if (vendorRate <= 0) {
    throw new Error("Vendor rate is required for manual allocation");
  }

  await assertVendorEligibleForIndentOps(vendorId);

  return { vendorId, vendorRate, acceptedQuoteId };
}

/**
 * Core allocation writes — safe to call inside an outer transaction (e.g. Bidding award handoff).
 */
export async function allocateVendorInTransaction(
  tx: Prisma.TransactionClient,
  indentId: string,
  data: AllocateVendorInput,
  actor?: SessionUser | null
) {
  await reconcileIndentLines(indentId, tx);

  const indent = await tx.indent.findFirst({
    where: { id: indentId },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (!indent) throw new Error("Indent not found");

  const { vendorId, vendorRate, acceptedQuoteId } = await resolveVendorAllocation(tx, indentId, data);

  if (!isAllocatableStatus(indent.allocationMode, indent.status)) {
    throw new Error(`Indent in status ${indent.status} cannot be allocated`);
  }

  const lines = indent.lines.filter((l) => !l.tripId);
  if (!lines.length) throw new Error("Indent has no open vehicle slots");

  const now = new Date();
  const deadlineAt = placementDeadline();
  const isReallocation = Boolean(indent.vendorId);

  for (const line of lines) {
    const activeOnLine = await tx.indentAllocation.findFirst({
      where: { indentLineId: line.id, status: "ACTIVE" },
    });
    if (activeOnLine) {
      await tx.indentAllocation.update({
        where: { id: activeOnLine.id },
        data: {
          status: "RELEASED",
          reallocatedAt: now,
          vehicleId: activeOnLine.vehicleId,
          driverId: activeOnLine.driverId,
        },
      });
    }

    await tx.indentAllocation.create({
      data: {
        indentId,
        indentLineId: line.id,
        vendorId,
        vendorRate,
        acceptedQuoteId,
        status: "ACTIVE",
        allocatedAt: now,
        deadlineAt,
        allocatedById: actor?.id ?? null,
      },
    });

    await tx.indentLine.update({
      where: { id: line.id },
      data: {
        status: line.status === "TRIP_CREATED" || line.status === "COMPLETED" ? line.status : "ALLOCATED",
        placementStatus: "PLACEMENT_PENDING",
        placementReachedAt: null,
      },
    });
  }

  if (acceptedQuoteId) {
    await tx.vendorQuote.update({ where: { id: acceptedQuoteId }, data: { status: "ACCEPTED" } });
    await tx.vendorQuote.updateMany({
      where: { indentId, id: { not: acceptedQuoteId }, status: "ACTIVE" },
      data: { status: "REJECTED" },
    });
  }

  const nextStatus = "PLACEMENT_PENDING";
  if (isReallocation && indent.status !== nextStatus) {
    assertTransition(indent.status, nextStatus);
  }

  await tx.indent.update({
    where: { id: indentId },
    data: {
      vendorId,
      allocatedQuoteId: acceptedQuoteId,
      vendorAllocatedAt: now,
      placementStatus: "PLACEMENT_PENDING",
      placementDeadlineAt: deadlineAt,
      vehicleId: null,
      driverId: null,
      status: nextStatus,
    },
  });

  return { vendorId, vendorRate, indentNumber: indent.indentNumber };
}

/** Allocate a vendor (from a quote or directly). Preserves allocation history. */
export async function allocateVendor(
  indentId: string,
  data: AllocateVendorInput,
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: { consignment: { select: { vehicleQuantity: true } } },
  });
  if (!indent) return null;

  const { vendorId, vendorRate } = await prisma.$transaction((tx) =>
    allocateVendorInTransaction(tx, indentId, data, actor)
  );
  const deadlineAt = placementDeadline();
  const qty = indent.consignment?.vehicleQuantity ?? 1;

  const { createImportantEvent, resolveImportantEvents } = await import("./important-event.service");
  await resolveImportantEvents(
    {
      types: [
        "VENDOR_QUOTE_RECEIVED",
        "ALLOCATION_PLACEMENT_DEADLINE",
        "PLACEMENT_DEADLINE_EXCEEDED",
        "DRIVER_OTP_PENDING",
      ],
      indentId,
    },
    { actorId: actor?.id }
  );
  await createImportantEvent({
    type: "ALLOCATION_PLACEMENT_DEADLINE",
    severity: "INFO",
    title: `Placement timer started for ${indent.indentNumber}`,
    description:
      qty > 1
        ? `${qty} vehicles must reach placement within 24 hours.`
        : "Vehicle must reach within 24 hours.",
    indentId,
    dueAt: deadlineAt,
  });

  await logAudit({
    user: actor,
    action: "indent.vendor_allocated",
    entity: "INDENT",
    entityId: indentId,
    meta: { vendorId, vendorRate, vehicleQuantity: qty },
  });

  const [vendor, route] = await Promise.all([
    prisma.vendor.findFirst({
      where: { id: vendorId },
      select: { name: true, phone: true, whatsapp: true },
    }),
    prisma.indent.findFirst({
      where: { id: indentId },
      select: {
        advanceStatus: true,
        advanceApproved: true,
        advanceRequested: true,
        consignment: { select: { vehicleTypeCode: true } },
        loading: { select: { city: true } },
        unloading: { select: { city: true } },
        payments: { where: { paymentType: "ADVANCE" }, orderBy: { paidAt: "desc" }, take: 1 },
        trips: {
          select: { advanceRequests: { select: tripAdvanceSummarySelect } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const to = vendor ? resolveWhatsAppRecipient(vendor) : null;
  if (vendor && to) {
    const labels = await resolveLookupLabels([
      ["VEHICLE_TYPE", route?.consignment?.vehicleTypeCode],
    ]);
    const { sendVendorAllocation } = await import("../adapters/whatsapp");
    await sendVendorAllocation(to, {
      indentNumber: indent.indentNumber,
      vendorName: vendor.name,
      fromCity: route?.loading?.city ?? null,
      toCity: route?.unloading?.city ?? null,
      vehicleType: labelOf(labels, "VEHICLE_TYPE", route?.consignment?.vehicleTypeCode),
      quotedRate: vendorRate,
      advanceAmount: route ? resolveIndentPromisedAdvanceAmount(route) : null,
      entityId: indentId,
    });
  }

  return (await import("./indent.service")).getIndentById(indentId);
}

/** Reallocate to a different vendor (old allocation → RELEASED, new → ACTIVE). */
export async function reallocateVendor(
  indentId: string,
  data: {
    vendorId?: string | null;
    quoteId?: string | null;
    vendorRate?: number | null;
    reason?: string | null;
  },
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: {
      status: true,
      lines: { select: { tripId: true } },
    },
  });
  if (!indent) return null;
  if (!REALLOCATABLE_STATUSES.includes(indent.status as (typeof REALLOCATABLE_STATUSES)[number])) {
    throw new Error(`Indent in status ${indent.status} cannot be reallocated`);
  }
  if (indent.lines.some((l) => l.tripId)) {
    throw new Error("Cannot reallocate after a trip has been created");
  }

  const result = await allocateVendor(indentId, data, actor);

  if (data.reason) {
    const released = await prisma.indentAllocation.findMany({
      where: { indentId, status: "RELEASED", reallocatedAt: { not: null } },
      orderBy: { reallocatedAt: "desc" },
      take: 20,
    });
    for (const r of released) {
      await prisma.indentAllocation.update({
        where: { id: r.id },
        data: { reallocationReason: data.reason },
      });
    }
  }

  await logAudit({
    user: actor,
    action: "indent.vendor_reallocated",
    entity: "INDENT",
    entityId: indentId,
    meta: { reason: data.reason ?? null },
  });

  return result;
}
