import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { BALANCE_PAYMENT_SLA_MS } from "../constants";
import {
  ACTIVE_BALANCE_PAYMENT_STATUSES,
  assertBalancePaymentTransition,
  canBalancePaymentTransition,
} from "../balance-payment-states";
import { balanceOutstandingAmount } from "../payables";
import { computeTripVendorBalance } from "../vendor-balance";
import { validatePaymentFields } from "../payment-validation";
import { putObject } from "../storage";
import type { SessionUser } from "../auth";

const taskInclude = {
  trip: {
    select: {
      id: true,
      lrNumber: true,
      routeFrom: true,
      routeTo: true,
      status: true,
      vendorRate: true,
      podVerifiedAt: true,
      tripClosedAt: true,
      charges: {
        orderBy: { createdAt: "asc" },
        select: { id: true, chargeType: true, amount: true, description: true },
      },
    },
  },
  vendor: { select: { id: true, name: true, phone: true, whatsapp: true, gstin: true } },
  indent: {
    select: {
      id: true,
      indentNumber: true,
      createdById: true,
      createdBy: { select: { id: true, teamId: true, name: true } },
    },
  },
  approvedBy: { select: { id: true, name: true } },
  processedBy: { select: { id: true, name: true } },
  voucherFile: { select: { id: true, url: true, fileName: true } },
  payments: {
    orderBy: { paidAt: "desc" },
    include: {
      recordedBy: { select: { id: true, name: true } },
      proofFile: { select: { id: true, url: true, fileName: true } },
    },
  },
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
} satisfies Prisma.VendorBalancePaymentTaskInclude;

function n(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

const VENDOR_NOTE_PURPOSE_LABELS: Record<string, string> = {
  VENDOR_FREIGHT_INCREASE: "Freight / charges increase",
  VENDOR_FREIGHT_REDUCTION: "Freight reduction (deduction)",
  OTHER: "Other adjustment",
};

export type BalanceTaskFinancialNote = {
  id: string;
  noteNumber: string | null;
  noteType: string;
  businessPurpose: string;
  purposeLabel: string;
  totalAmount: number;
  issuedAt: Date | null;
  reason: string | null;
};

async function loadVendorFinancialNotesForTrip(tripId: string): Promise<BalanceTaskFinancialNote[]> {
  const notes = await prisma.financialNote.findMany({
    where: {
      tripId,
      counterpartyType: "VENDOR",
      status: "ISSUED",
      payableEffect: "APPLY_TO_SUBLEDGER",
    },
    orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      noteNumber: true,
      noteType: true,
      businessPurpose: true,
      totalAmount: true,
      issuedAt: true,
      reason: true,
    },
  });

  return notes.map((note) => ({
    id: note.id,
    noteNumber: note.noteNumber,
    noteType: note.noteType,
    businessPurpose: note.businessPurpose,
    purposeLabel: VENDOR_NOTE_PURPOSE_LABELS[note.businessPurpose] ?? note.businessPurpose,
    totalAmount: n(note.totalAmount),
    issuedAt: note.issuedAt,
    reason: note.reason,
  }));
}

async function finalizeBalancePaymentTask(
  row: Prisma.VendorBalancePaymentTaskGetPayload<{ include: typeof taskInclude }> | null,
  options?: { syncFromPayable?: boolean }
) {
  if (!row) return null;

  if (options?.syncFromPayable && row.status !== "PROCESSED") {
    await syncBalancePaymentTaskFromPayable(row.tripId);
    const refreshed = await prisma.vendorBalancePaymentTask.findFirst({
      where: { id: row.id },
      include: taskInclude,
    });
    if (refreshed) row = refreshed;
  }

  const mapped = mapTask(row);
  if (!mapped) return null;

  const financialNotes = await loadVendorFinancialNotesForTrip(row.tripId);
  return { ...mapped, financialNotes };
}

