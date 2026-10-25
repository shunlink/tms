import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { nextNumber } from "../sequence";
import { putObject } from "../storage";
import {
  assertCanRaiseAdvanceOnBehalf,
  buildOnBehalfEventRemarks,
  formatAdvanceRaisedByLabel,
  formatAdvanceSourceLabel,
} from "../advance-source";
import { ADVANCE_SLA_MS, managedAdvanceSourceFilter } from "../constants";
import { ADVANCE_PAYMENT_METHODS } from "../advance-payment-methods";
import { resolveTripVendorAdvance, tripAdvanceSummarySelect, type TripVendorAdvance } from "../advance";
import {
  ACTIVE_ADVANCE_REQUEST_STATUSES,
  assertAdvanceRequestTransition,
} from "../advance-request-states";
import type { SessionUser } from "../auth";
import { assertAdvanceWithinFreightCap, maxAdvanceForVendorRate } from "../advance-limits";
import {
  ADVANCE_WINDOW_CLOSED_MESSAGE,
  assertTripAdvanceWindowOpen,
  isTripStatusInAdvanceWindow,
} from "../advance-trip-window";
import { randomUUID } from "crypto";

const TRIP_BLOCKED_STATUSES = new Set(["CANCELLED", "CLOSED"]);

const advanceInclude = {
  trip: {
    select: {
      id: true,
      lrNumber: true,
      routeFrom: true,
      routeTo: true,
      status: true,
      vendorRate: true,
      indentId: true,
      client: { select: { name: true } },
      indent: { select: { id: true, indentNumber: true } },
    },
  },
  vendor: { select: { id: true, name: true, phone: true, whatsapp: true, gstin: true } },
  requestedBy: { select: { id: true, name: true } },
  negotiatedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  processedBy: { select: { id: true, name: true } },
  escalatedBy: { select: { id: true, name: true } },
  paymentProofFile: { select: { id: true, url: true, fileName: true } },
  voucherFile: { select: { id: true, url: true, fileName: true } },
  events: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true } } },
  },
  outboundPayments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      paymentNumber: true,
      status: true,
      amountMinor: true,
      providerTransferRef: true,
      createdById: true,
      failureMessage: true,
    },
  },
} satisfies Prisma.AdvanceRequestInclude;

export type AdvancePaymentInput = {
  paidAmount: number;
  paymentMethod: string;
  paymentDate: string;
  utrReference: string;
  bankAccountUsed?: string | null;
  remarks?: string | null;
};

const PAYMENT_READY_STATUSES = ["APPROVED", "VENDOR_ACCEPTED", "SLA_BREACHED", "PROCESSING"] as const;

function n(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function mapAdvanceRequest(row: Prisma.AdvanceRequestGetPayload<{ include: typeof advanceInclude }>) {
  const now = Date.now();
  const deadlineMs = row.deadlineAt.getTime();
  const slaBreached =
    row.status === "SLA_BREACHED" ||
    (ACTIVE_ADVANCE_REQUEST_STATUSES.includes(row.status as typeof ACTIVE_ADVANCE_REQUEST_STATUSES[number]) &&
      now > deadlineMs &&
      row.status !== "PROCESSED");

  return {
    id: row.id,
    requestNumber: row.requestNumber,
    tripId: row.tripId,
    vendorId: row.vendorId,
    source: row.source,
    externalProvider: row.externalProvider,
    status: row.status,
    requestedAmount: n(row.requestedAmount),
    negotiatedAmount: row.negotiatedAmount != null ? n(row.negotiatedAmount) : null,
    approvedAmount: row.approvedAmount != null ? n(row.approvedAmount) : null,
    currency: row.currency,
    requestedAt: row.requestedAt,
    deadlineAt: row.deadlineAt,
    negotiatedAt: row.negotiatedAt,
    vendorAcceptedAt: row.vendorAcceptedAt,
    approvedAt: row.approvedAt,
    processedAt: row.processedAt,
    escalatedAt: row.escalatedAt,
    bulkRequestGroupId: row.bulkRequestGroupId,
    remarks: row.remarks,
    negotiationRemarks: row.negotiationRemarks,
    processingRemarks: row.processingRemarks,
    externalReference: row.externalReference,
    paidAmount: row.paidAmount != null ? n(row.paidAmount) : null,
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate,
    utrReference: row.utrReference,
    bankAccountUsed: row.bankAccountUsed,
    voucherNumber: row.voucherNumber,
    voucherGeneratedAt: row.voucherGeneratedAt,
    paymentProof: row.paymentProofFile
      ? {
          id: row.paymentProofFile.id,
          url: row.paymentProofFile.url,
          fileName: row.paymentProofFile.fileName,
        }
      : null,
    voucher: row.voucherFile
      ? {
          id: row.voucherFile.id,
          url: row.voucherFile.url,
          fileName: row.voucherFile.fileName,
        }
      : null,
    slaBreached,
    slaRemainingMs: slaBreached ? 0 : Math.max(0, deadlineMs - now),
    sourceLabel: formatAdvanceSourceLabel(row.source),
    raisedByLabel: formatAdvanceRaisedByLabel(row.source, row.requestedBy),
    trip: row.trip
      ? {
          id: row.trip.id,
          lrNumber: row.trip.lrNumber,
          route: `${row.trip.routeFrom} → ${row.trip.routeTo}`,
          routeFrom: row.trip.routeFrom,
          routeTo: row.trip.routeTo,
          status: row.trip.status,
          vendorRate: n(row.trip.vendorRate),
          indentId: row.trip.indentId,
          indentNumber: row.trip.indent?.indentNumber ?? null,
          client: row.trip.client.name,
        }
      : null,
    vendor: row.vendor,
    requestedBy: row.requestedBy,
    negotiatedBy: row.negotiatedBy,
    approvedBy: row.approvedBy,
    processedBy: row.processedBy,
    escalatedBy: row.escalatedBy,
    events: row.events.map((e) => ({
      id: e.id,
      action: e.action,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      amount: e.amount != null ? n(e.amount) : null,
      remarks: e.remarks,
      createdAt: e.createdAt,
      actor: e.actor,
    })),
    gatewayTransfers: row.outboundPayments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      status: p.status,
      amount: Math.round(p.amountMinor) / 100,
      providerTransferRef: p.providerTransferRef,
      createdById: p.createdById,
      failureMessage: p.failureMessage,
    })),
  };
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  advanceRequestId: string,
  input: {
    action: string;
    actorId?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    amount?: number | null;
    remarks?: string | null;
  }
) {
  await tx.advanceRequestEvent.create({
    data: {
      advanceRequestId,
      action: input.action,
      actorId: input.actorId ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      amount: input.amount ?? null,
      remarks: input.remarks ?? null,
    },
  });
}