function mapTask(
  row: Prisma.VendorBalancePaymentTaskGetPayload<{ include: typeof taskInclude }> | null
) {
  if (!row) return null;
  const now = Date.now();
  const deadlineMs = row.deadlineAt.getTime();
  const slaBreached =
    row.status === "SLA_BREACHED" ||
    (ACTIVE_BALANCE_PAYMENT_STATUSES.includes(row.status as typeof ACTIVE_BALANCE_PAYMENT_STATUSES[number]) &&
      row.status !== "PROCESSED" &&
      now > deadlineMs);

  const paidAmount = n(row.paidAmount);
  const balanceAmount = n(row.balanceAmount);
  const outstandingBalance = Math.max(0, Math.round((balanceAmount - paidAmount) * 100) / 100);

  return {
    id: row.id,
    tripId: row.tripId,
    vendorId: row.vendorId,
    indentId: row.indentId,
    status: row.status,
    freightAmount: n(row.freightAmount),
    additionalChargesAmount: n(row.additionalChargesAmount),
    deductionsAmount: n(row.deductionsAmount),
    finalPayableAmount: n(row.finalPayableAmount),
    advanceAmount: n(row.advanceAmount),
    tdsAmount: n(row.tdsAmount),
    balanceAmount,
    paidAmount,
    outstandingBalance,
    currency: row.currency,
    podVerifiedAt: row.podVerifiedAt,
    deadlineAt: row.deadlineAt,
    slaBreachedAt: row.slaBreachedAt,
    escalatedAt: row.escalatedAt,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    paymentMode: row.paymentMode,
    paymentDetails: row.paymentDetails,
    processingRemarks: row.processingRemarks,
    voucherNumber: row.voucherNumber,
    voucherFile: row.voucherFile,
    processedAt: row.processedAt,
    processedBy: row.processedBy,
    slaBreached,
    slaRemainingMs: slaBreached ? 0 : Math.max(0, deadlineMs - now),
    trip: row.trip
      ? {
          id: row.trip.id,
          lrNumber: row.trip.lrNumber,
          route: `${row.trip.routeFrom} → ${row.trip.routeTo}`,
          routeFrom: row.trip.routeFrom,
          routeTo: row.trip.routeTo,
          status: row.trip.status,
          vendorRate: n(row.trip.vendorRate),
          podVerifiedAt: row.trip.podVerifiedAt,
          tripClosedAt: row.trip.tripClosedAt,
          charges: row.trip.charges.map((c) => ({
            id: c.id,
            chargeType: c.chargeType,
            amount: n(c.amount),
            description: c.description,
          })),
        }
      : null,
    vendor: row.vendor,
    indent: row.indent,
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: n(p.amount),
      paidAt: p.paidAt,
      paymentMode: p.paymentMode,
      utrReference: p.utrReference,
      chequeNumber: p.chequeNumber,
      remarks: p.remarks,
      recordedBy: p.recordedBy,
      proof: p.proofFile
        ? { id: p.proofFile.id, url: p.proofFile.url, fileName: p.proofFile.fileName }
        : null,
      createdAt: p.createdAt,
    })),
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
    createdAt: row.createdAt,
  };
}

async function storeBalancePaymentProof(
  paymentId: string,
  file: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer },
  uploadedById?: string | null
) {
  const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `vendor-balance-payment/${paymentId}/${Date.now()}-${safeName}`;
  const { url } = await putObject(key, file.buffer);

  const stored = await prisma.storedFile.create({
    data: {
      fileName: file.fileName,
      mimeType: file.mimeType ?? null,
      sizeBytes: file.sizeBytes,
      storageKey: key,
      url,
      uploadedById: uploadedById ?? null,
    },
  });

  await prisma.documentAttachment.create({
    data: {
      fileId: stored.id,
      entityType: "VENDOR_BALANCE_PAYMENT",
      entityId: paymentId,
      documentType: "PAYMENT_PROOF",
      title: file.fileName,
    },
  });

  return stored.id;
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  taskId: string,
  input: {
    action: string;
    actorId?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    amount?: number | null;
    remarks?: string | null;
  }
) {
  await tx.vendorBalancePaymentEvent.create({
    data: {
      taskId,
      action: input.action,
      actorId: input.actorId ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      amount: input.amount ?? null,
      remarks: input.remarks ?? null,
    },
  });
}