function resolveApprovedCap(req: {
  approvedAmount: Prisma.Decimal | null;
  negotiatedAmount: Prisma.Decimal | null;
  requestedAmount: Prisma.Decimal;
}) {
  return n(req.approvedAmount ?? req.negotiatedAmount ?? req.requestedAmount);
}

function parsePaymentDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid payment date");
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) throw new Error("Payment date cannot be in the future");
  return d;
}

function assertPaymentMethod(method: string) {
  if (!ADVANCE_PAYMENT_METHODS.includes(method as (typeof ADVANCE_PAYMENT_METHODS)[number])) {
    throw new Error(`Invalid payment method: ${method}`);
  }
}

async function notifyAdvance(
  to: string | null | undefined,
  body: string,
  entityId: string
) {
  if (!to) return;
  const { deliverNow } = await import("../notify");
  await deliverNow({
    channel: "WHATSAPP",
    to,
    body,
    entityType: "ADVANCE_REQUEST",
    entityId,
  });
}

async function notifyFinanceUsers(body: string, entityId: string) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["FINANCE", "ADMIN", "SUPER_ADMIN"] },
    },
    select: { phone: true, email: true },
  });
  for (const u of users) {
    const to = u.phone ?? u.email;
    if (to) await notifyAdvance(to, body, entityId);
  }
}

/** Escalate overdue ShunLink requests (called on list/detail fetch). */
export async function escalateOverdueAdvanceRequests() {
  const now = new Date();
  const overdue = await prisma.advanceRequest.findMany({
    where: {
      ...managedAdvanceSourceFilter(),
      status: { in: ["PENDING_REVIEW", "NEGOTIATED", "VENDOR_ACCEPTED", "APPROVED"] },
      deadlineAt: { lt: now },
      escalatedAt: null,
    },
    include: { trip: { select: { lrNumber: true, indentId: true } }, vendor: { select: { name: true } } },
  });

  for (const req of overdue) {
    await prisma.$transaction(async (tx) => {
      assertAdvanceRequestTransition(req.status, "SLA_BREACHED");
      await tx.advanceRequest.update({
        where: { id: req.id },
        data: { status: "SLA_BREACHED", escalatedAt: now },
      });
      await recordEvent(tx, req.id, {
        action: "SLA_BREACHED",
        fromStatus: req.status,
        toStatus: "SLA_BREACHED",
        remarks: "24-hour SLA exceeded",
      });
    });

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "ADVANCE_SLA_BREACHED",
      severity: "CRITICAL",
      title: `Advance SLA breached — ${req.requestNumber}`,
      description: `Trip ${req.trip.lrNumber} · Vendor ${req.vendor.name} · Requested ₹${n(req.requestedAmount)}`,
      indentId: req.trip.indentId,
      relatedEntityId: req.id,
      dueAt: req.deadlineAt,
    });

    const { notifyFinanceUsers } = await import("./sla-notify.service");
    await notifyFinanceUsers(
      `SLA breached: Advance ${req.requestNumber} for trip ${req.trip.lrNumber} requires admin attention.`,
      "ADVANCE_REQUEST",
      req.id
    );

    const { markSlaTaskBreached } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    await markSlaTaskBreached(SLA_TYPES.ADVANCE_REQUEST, req.id, now);

    await logAudit({
      action: AUDIT_ACTIONS.ADVANCE_SLA_BREACHED,
      entity: "ADVANCE_REQUEST",
      entityId: req.id,
      meta: { requestNumber: req.requestNumber, tripId: req.tripId },
    });
  }

  return overdue.length;
}

async function assertTripEligibleForAdvance(tripId: string, vendorId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, vendorId },
    select: { id: true, status: true, lrNumber: true, vendorRate: true },
  });
  if (!trip) throw new Error("Trip not found or not assigned to this vendor");
  if (TRIP_BLOCKED_STATUSES.has(trip.status)) {
    throw new Error(`Advance cannot be requested for a trip in status ${trip.status}`);
  }
  assertTripAdvanceWindowOpen(trip.status);
  return trip;
}

/** Whether vendor may open a new advance request on this trip (before delivered). */
export async function isTripAdvanceWindowOpen(tripId: string): Promise<boolean> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { status: true },
  });
  if (!trip) return false;
  if (TRIP_BLOCKED_STATUSES.has(trip.status)) return false;
  return isTripStatusInAdvanceWindow(trip.status);
}

export function advanceWindowClosedReason(status: string): string | null {
  if (TRIP_BLOCKED_STATUSES.has(status)) {
    return `Advance cannot be requested for a trip in status ${status}`;
  }
  if (!isTripStatusInAdvanceWindow(status)) return ADVANCE_WINDOW_CLOSED_MESSAGE;
  return null;
}

/** One live advance per trip across sources — only rejected/cancelled requests allow a new one. */
async function assertNoLiveAdvanceRequest(tripId: string) {
  const existing = await prisma.advanceRequest.findFirst({
    where: { tripId, status: { notIn: ["REJECTED", "CANCELLED"] } },
    select: { requestNumber: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    throw new Error(
      `An advance request already exists for this trip (${existing.requestNumber}, ${existing.status})`
    );
  }
}

type ManagedAdvanceCreateInput = {
  requestedAmount: number;
  remarks?: string | null;
};

async function createManagedAdvanceRequest(
  tripId: string,
  vendorId: string,
  data: ManagedAdvanceCreateInput,
  source: "SHUNLINK" | "INTERNAL",
  actor?: SessionUser | null,
  options?: { vendorName?: string; actorName?: string; bulkRequestGroupId?: string | null }
) {
  if (data.requestedAmount <= 0) throw new Error("Requested amount must be greater than zero");

  const trip = await assertTripEligibleForAdvance(tripId, vendorId);
  assertAdvanceWithinFreightCap(data.requestedAmount, trip.vendorRate);
  await assertNoLiveAdvanceRequest(tripId);

  const requestNumber = await nextNumber("ADV");
  const requestedAt = new Date();
  const deadlineAt = new Date(requestedAt.getTime() + ADVANCE_SLA_MS);
  const isInternal = source === "INTERNAL";
  const eventAction = isInternal ? "REQUESTED_ON_BEHALF" : "REQUESTED";
  const eventRemarks =
    isInternal && options?.vendorName && options?.actorName
      ? buildOnBehalfEventRemarks(options.vendorName, options.actorName)
      : data.remarks ?? null;

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.advanceRequest.create({
      data: {
        requestNumber,
        tripId,
        vendorId,
        source,
        status: "PENDING_REVIEW",
        requestedAmount: data.requestedAmount,
        currency: "INR",
        requestedAt,
        deadlineAt,
        requestedById: actor?.id ?? null,
        remarks: data.remarks ?? null,
        bulkRequestGroupId: options?.bulkRequestGroupId ?? null,
      },
      include: advanceInclude,
    });
    await recordEvent(tx, created.id, {
      action: eventAction,
      actorId: actor?.id ?? null,
      toStatus: "PENDING_REVIEW",
      amount: data.requestedAmount,
      remarks: eventRemarks,
    });
    return created;
  });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "ADVANCE_PENDING",
    severity: "WARNING",
    title: isInternal
      ? `Internal advance raised — ${requestNumber}`
      : `Advance requested — ${requestNumber}`,
    description: `Trip ${trip.lrNumber} · ₹${data.requestedAmount}`,
    indentId: row.trip.indentId,
    relatedEntityId: row.id,
    dueAt: deadlineAt,
  });

  const { registerSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await registerSlaTask({
    type: SLA_TYPES.ADVANCE_REQUEST,
    entityId: row.id,
    startAt: requestedAt,
    deadlineAt,
    tripId,
  });

  const { notifyFinanceUsers } = await import("./sla-notify.service");
  await notifyFinanceUsers(
    isInternal
      ? `Internal advance ${requestNumber} raised for trip ${trip.lrNumber}: ₹${data.requestedAmount}`
      : `New advance request ${requestNumber} for trip ${trip.lrNumber}: ₹${data.requestedAmount}`,
    "ADVANCE_REQUEST",
    row.id
  );

  if (isInternal) {
    const tripWithVendor = await prisma.trip.findFirst({
      where: { id: tripId },
      select: { lrNumber: true, vendor: { select: { phone: true, whatsapp: true } } },
    });
    await notifyAdvance(
      tripWithVendor?.vendor.whatsapp ?? tripWithVendor?.vendor.phone,
      `A ShunLink advance request of ₹${data.requestedAmount} has been raised on your behalf for trip ${tripWithVendor?.lrNumber}.`,
      row.id
    );
  }

  await logAudit({
    user: actor,
    action: isInternal ? "advance.requested_on_behalf" : "advance.requested",
    entity: "ADVANCE_REQUEST",
    entityId: row.id,
    meta: {
      tripId,
      vendorId,
      source,
      requestedAmount: data.requestedAmount,
      ...(isInternal && options?.vendorName
        ? { onBehalfOf: options.vendorName, raisedBy: options.actorName }
        : {}),
    },
  });

  return mapAdvanceRequest(row);
}

/** Vendor requests advance from ShunLink after trip creation. */
export async function createShunLinkAdvanceRequest(
  tripId: string,
  vendorId: string,
  data: ManagedAdvanceCreateInput,
  actor?: SessionUser | null,
  options?: { bulkRequestGroupId?: string | null }
) {
  return createManagedAdvanceRequest(tripId, vendorId, data, "SHUNLINK", actor, options);
}

export type BulkAdvanceEligibleTrip = {
  tripId: string;
  lrNumber: string;
  route: string;
  vendorRate: number;
  maxAdvance: number;
};