async function notifyTripCreator(body: string, entityId: string, indentId?: string | null) {
  if (!indentId) return;
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    select: {
      createdById: true,
      createdBy: { select: { id: true, phone: true, email: true, teamId: true } },
    },
  });
  const creator = indent?.createdBy;
  if (!creator) return;

  const { deliverNow } = await import("../notify");
  const recipients = new Set<string>();
  const creatorTo = creator.phone ?? creator.email;
  if (creatorTo) recipients.add(creatorTo);

  if (creator.teamId) {
    const teammates = await prisma.user.findMany({
      where: { isActive: true, teamId: creator.teamId },
      select: { id: true, phone: true, email: true },
    });
    for (const u of teammates) {
      const teammateTo = u.phone ?? u.email;
      if (teammateTo) recipients.add(teammateTo);
    }
  }

  for (const to of Array.from(recipients)) {
    await deliverNow({
      channel: "WHATSAPP",
      to,
      body,
      entityType: "VENDOR_BALANCE_PAYMENT",
      entityId,
    });
  }
}

async function canUserViewTask(
  user: SessionUser | null | undefined,
  task: { indent?: { createdById: string | null; createdBy?: { teamId: string | null } | null } | null }
): Promise<boolean> {
  if (!user?.id) return false;
  if (["SUPER_ADMIN", "ADMIN", "FINANCE"].includes(user.role ?? "")) return true;
  const { hasPermission } = await import("./permission.service");
  if (await hasPermission(user.id, "payment.view")) return true;
  const createdById = task.indent?.createdById;
  const creatorTeamId = task.indent?.createdBy?.teamId;
  if (createdById && createdById === user.id) return true;
  if (creatorTeamId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { teamId: true },
    });
    if (dbUser?.teamId && creatorTeamId === dbUser.teamId) return true;
  }
  return false;
}

/**
 * Ensure a balance payment task exists when POD is verified and cash is still owed.
 * Repairs trips where the task was never created (e.g. POD before advance was paid).
 */
export async function ensureBalancePaymentTaskForTrip(tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      podVerifiedAt: true,
      indentId: true,
      vendorId: true,
      balancePaymentTask: { select: { id: true, status: true, paidAmount: true } },
    },
  });
  if (!trip?.podVerifiedAt || !trip.vendorId) return null;
  if (trip.balancePaymentTask?.status === "PROCESSED") return null;

  const { syncVendorTripPayableFromTrip, buildVendorPayableAmounts } = await import(
    "./authoritative-vendor-payable.service"
  );

  if (trip.balancePaymentTask) {
    await syncVendorTripPayableFromTrip(tripId, {
      balancePaymentTaskId: trip.balancePaymentTask.id,
      recordAdjustment: false,
    });
    await syncBalancePaymentTaskFromPayable(tripId);
    return prisma.vendorBalancePaymentTask.findUnique({
      where: { id: trip.balancePaymentTask.id },
      include: taskInclude,
    });
  }

  const snap = await buildVendorPayableAmounts(tripId);
  if (!snap) return null;

  const outstanding = balanceOutstandingAmount({
    balanceAmount: snap.balanceAmount,
    paidAmount: snap.balancePaidAmount,
  });
  if (outstanding <= 0.009) return null;

  return createBalancePaymentTaskOnPodVerification(trip.id, trip.podVerifiedAt, trip.indentId);
}