/** Trips on an indent where vendor may request a new ShunLink advance. */
export async function listIndentAdvanceEligibleTrips(vendorId: string, indentId: string) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId, vendorId },
    select: { id: true, indentNumber: true },
  });
  if (!indent) throw new Error("Indent not found or not allocated to this vendor");

  const trips = await prisma.trip.findMany({
    where: { indentId, vendorId },
    select: {
      id: true,
      lrNumber: true,
      routeFrom: true,
      routeTo: true,
      vendorRate: true,
      status: true,
    },
    orderBy: { lrNumber: "asc" },
  });

  const eligible: BulkAdvanceEligibleTrip[] = [];
  for (const trip of trips) {
    if (TRIP_BLOCKED_STATUSES.has(trip.status)) continue;
    if (!isTripStatusInAdvanceWindow(trip.status)) continue;
    const live = await prisma.advanceRequest.findFirst({
      where: { tripId: trip.id, status: { notIn: ["REJECTED", "CANCELLED"] } },
      select: { id: true },
    });
    if (live) continue;
    eligible.push({
      tripId: trip.id,
      lrNumber: trip.lrNumber,
      route: `${trip.routeFrom} → ${trip.routeTo}`,
      vendorRate: n(trip.vendorRate),
      maxAdvance: maxAdvanceForVendorRate(trip.vendorRate),
    });
  }

  return {
    indentId: indent.id,
    indentNumber: indent.indentNumber,
    trips: eligible,
  };
}

export function splitBulkAdvanceAmounts(
  eligible: BulkAdvanceEligibleTrip[],
  mode: "equal" | "max",
  totalAmount?: number
): { tripId: string; requestedAmount: number }[] {
  if (eligible.length === 0) throw new Error("No eligible trips for bulk advance");

  if (mode === "max") {
    return eligible.map((t) => ({ tripId: t.tripId, requestedAmount: t.maxAdvance }));
  }

  if (totalAmount == null || totalAmount <= 0) {
    throw new Error("totalAmount is required for equal split");
  }

  const sumMax = eligible.reduce((s, t) => s + t.maxAdvance, 0);
  if (totalAmount > sumMax) {
    throw new Error(
      `Total advance ₹${totalAmount.toLocaleString("en-IN")} exceeds combined maximum ₹${sumMax.toLocaleString("en-IN")} for selected trips`
    );
  }

  const n = eligible.length;
  const base = Math.floor((totalAmount / n) * 100) / 100;
  let allocated = 0;
  const items: { tripId: string; requestedAmount: number }[] = [];

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const cap = eligible[i].maxAdvance;
    let amount = isLast ? Math.round((totalAmount - allocated) * 100) / 100 : base;
    if (amount > cap) amount = cap;
    if (amount <= 0) throw new Error(`Could not split total across trips; check amounts for ${eligible[i].lrNumber}`);
    items.push({ tripId: eligible[i].tripId, requestedAmount: amount });
    allocated += amount;
  }

  const diff = Math.round((totalAmount - allocated) * 100) / 100;
  if (diff !== 0 && items.length > 0) {
    const last = items[items.length - 1];
    const bumped = Math.round((last.requestedAmount + diff) * 100) / 100;
    if (bumped > eligible[eligible.length - 1].maxAdvance || bumped <= 0) {
      throw new Error("Could not distribute total amount across trips within per-LR limits");
    }
    last.requestedAmount = bumped;
  }

  return items;
}

/** Validate bulk items before any writes; throws on first error. */
export async function validateBulkShunLinkAdvanceItems(
  vendorId: string,
  indentId: string,
  items: { tripId: string; requestedAmount: number }[]
) {
  if (items.length === 0) throw new Error("At least one trip is required");

  const tripIds = Array.from(new Set(items.map((i) => i.tripId)));
  if (tripIds.length !== items.length) throw new Error("Duplicate trips in bulk advance request");

  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds }, vendorId, indentId },
    select: { id: true, lrNumber: true, vendorRate: true, status: true },
  });
  const byId = new Map(trips.map((t) => [t.id, t]));

  for (const item of items) {
    const trip = byId.get(item.tripId);
    if (!trip) {
      throw new Error(`Trip ${item.tripId} is not part of this indent or is not assigned to you`);
    }
    if (TRIP_BLOCKED_STATUSES.has(trip.status)) {
      throw new Error(`Advance cannot be requested for trip ${trip.lrNumber} in status ${trip.status}`);
    }
    if (!isTripStatusInAdvanceWindow(trip.status)) {
      throw new Error(`Advance cannot be requested for trip ${trip.lrNumber}: ${ADVANCE_WINDOW_CLOSED_MESSAGE}`);
    }
    if (item.requestedAmount <= 0) {
      throw new Error(`Requested amount must be greater than zero for trip ${trip.lrNumber}`);
    }
    assertAdvanceWithinFreightCap(item.requestedAmount, trip.vendorRate);
    await assertNoLiveAdvanceRequest(item.tripId);
  }
}

/** One vendor submit → N trip advance requests linked by bulkRequestGroupId. */
export async function createBulkShunLinkAdvanceRequests(
  vendorId: string,
  indentId: string,
  items: { tripId: string; requestedAmount: number }[],
  remarks?: string | null,
  actor?: SessionUser | null
) {
  await validateBulkShunLinkAdvanceItems(vendorId, indentId, items);

  const bulkRequestGroupId = randomUUID();
  const requests = [];

  for (const item of items) {
    const row = await createShunLinkAdvanceRequest(
      item.tripId,
      vendorId,
      { requestedAmount: item.requestedAmount, remarks },
      actor,
      { bulkRequestGroupId }
    );
    requests.push(row);
  }

  return { bulkRequestGroupId, requests };
}

/** Finance/Admin raises advance on behalf of a vendor (same workflow as vendor-initiated). */
export async function createInternalAdvanceRequest(
  tripId: string,
  vendorId: string,
  data: ManagedAdvanceCreateInput,
  actor: SessionUser
) {
  assertCanRaiseAdvanceOnBehalf(actor);

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: { name: true },
  });
  if (!vendor) throw new Error("Vendor not found");

  return createManagedAdvanceRequest(tripId, vendorId, data, "INTERNAL", actor, {
    vendorName: vendor.name,
    actorName: actor.name ?? "Staff",
  });
}