/** Backfill balance payment tasks for POD-verified trips missing an open task. */
export async function syncOpenBalancePaymentTasks(limit = 400) {
  const trips = await prisma.trip.findMany({
    where: {
      podVerifiedAt: { not: null },
      OR: [
        { balancePaymentTask: null },
        {
          balancePaymentTask: {
            status: { in: [...ACTIVE_BALANCE_PAYMENT_STATUSES] },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: { podVerifiedAt: "desc" },
    take: limit,
  });

  for (const trip of trips) {
    await ensureBalancePaymentTaskForTrip(trip.id);
  }
}

/** Align balance payment task amounts with VendorTripPayable (e.g. after a financial note). */
export async function syncBalancePaymentTaskFromPayable(tripId: string) {
  const payable = await prisma.vendorTripPayable.findUnique({ where: { tripId } });
  if (!payable) return null;

  const task = await prisma.vendorBalancePaymentTask.findUnique({ where: { tripId } });
  if (!task || task.status === "PROCESSED") return null;

  const paidAmount = n(task.paidAmount);
  const balanceAmount = n(payable.balanceAmount);
  const outstanding = Math.max(0, Math.round((balanceAmount - paidAmount) * 100) / 100);

  let statusPatch: { status: string; processedAt?: Date } | Record<string, never> = {};
  if (paidAmount > 0 && outstanding <= 0 && canBalancePaymentTransition(task.status, "PROCESSED")) {
    statusPatch = { status: "PROCESSED", processedAt: new Date() };
  } else if (paidAmount > 0 && outstanding > 0 && canBalancePaymentTransition(task.status, "PARTIALLY_PAID")) {
    statusPatch = { status: "PARTIALLY_PAID" };
  }

  return prisma.vendorBalancePaymentTask.update({
    where: { id: task.id },
    data: {
      freightAmount: n(payable.freightAmount),
      additionalChargesAmount: n(payable.additionalChargesAmount),
      deductionsAmount: n(payable.deductionsAmount),
      finalPayableAmount: n(payable.finalPayableAmount),
      advanceAmount: n(payable.advanceAppliedAmount),
      tdsAmount: n(payable.tdsAmount),
      balanceAmount,
      ...statusPatch,
    },
  });
}

/** Create vendor balance payment task when POD is verified. */
export async function createBalancePaymentTaskOnPodVerification(
  tripId: string,
  podVerifiedAt: Date,
  indentId?: string | null
) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      vendorId: true,
      indentId: true,
      lrNumber: true,
      indent: { select: { indentNumber: true } },
    },
  });
  if (!trip) return null;

  const existing = await prisma.vendorBalancePaymentTask.findUnique({ where: { tripId } });
  if (existing?.status === "PROCESSED") {
    return mapTask(
      await prisma.vendorBalancePaymentTask.findFirst({
        where: { id: existing.id },
        include: taskInclude,
      })
    );
  }

  const { syncVendorTripPayableFromTrip, buildVendorPayableAmounts } = await import(
    "./authoritative-vendor-payable.service"
  );

  if (existing) {
    await syncVendorTripPayableFromTrip(tripId, {
      balancePaymentTaskId: existing.id,
      recordAdjustment: false,
    });
    await syncBalancePaymentTaskFromPayable(tripId);
    const row = await prisma.vendorBalancePaymentTask.findFirst({
      where: { id: existing.id },
      include: taskInclude,
    });
    return mapTask(row);
  }

  const snap = await buildVendorPayableAmounts(tripId);
  if (!snap) return null;

  const outstanding = balanceOutstandingAmount({
    balanceAmount: snap.balanceAmount,
    paidAmount: snap.balancePaidAmount,
  });
  if (outstanding <= 0.009) return null;

  const deadlineAt = new Date(podVerifiedAt.getTime() + BALANCE_PAYMENT_SLA_MS);
  const resolvedIndentId = indentId ?? trip.indentId;

  const task = await prisma.vendorBalancePaymentTask.create({
    data: {
      tripId,
      vendorId: trip.vendorId,
      indentId: resolvedIndentId,
      podVerifiedAt,
      deadlineAt,
      status: "PENDING_REVIEW",
      freightAmount: snap.freightAmount,
      additionalChargesAmount: snap.additionalChargesAmount,
      deductionsAmount: snap.deductionsAmount,
      finalPayableAmount: snap.finalPayableAmount,
      advanceAmount: snap.advanceAppliedAmount,
      tdsAmount: snap.tdsAmount,
      balanceAmount: snap.balanceAmount,
      paidAmount: snap.balancePaidAmount,
    },
    include: taskInclude,
  });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "BALANCE_PAYMENT_PENDING",
    severity: "WARNING",
    title: `Vendor balance due — ${trip.lrNumber}`,
    description: `POD verified. Vendor balance of ₹${snap.balanceAmount} due within 96 hours.`,
    indentId: resolvedIndentId,
    relatedEntityId: task.id,
    dueAt: deadlineAt,
    targetTeamCode: "FINANCE",
  });

  const { registerSlaTask } = await import("./sla.service");
  const { SLA_TYPES } = await import("../sla-types");
  await registerSlaTask({
    type: SLA_TYPES.BALANCE_PAYMENT,
    entityId: task.id,
    startAt: podVerifiedAt,
    deadlineAt,
    tripId,
    indentId: resolvedIndentId,
  });

  const { notifyFinanceUsers } = await import("./sla-notify.service");
  const notifyBody = `POD verified for trip ${trip.lrNumber}. Vendor balance ₹${snap.balanceAmount} due within 96 hours.`;
  await notifyFinanceUsers(notifyBody, "VENDOR_BALANCE_PAYMENT", task.id);
  await notifyTripCreator(notifyBody, task.id, resolvedIndentId);

  await syncVendorTripPayableFromTrip(tripId, {
    balancePaymentTaskId: task.id,
    commercialApprovalStatus: "PENDING_REVIEW",
    reason: "Balance payable opened on POD verification",
  });

  return mapTask(task);
}