/** Trip/vendor context for the internal raise-advance form. */
export async function getAdvanceTripContext(tripId: string, vendorId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, vendorId },
    select: {
      id: true,
      lrNumber: true,
      routeFrom: true,
      routeTo: true,
      vendorRate: true,
      status: true,
      client: { select: { name: true } },
      indent: { select: { indentNumber: true } },
    },
  });
  if (!trip) throw new Error("Trip not found or not assigned to this vendor");
  if (TRIP_BLOCKED_STATUSES.has(trip.status)) {
    throw new Error(`Advance cannot be requested for a trip in status ${trip.status}`);
  }

  const windowClosedReason = advanceWindowClosedReason(trip.status);
  const advance = await getTripVendorAdvance(tripId);
  const live = await prisma.advanceRequest.findFirst({
    where: { tripId, status: { notIn: ["REJECTED", "CANCELLED"] } },
    select: { requestNumber: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  const canRequestAdvance = !windowClosedReason && !live;

  return {
    tripId: trip.id,
    vendorId,
    lrNumber: trip.lrNumber,
    route: `${trip.routeFrom} → ${trip.routeTo}`,
    clientName: trip.client.name,
    indentNumber: trip.indent?.indentNumber ?? null,
    buyRate: n(trip.vendorRate),
    advanceApproved: advance?.approvedAmount ?? null,
    advancePaid: advance?.paidAmount ?? null,
    advanceOutstanding: advance?.outstandingAmount ?? null,
    hasLiveRequest: Boolean(live),
    liveRequestNumber: live?.requestNumber ?? null,
    liveRequestStatus: live?.status ?? null,
    canRequestAdvance,
    advanceWindowClosedReason: windowClosedReason,
  };
}

/** Vendor opts for external finance provider — no ShunLink workflow. */
export async function recordExternalAdvanceIntent(
  tripId: string,
  vendorId: string,
  data: { provider: string; remarks?: string | null },
  actor?: SessionUser | null
) {
  await assertTripEligibleForAdvance(tripId, vendorId);
  await assertNoLiveAdvanceRequest(tripId);

  const requestNumber = await nextNumber("ADV");
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.advanceRequest.create({
      data: {
        requestNumber,
        tripId,
        vendorId,
        source: "EXTERNAL",
        externalProvider: data.provider,
        status: "EXTERNAL",
        requestedAmount: 0,
        requestedAt: new Date(),
        deadlineAt: new Date(),
        requestedById: actor?.id ?? null,
        remarks: data.remarks ?? null,
      },
      include: advanceInclude,
    });
    await recordEvent(tx, created.id, {
      action: "EXTERNAL_SELECTED",
      actorId: actor?.id ?? null,
      toStatus: "EXTERNAL",
      remarks: `Provider: ${data.provider}`,
    });
    return created;
  });

  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { lrNumber: true, vendor: { select: { name: true } } },
  });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "EXTERNAL_ADVANCE_SELECTED",
    severity: "INFO",
    title: `External advance — ${requestNumber}`,
    description: `Trip ${trip?.lrNumber} · Vendor ${trip?.vendor.name} · Provider ${data.provider}`,
    indentId: row.trip.indentId,
    relatedEntityId: row.id,
  });

  await notifyFinanceUsers(
    `Vendor selected external finance provider (${data.provider}) for trip ${trip?.lrNumber}.`,
    row.id
  );

  await logAudit({
    user: actor,
    action: "advance.external_selected",
    entity: "ADVANCE_REQUEST",
    entityId: row.id,
    meta: { tripId, provider: data.provider },
  });

  return mapAdvanceRequest(row);
}

/** Finance updates external provider advance details (no provider API). */
export async function updateExternalAdvanceRecord(
  id: string,
  data: {
    requestedAmount?: number | null;
    approvedAmount?: number | null;
    externalReference?: string | null;
    remarks?: string | null;
  },
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({ where: { id, source: "EXTERNAL" } });
  if (!req) return null;

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: {
        ...(data.requestedAmount != null ? { requestedAmount: data.requestedAmount } : {}),
        ...(data.approvedAmount != null ? { approvedAmount: data.approvedAmount } : {}),
        ...(data.externalReference !== undefined ? { externalReference: data.externalReference } : {}),
        ...(data.remarks !== undefined ? { processingRemarks: data.remarks } : {}),
      },
      include: advanceInclude,
    });
    await recordEvent(tx, id, {
      action: "EXTERNAL_UPDATED",
      actorId: actor?.id ?? null,
      fromStatus: req.status,
      toStatus: req.status,
      amount: data.approvedAmount ?? data.requestedAmount ?? null,
      remarks: data.externalReference ?? data.remarks ?? null,
    });
    return updated;
  });

  if (row.externalReference || row.approvedAmount != null) {
    const { resolveImportantEvents } = await import("./important-event.service");
    await resolveImportantEvents(
      { types: ["EXTERNAL_ADVANCE_SELECTED"], relatedEntityIds: [id] },
      { actorId: actor?.id }
    );
  }

  const { AUDIT_ACTIONS } = await import("../audit-actions");
  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.EXTERNAL_ADVANCE_UPDATED,
    entity: "AdvanceRequest",
    entityId: id,
    tripId: req.tripId,
    meta: data,
    before: {
      requestedAmount: n(req.requestedAmount),
      approvedAmount: req.approvedAmount != null ? n(req.approvedAmount) : null,
      externalReference: req.externalReference,
    },
    after: {
      requestedAmount: data.requestedAmount ?? n(req.requestedAmount),
      approvedAmount: data.approvedAmount ?? (req.approvedAmount != null ? n(req.approvedAmount) : null),
      externalReference: data.externalReference ?? req.externalReference,
    },
  });

  return mapAdvanceRequest(row);
}