/** Escalate balance payment tasks not processed within 96 hours of POD verification. */
export async function escalateOverdueBalancePayments() {
  const now = new Date();
  const overdue = await prisma.vendorBalancePaymentTask.findMany({
    where: {
      status: { in: ["PENDING_REVIEW", "APPROVED"] },
      deadlineAt: { lt: now },
      escalatedAt: null,
    },
    include: {
      trip: { select: { lrNumber: true } },
      vendor: { select: { name: true } },
      indent: { select: { indentNumber: true, id: true } },
    },
  });

  for (const task of overdue) {
    await prisma.$transaction(async (tx) => {
      assertBalancePaymentTransition(task.status, "SLA_BREACHED");
      await tx.vendorBalancePaymentTask.update({
        where: { id: task.id },
        data: { status: "SLA_BREACHED", slaBreachedAt: now, escalatedAt: now },
      });
      await recordEvent(tx, task.id, {
        action: "SLA_BREACHED",
        fromStatus: task.status,
        toStatus: "SLA_BREACHED",
        amount: n(task.balanceAmount),
        remarks: "96-hour SLA exceeded",
      });
    });

    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "BALANCE_PAYMENT_SLA_BREACHED",
      severity: "CRITICAL",
      title: `Vendor balance SLA breached — ${task.trip.lrNumber}`,
      description: `Balance payment of ₹${n(task.balanceAmount)} not processed within 96 hours for ${task.vendor.name}.`,
      indentId: task.indentId,
      relatedEntityId: task.id,
      dueAt: task.deadlineAt,
    });

    const { notifyAdminUsers, notifyFinanceUsers } = await import("./sla-notify.service");
    await notifyFinanceUsers(
      `Vendor balance SLA breached: trip ${task.trip.lrNumber} (${task.vendor.name}) — ₹${n(task.balanceAmount)} requires attention.`,
      "VENDOR_BALANCE_PAYMENT",
      task.id
    );
    await notifyAdminUsers(
      `Vendor balance SLA breached: trip ${task.trip.lrNumber} (${task.vendor.name}) — ₹${n(task.balanceAmount)} requires admin attention.`,
      "VENDOR_BALANCE_PAYMENT",
      task.id
    );

    const { markSlaTaskBreached } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    await markSlaTaskBreached(SLA_TYPES.BALANCE_PAYMENT, task.id, now);

    await logAudit({
      action: AUDIT_ACTIONS.BALANCE_PAYMENT_SLA_BREACHED,
      entity: "VendorBalancePaymentTask",
      entityId: task.id,
      tripId: task.tripId,
      meta: {
        lrNumber: task.trip.lrNumber,
        vendorName: task.vendor.name,
        balanceAmount: n(task.balanceAmount),
        indentNumber: task.indent?.indentNumber,
      },
    });
  }

  return overdue.length;
}

export async function listBalancePaymentTasks(
  filters?: {
    status?: string;
    slaBreachedOnly?: boolean;
    tripId?: string;
    limit?: number;
  },
  user?: SessionUser | null
) {
  await syncOpenBalancePaymentTasks();

  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.BALANCE_PAYMENT]);

  const statusFilter = filters?.slaBreachedOnly
    ? "SLA_BREACHED"
    : filters?.status ?? {
        in: ["PENDING_REVIEW", "APPROVED", "PROCESSING", "PARTIALLY_PAID", "SLA_BREACHED"],
      };

  const rows = await prisma.vendorBalancePaymentTask.findMany({
    where: {
      status: statusFilter,
      ...(filters?.tripId ? { tripId: filters.tripId } : {}),
    },
    orderBy: [{ status: "desc" }, { deadlineAt: "asc" }],
    take: filters?.limit ?? 500,
    include: taskInclude,
  });

  const mapped = await Promise.all(
    rows.map(async (r) => {
      const task = mapTask(r)!;
      const financialNotes = await loadVendorFinancialNotesForTrip(r.tripId);
      return { ...task, financialNotes };
    })
  );
  if (!user || ["SUPER_ADMIN", "ADMIN", "FINANCE"].includes(user.role ?? "")) {
    return mapped;
  }
  const visible: (typeof mapped)[number][] = [];
  for (const t of mapped) {
    if (await canUserViewTask(user, t)) visible.push(t);
  }
  return visible;
}