export async function getAdvanceRequestById(id: string) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.ADVANCE_REQUEST]);
  const row = await prisma.advanceRequest.findFirst({
    where: { id },
    include: advanceInclude,
  });
  return row ? mapAdvanceRequest(row) : null;
}

/** AdvanceRequest is the source of truth for vendor advance on a trip. */
export async function getTripVendorAdvance(tripId: string): Promise<TripVendorAdvance | null> {
  const rows = await prisma.advanceRequest.findMany({
    where: { tripId },
    select: tripAdvanceSummarySelect,
    orderBy: { createdAt: "desc" },
  });
  return resolveTripVendorAdvance(rows);
}

export async function getVendorTripAdvanceRequest(vendorId: string, tripId: string) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.ADVANCE_REQUEST]);

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, vendorId },
    select: { id: true },
  });
  if (!trip) return null;

  const row = await prisma.advanceRequest.findFirst({
    where: { tripId, status: { notIn: ["CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    include: advanceInclude,
  });
  return row ? mapAdvanceRequest(row) : null;
}

export async function listAdvanceRequests(filters?: {
  source?: string;
  status?: string;
  vendorId?: string;
  tripId?: string;
  slaBreachedOnly?: boolean;
}) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.ADVANCE_REQUEST]);

  const sourceFilter =
    filters?.source === "SHUNLINK"
      ? managedAdvanceSourceFilter()
      : filters?.source
        ? { source: filters.source }
        : {};

  const rows = await prisma.advanceRequest.findMany({
    where: {
      ...sourceFilter,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters?.tripId ? { tripId: filters.tripId } : {}),
      ...(filters?.slaBreachedOnly ? { status: "SLA_BREACHED" } : {}),
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    include: advanceInclude,
  });

  return rows.map(mapAdvanceRequest);
}

/** Finance/Admin approves the requested amount directly. */
export async function approveAdvanceRequest(
  id: string,
  data: { remarks?: string | null },
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id, ...managedAdvanceSourceFilter() },
    include: { trip: { select: { vendorRate: true } } },
  });
  if (!req) return null;
  if (req.status !== "PENDING_REVIEW" && req.status !== "SLA_BREACHED") {
    throw new Error(`Cannot approve request in status ${req.status}`);
  }
  assertAdvanceWithinFreightCap(n(req.requestedAmount), req.trip.vendorRate);

  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    assertAdvanceRequestTransition(req.status, "APPROVED");
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAmount: req.requestedAmount,
        approvedAt: now,
        approvedById: actor?.id ?? null,
      },
      include: advanceInclude,
    });
    await recordEvent(tx, id, {
      action: "APPROVED",
      actorId: actor?.id ?? null,
      fromStatus: req.status,
      toStatus: "APPROVED",
      amount: n(req.requestedAmount),
      remarks: data.remarks ?? null,
    });
    return updated;
  });

  const trip = await prisma.trip.findFirst({
    where: { id: req.tripId },
    select: { lrNumber: true, vendor: { select: { phone: true, whatsapp: true } } },
  });
  await notifyAdvance(
    trip?.vendor.whatsapp ?? trip?.vendor.phone,
    `Your advance request ${req.requestNumber} for trip ${trip?.lrNumber} has been approved for ₹${n(req.requestedAmount)}.`,
    id
  );

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.APPROVED_ADVANCE,
    entity: "AdvanceRequest",
    entityId: id,
    tripId: req.tripId,
    meta: { requestNumber: req.requestNumber, approvedAmount: n(req.requestedAmount), ...data },
    before: { status: req.status },
    after: { status: "APPROVED", approvedAmount: n(req.requestedAmount) },
  });

  return mapAdvanceRequest(row);
}

/** Finance/Admin negotiates a lower amount. */
export async function negotiateAdvanceRequest(
  id: string,
  data: { negotiatedAmount: number; remarks?: string | null },
  actor?: SessionUser | null
) {
  if (data.negotiatedAmount <= 0) throw new Error("Negotiated amount must be greater than zero");

  const req = await prisma.advanceRequest.findFirst({
    where: { id, ...managedAdvanceSourceFilter() },
    include: { trip: { select: { vendorRate: true } } },
  });
  if (!req) return null;
  if (req.status !== "PENDING_REVIEW" && req.status !== "SLA_BREACHED") {
    throw new Error(`Cannot negotiate request in status ${req.status}`);
  }
  assertAdvanceWithinFreightCap(data.negotiatedAmount, req.trip.vendorRate);

  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    assertAdvanceRequestTransition(req.status, "NEGOTIATED");
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: {
        status: "NEGOTIATED",
        negotiatedAmount: data.negotiatedAmount,
        negotiatedAt: now,
        negotiatedById: actor?.id ?? null,
        negotiationRemarks: data.remarks ?? null,
      },
      include: advanceInclude,
    });
    await recordEvent(tx, id, {
      action: "NEGOTIATED",
      actorId: actor?.id ?? null,
      fromStatus: req.status,
      toStatus: "NEGOTIATED",
      amount: data.negotiatedAmount,
      remarks: data.remarks ?? null,
    });
    return updated;
  });

  const trip = await prisma.trip.findFirst({
    where: { id: req.tripId },
    select: { lrNumber: true, vendor: { select: { phone: true, whatsapp: true } } },
  });
  await notifyAdvance(
    trip?.vendor.whatsapp ?? trip?.vendor.phone,
    `ShunLink has offered ₹${data.negotiatedAmount} advance for trip ${trip?.lrNumber} (you requested ₹${n(req.requestedAmount)}). Please accept in the vendor portal to proceed.`,
    id
  );

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.NEGOTIATED_ADVANCE,
    entity: "AdvanceRequest",
    entityId: id,
    tripId: req.tripId,
    meta: { requestNumber: req.requestNumber, requestedAmount: n(req.requestedAmount), ...data },
    before: { status: req.status, requestedAmount: n(req.requestedAmount) },
    after: { status: "NEGOTIATED", negotiatedAmount: data.negotiatedAmount },
  });

  return mapAdvanceRequest(row);
}

/** Vendor accepts the negotiated amount. */
export async function vendorAcceptNegotiatedAdvance(
  id: string,
  vendorId: string,
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id, vendorId, ...managedAdvanceSourceFilter() },
  });
  if (!req) return null;
  if (req.status !== "NEGOTIATED") {
    throw new Error("No negotiated amount is available to accept");
  }
  if (req.negotiatedAmount == null) {
    throw new Error("Negotiated amount is missing");
  }

  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    assertAdvanceRequestTransition(req.status, "VENDOR_ACCEPTED");
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: {
        status: "VENDOR_ACCEPTED",
        approvedAmount: req.negotiatedAmount,
        vendorAcceptedAt: now,
      },
      include: advanceInclude,
    });
    await recordEvent(tx, id, {
      action: "VENDOR_ACCEPTED",
      actorId: actor?.id ?? null,
      fromStatus: req.status,
      toStatus: "VENDOR_ACCEPTED",
      amount: n(req.negotiatedAmount),
    });
    return updated;
  });

  await notifyFinanceUsers(
    `Vendor accepted negotiated advance ${req.requestNumber}: ₹${n(req.negotiatedAmount)}`,
    id
  );

  await logAudit({
    user: actor,
    action: "advance.vendor_accepted",
    entity: "ADVANCE_REQUEST",
    entityId: id,
  });

  return mapAdvanceRequest(row);
}

/** Finance saves payment draft and moves request to processing. */
export async function processAdvanceRequest(
  id: string,
  data: AdvancePaymentInput,
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({ where: { id, ...managedAdvanceSourceFilter() } });
  if (!req) return null;
  if (!PAYMENT_READY_STATUSES.includes(req.status as typeof PAYMENT_READY_STATUSES[number])) {
    throw new Error(`Cannot process request in status ${req.status}`);
  }

  assertPaymentMethod(data.paymentMethod);
  const cap = resolveApprovedCap(req);
  if (data.paidAmount > cap) {
    throw new Error(`Amount to pay cannot exceed approved amount of ₹${cap}`);
  }

  const paymentDate = parsePaymentDate(data.paymentDate);
  const fromStatus = req.status;

  const row = await prisma.$transaction(async (tx) => {
    if (req.status !== "PROCESSING") {
      assertAdvanceRequestTransition(req.status, "PROCESSING");
    }
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: {
        status: "PROCESSING",
        paidAmount: data.paidAmount,
        paymentMethod: data.paymentMethod,
        paymentDate,
        utrReference: data.utrReference,
        bankAccountUsed: data.bankAccountUsed ?? null,
        processingRemarks: data.remarks ?? null,
      },
      include: advanceInclude,
    });
    if (fromStatus !== "PROCESSING") {
      await recordEvent(tx, id, {
        action: "PROCESSING",
        actorId: actor?.id ?? null,
        fromStatus,
        toStatus: "PROCESSING",
        amount: data.paidAmount,
        remarks: data.remarks ?? null,
      });
    }
    return updated;
  });

  await logAudit({
    user: actor,
    action: "advance.processing",
    entity: "ADVANCE_REQUEST",
    entityId: id,
    meta: data,
  });

  return mapAdvanceRequest(row);
}