export async function getBalancePaymentTaskById(id: string, user?: SessionUser | null) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.BALANCE_PAYMENT]);
  const row = await prisma.vendorBalancePaymentTask.findFirst({
    where: { id },
    include: taskInclude,
  });
  const mapped = await finalizeBalancePaymentTask(row, { syncFromPayable: true });
  if (!mapped) return null;
  if (user && !(await canUserViewTask(user, mapped))) return null;
  return mapped;
}

export async function getBalancePaymentTaskByTripId(tripId: string, user?: SessionUser | null) {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.BALANCE_PAYMENT]);
  const row = await prisma.vendorBalancePaymentTask.findUnique({
    where: { tripId },
    include: taskInclude,
  });
  const mapped = await finalizeBalancePaymentTask(row, { syncFromPayable: true });
  if (!mapped) return null;
  if (user && !(await canUserViewTask(user, mapped))) return null;
  return mapped;
}

/** Finance reviews and approves vendor balance payable. */
export async function approveBalancePayable(id: string, actor?: SessionUser | null, remarks?: string | null) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({ where: { id } });
  if (!task) return null;
  if (!["PENDING_REVIEW", "SLA_BREACHED"].includes(task.status)) {
    throw new Error(`Cannot approve balance payable in status ${task.status}`);
  }

  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    assertBalancePaymentTransition(task.status, "APPROVED");
    const updated = await tx.vendorBalancePaymentTask.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: now,
        approvedById: actor?.id ?? null,
        processingRemarks: remarks ?? task.processingRemarks,
      },
      include: taskInclude,
    });
    await recordEvent(tx, id, {
      action: "PAYABLE_APPROVED",
      actorId: actor?.id ?? null,
      fromStatus: task.status,
      toStatus: "APPROVED",
      amount: n(task.balanceAmount),
      remarks: remarks ?? null,
    });
    return updated;
  });

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.BALANCE_PAYMENT_APPROVED,
    entity: "VendorBalancePaymentTask",
    entityId: id,
    tripId: task.tripId,
    before: { status: task.status },
    after: { status: "APPROVED" },
  });

  const { markVendorTripPayableCommercialApproved } = await import(
    "./authoritative-vendor-payable.service"
  );
  await markVendorTripPayableCommercialApproved(task.tripId, actor?.id ?? null, now);

  return mapTask(row);
}

/** Finance starts processing vendor balance payment. */
export async function processBalancePayment(
  id: string,
  data: { paymentMode?: string | null; paymentDetails?: string | null; remarks?: string | null },
  actor?: SessionUser | null
) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({ where: { id } });
  if (!task) return null;
  if (!["APPROVED", "SLA_BREACHED", "PARTIALLY_PAID"].includes(task.status)) {
    throw new Error(`Cannot process balance payment in status ${task.status}`);
  }

  const row = await prisma.$transaction(async (tx) => {
    assertBalancePaymentTransition(task.status, "PROCESSING");
    const updated = await tx.vendorBalancePaymentTask.update({
      where: { id },
      data: {
        status: "PROCESSING",
        paymentMode: data.paymentMode ?? task.paymentMode,
        paymentDetails: data.paymentDetails ?? task.paymentDetails,
        processingRemarks: data.remarks ?? task.processingRemarks,
      },
      include: taskInclude,
    });
    await recordEvent(tx, id, {
      action: "PAYMENT_INITIATED",
      actorId: actor?.id ?? null,
      fromStatus: task.status,
      toStatus: "PROCESSING",
      amount: n(task.balanceAmount) - n(task.paidAmount),
      remarks: data.remarks ?? null,
    });
    return updated;
  });

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.BALANCE_PAYMENT_INITIATED,
    entity: "VendorBalancePaymentTask",
    entityId: id,
    tripId: task.tripId,
    before: { status: task.status },
    after: { status: "PROCESSING" },
  });

  return mapTask(row);
}

/** Record a vendor balance payment (supports partial payments). */
export async function recordBalancePayment(
  id: string,
  data: {
    amount: number;
    paidAt: string | Date;
    paymentMode: string;
    utrReference?: string | null;
    chequeNumber?: string | null;
    remarks?: string | null;
  },
  actor?: SessionUser | null,
  proof?: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null,
  options?: { gatewaySettlement?: boolean }
) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({ where: { id } });
  if (!task) return null;
  if (!["PROCESSING", "APPROVED", "PARTIALLY_PAID"].includes(task.status)) {
    throw new Error("Balance payment must be approved and in processing before recording payment");
  }
  if (data.amount <= 0) throw new Error("Amount must be greater than zero");

  const paidAt = new Date(data.paidAt);
  if (Number.isNaN(paidAt.getTime())) throw new Error("Invalid payment date");

  if (data.utrReference) {
    const dup = await prisma.vendorBalancePayment.findFirst({
      where: { taskId: id, utrReference: data.utrReference },
    });
    if (dup) throw new Error("A payment with this UTR/reference already exists for this balance task");
  }

  const outstanding = Math.max(0, n(task.balanceAmount) - n(task.paidAmount));
  if (data.amount > outstanding + 0.01) {
    throw new Error(`Amount exceeds outstanding balance of ₹${outstanding}`);
  }

  const validationError = validatePaymentFields(
    {
      paymentMode: data.paymentMode,
      utrReference: data.utrReference,
      chequeNumber: data.chequeNumber,
      hasProof: Boolean(proof),
    },
    { requireProof: !options?.gatewaySettlement, referenceField: "utrReference" }
  );
  if (validationError) throw new Error(validationError);

  const now = new Date();
  const priorPaidAmount = n(task.paidAmount);

  const settlement = await prisma.$transaction(async (tx) => {
    const locked = await tx.vendorBalancePaymentTask.findUnique({ where: { id } });
    if (!locked) throw new Error("Balance payment task not found");
    const lockedPaid = n(locked.paidAmount);
    if (lockedPaid !== priorPaidAmount) {
      throw new Error("Concurrent balance payment in progress — refresh and try again");
    }
    const lockedOutstanding = Math.max(0, n(locked.balanceAmount) - lockedPaid);
    if (data.amount > lockedOutstanding + 0.01) {
      throw new Error(`Amount exceeds outstanding balance of ₹${lockedOutstanding}`);
    }
    const lockedNewPaid = Math.round((lockedPaid + data.amount) * 100) / 100;
    const lockedFullyPaid = lockedNewPaid >= n(locked.balanceAmount);
    const lockedNextStatus = lockedFullyPaid ? "PROCESSED" : "PARTIALLY_PAID";

    const created = await tx.vendorBalancePayment.create({
      data: {
        taskId: id,
        amount: data.amount,
        paidAt,
        paymentMode: data.paymentMode,
        utrReference: data.utrReference ?? null,
        chequeNumber: data.chequeNumber ?? null,
        remarks: data.remarks ?? null,
        recordedById: actor?.id ?? null,
      },
    });

    const updatedCount = await tx.vendorBalancePaymentTask.updateMany({
      where: { id, paidAmount: locked.paidAmount },
      data: {
        status: lockedNextStatus,
        paidAmount: lockedNewPaid,
        processedAt: lockedFullyPaid ? now : locked.processedAt,
        processedById: lockedFullyPaid ? (actor?.id ?? null) : locked.processedById,
        paymentMode: data.paymentMode,
        paymentDetails: data.utrReference ?? data.chequeNumber ?? locked.paymentDetails,
      },
    });
    if (updatedCount.count === 0) {
      throw new Error("Concurrent balance payment in progress — refresh and try again");
    }

    await tx.vendorTripPayable.updateMany({
      where: { tripId: locked.tripId },
      data: { balancePaidAmount: lockedNewPaid },
    });

    await recordEvent(tx, id, {
      action: lockedFullyPaid ? "PAYMENT_PROCESSED" : "PARTIAL_PAYMENT_RECORDED",
      actorId: actor?.id ?? null,
      fromStatus: task.status,
      toStatus: lockedNextStatus,
      amount: data.amount,
      remarks: data.remarks ?? null,
    });

    if (lockedFullyPaid) {
      await tx.importantEvent.updateMany({
        where: {
          type: { in: ["BALANCE_PAYMENT_PENDING", "BALANCE_PAYMENT_SLA_BREACHED"] },
          relatedEntityId: id,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        data: { status: "RESOLVED", resolvedAt: now, resolvedById: actor?.id ?? null },
      });
    }

    return {
      payment: created,
      newPaid: lockedNewPaid,
      fullyPaid: lockedFullyPaid,
      nextStatus: lockedNextStatus,
      balanceAmount: n(locked.balanceAmount),
    };
  });

  const { payment, newPaid, fullyPaid, nextStatus, balanceAmount } = settlement;

  if (proof) {
    const proofFileId = await storeBalancePaymentProof(payment.id, proof, actor?.id);
    await prisma.vendorBalancePayment.update({
      where: { id: payment.id },
      data: { proofFileId },
    });
  }

  const { generateAndStoreBalanceVoucher } = await import("./balance-voucher.service");
  await generateAndStoreBalanceVoucher(
    id,
    {
      amount: data.amount,
      paidAt,
      paymentMode: data.paymentMode,
      utrReference: data.utrReference,
      chequeNumber: data.chequeNumber,
    },
    actor?.name
  );

  const trip = await prisma.trip.findFirst({
    where: { id: task.tripId },
    select: { lrNumber: true, vendor: { select: { phone: true, whatsapp: true } } },
  });
  const { deliverNow } = await import("../notify");
  const vendorTo = trip?.vendor.whatsapp ?? trip?.vendor.phone;
  if (vendorTo) {
    await deliverNow({
      channel: "WHATSAPP",
      to: vendorTo,
      body: `Balance payment of ₹${data.amount} recorded for trip ${trip?.lrNumber}. ${fullyPaid ? "Settlement complete." : `Outstanding: ₹${Math.round((balanceAmount - newPaid) * 100) / 100}`}`,
      entityType: "VENDOR_BALANCE_PAYMENT",
      entityId: id,
    });
  }

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.PROCESSED_BALANCE_PAYMENT,
    entity: "VendorBalancePaymentTask",
    entityId: id,
    tripId: task.tripId,
    meta: { amount: data.amount, status: nextStatus },
    before: { status: task.status, paidAmount: n(task.paidAmount) },
    after: { status: nextStatus, paidAmount: newPaid },
  });

  if (fullyPaid) {
    const { resolveSlaTask } = await import("./sla.service");
    const { SLA_TYPES } = await import("../sla-types");
    await resolveSlaTask(SLA_TYPES.BALANCE_PAYMENT, id);
  }

  const { recordBalanceInVendorLedger } = await import("./vendor-payment.service");
  await recordBalanceInVendorLedger(payment.id, actor, {
    skipCashJournal: Boolean(options?.gatewaySettlement),
  });

  return getBalancePaymentTaskById(id, actor);
}

/** @deprecated Use recordBalancePayment */
export async function markBalancePaymentProcessed(
  id: string,
  data: {
    paymentMode?: string | null;
    paymentDetails?: string | null;
    remarks?: string | null;
  },
  actor?: SessionUser | null
) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({ where: { id } });
  if (!task) return null;
  const outstanding = Math.max(0, n(task.balanceAmount) - n(task.paidAmount));
  return recordBalancePayment(
    id,
    {
      amount: outstanding,
      paidAt: new Date(),
      paymentMode: data.paymentMode ?? task.paymentMode ?? "Bank Transfer",
      utrReference: data.paymentDetails,
      remarks: data.remarks,
    },
    actor
  );
}

export async function countPendingBalancePayments() {
  const { runSlaEscalations } = await import("./sla-escalation.service");
  const { SLA_TYPES } = await import("../sla-types");
  await runSlaEscalations([SLA_TYPES.BALANCE_PAYMENT]);
  return prisma.vendorBalancePaymentTask.count({
    where: {
      status: {
        in: ["PENDING_REVIEW", "APPROVED", "PROCESSING", "PARTIALLY_PAID", "SLA_BREACHED"],
      },
    },
  });
}