/** Finance completes payment with proof, generates voucher, and marks PROCESSED. */
export async function completeAdvancePayment(
  id: string,
  data: AdvancePaymentInput,
  proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null,
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({ where: { id, ...managedAdvanceSourceFilter() } });
  if (!req) return null;
  if (!PAYMENT_READY_STATUSES.includes(req.status as typeof PAYMENT_READY_STATUSES[number])) {
    throw new Error(`Cannot complete payment for request in status ${req.status}`);
  }

  assertPaymentMethod(data.paymentMethod);
  const cap = resolveApprovedCap(req);
  if (data.paidAmount > cap) {
    throw new Error(`Amount to pay cannot exceed approved amount of ₹${cap}`);
  }
  if (!proof && !req.paymentProofFileId) {
    throw new Error("Payment proof is required before marking payment as processed");
  }

  const paymentDate = parsePaymentDate(data.paymentDate);
  const now = new Date();
  let proofFileId = req.paymentProofFileId;

  const row = await prisma.$transaction(async (tx) => {
    let currentStatus = req.status;
    if (currentStatus !== "PROCESSING") {
      assertAdvanceRequestTransition(currentStatus, "PROCESSING");
      await tx.advanceRequest.update({
        where: { id },
        data: {
          status: "PROCESSING",
          paidAmount: data.paidAmount,
          paymentMethod: data.paymentMethod,
          paymentDate,
          utrReference: data.utrReference,
          bankAccountUsed: data.bankAccountUsed ?? null,
          processingRemarks: data.remarks ?? null,
        },
      });
      await recordEvent(tx, id, {
        action: "PROCESSING",
        actorId: actor?.id ?? null,
        fromStatus: currentStatus,
        toStatus: "PROCESSING",
        amount: data.paidAmount,
        remarks: data.remarks ?? null,
      });
      currentStatus = "PROCESSING";
    } else {
      await tx.advanceRequest.update({
        where: { id },
        data: {
          paidAmount: data.paidAmount,
          paymentMethod: data.paymentMethod,
          paymentDate,
          utrReference: data.utrReference,
          bankAccountUsed: data.bankAccountUsed ?? null,
          processingRemarks: data.remarks ?? null,
        },
      });
    }

    if (proof) {
      const safeName = proof.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `advance-payment/${id}/${Date.now()}-${safeName}`;
      const { url } = await putObject(key, proof.buffer);
      const stored = await tx.storedFile.create({
        data: {
          fileName: proof.fileName,
          mimeType: proof.mimeType ?? null,
          sizeBytes: proof.sizeBytes,
          storageKey: key,
          url,
          uploadedById: actor?.id ?? null,
        },
      });
      await tx.documentAttachment.create({
        data: {
          fileId: stored.id,
          entityType: "ADVANCE_REQUEST",
          entityId: id,
          documentType: "PAYMENT_PROOF",
          title: proof.fileName,
        },
      });
      proofFileId = stored.id;
    }

    assertAdvanceRequestTransition("PROCESSING", "PROCESSED");
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: {
        status: "PROCESSED",
        processedAt: now,
        processedById: actor?.id ?? null,
        paidAmount: data.paidAmount,
        paymentMethod: data.paymentMethod,
        paymentDate,
        utrReference: data.utrReference,
        bankAccountUsed: data.bankAccountUsed ?? null,
        processingRemarks: data.remarks ?? req.processingRemarks,
        paymentProofFileId: proofFileId,
      },
      include: advanceInclude,
    });
    await recordEvent(tx, id, {
      action: "PROCESSED",
      actorId: actor?.id ?? null,
      fromStatus: "PROCESSING",
      toStatus: "PROCESSED",
      amount: data.paidAmount,
      remarks: data.remarks ?? null,
    });
    return updated;
  });

  const { generateAndStoreAdvanceVoucher } = await import("./advance-voucher.service");
  const voucher = await generateAndStoreAdvanceVoucher(id, actor?.name ?? null);

  const trip = await prisma.trip.findFirst({
    where: { id: req.tripId },
    select: { lrNumber: true, vendor: { select: { phone: true, whatsapp: true } } },
  });
  await notifyAdvance(
    trip?.vendor.whatsapp ?? trip?.vendor.phone,
    `Your advance of ₹${data.paidAmount} for trip ${trip?.lrNumber} has been processed. Voucher: ${voucher.voucherNumber}. Download: ${voucher.voucherUrl}`,
    id
  );

  const { resolveSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await resolveSlaTask(SLA_TYPES.ADVANCE_REQUEST, id);
  const { resolveImportantEvents } = await import("./important-event.service");
  await resolveImportantEvents(
    { types: ["ADVANCE_PENDING", "ADVANCE_SLA_BREACHED"], relatedEntityIds: [id] },
    { actorId: actor?.id }
  );

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.ADVANCE_PROCESSED,
    entity: "AdvanceRequest",
    entityId: id,
    tripId: req.tripId,
    meta: { requestNumber: req.requestNumber, voucherNumber: voucher.voucherNumber, ...data },
    before: { status: req.status },
    after: { status: "PROCESSED", paidAmount: data.paidAmount },
  });

  const { recordAdvanceInVendorLedger } = await import("./vendor-payment.service");
  await recordAdvanceInVendorLedger(id, actor);

  const refreshed = await prisma.advanceRequest.findFirst({
    where: { id },
    include: advanceInclude,
  });
  return refreshed ? mapAdvanceRequest(refreshed) : mapAdvanceRequest(row);
}

/** @deprecated Use completeAdvancePayment — kept for API compatibility. */
export async function markAdvanceRequestProcessed(
  id: string,
  data: AdvancePaymentInput,
  proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null,
  actor?: SessionUser | null
) {
  return completeAdvancePayment(id, data, proof, actor);
}

/** Reject an advance request. */
export async function rejectAdvanceRequest(
  id: string,
  data: { remarks?: string | null },
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({ where: { id, ...managedAdvanceSourceFilter() } });
  if (!req) return null;
  if (!["PENDING_REVIEW", "NEGOTIATED", "SLA_BREACHED"].includes(req.status)) {
    throw new Error(`Cannot reject request in status ${req.status}`);
  }

  const row = await prisma.$transaction(async (tx) => {
    assertAdvanceRequestTransition(req.status, "REJECTED");
    const updated = await tx.advanceRequest.update({
      where: { id },
      data: { status: "REJECTED", processingRemarks: data.remarks ?? null },
      include: advanceInclude,
    });
    await recordEvent(tx, id, {
      action: "REJECTED",
      actorId: actor?.id ?? null,
      fromStatus: req.status,
      toStatus: "REJECTED",
      remarks: data.remarks ?? null,
    });
    return updated;
  });

  const { resolveSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await resolveSlaTask(SLA_TYPES.ADVANCE_REQUEST, id);
  const { resolveImportantEvents } = await import("./important-event.service");
  await resolveImportantEvents(
    { types: ["ADVANCE_PENDING", "ADVANCE_SLA_BREACHED"], relatedEntityIds: [id] },
    { actorId: actor?.id }
  );

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.ADVANCE_REJECTED,
    entity: "AdvanceRequest",
    entityId: id,
    tripId: req.tripId,
    meta: { requestNumber: req.requestNumber, ...data },
    before: { status: req.status },
    after: { status: "REJECTED" },
  });

  return mapAdvanceRequest(row);
}
