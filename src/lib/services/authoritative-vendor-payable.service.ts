/**
 * Authoritative vendor payables (Phase 1)
 *
 * Ownership:
 * - Advance obligation: AdvanceRequest (committed statuses) — not duplicated here.
 * - Balance commercial amounts: VendorTripPayable (this module), synced from trip data + issued vendor notes.
 * - Balance workflow / SLA: VendorBalancePaymentTask (operational snapshot; must match payable).
 * - Cash / settlement history: VendorPayment (idempotent sourceId) + VendorBalancePayment rows.
 *
 * Reads for finance dashboards should use getAuthoritativeTripPayable() or computeOutstandingVendorPayables().
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  balanceOutstandingAmount,
  advanceOutstandingAmount,
  COMMITTED_ADVANCE_STATUSES,
} from "../payables";
import { computeTripVendorBalance, computeVendorBalance } from "../vendor-balance";
import { round2 } from "../finance-reconciliation";
import { managedAdvanceSourceFilter } from "../constants";

type Decimalish = { toNumber(): number } | number | null | undefined;
const n = (v: Decimalish) => {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
};

export type PayableAmountSnapshot = {
  freightAmount: number;
  additionalChargesAmount: number;
  deductionsAmount: number;
  tdsAmount: number;
  finalPayableAmount: number;
  advanceAppliedAmount: number;
  balanceAmount: number;
  balancePaidAmount: number;
};

export type AuthoritativeTripPayable = PayableAmountSnapshot & {
  tripId: string;
  vendorId: string;
  indentId: string | null;
  currency: string;
  commercialApprovalStatus: string;
  balancePaymentTaskId: string | null;
  balanceTaskStatus: string | null;
  /** Outstanding balance cash still owed (authority: payable.balanceAmount − balancePaid). */
  balanceOutstanding: number;
  /** Committed advance not yet paid (from AdvanceRequest). */
  advanceOutstanding: number;
  /** Sum of balance + advance outstanding (excludes pending manual ledger). */
  vendorOutstanding: number;
  source: "PAYABLE_RECORD" | "LIVE_COMPUTE";
};

export function snapshotFromComputedBalance(
  balance: ReturnType<typeof computeVendorBalance> & { manualBalancePaid?: number },
  balancePaidAmount = balance.manualBalancePaid ?? 0
): PayableAmountSnapshot {
  return {
    freightAmount: balance.freightAmount,
    additionalChargesAmount: balance.additionalChargesAmount,
    deductionsAmount: balance.deductionsAmount,
    tdsAmount: balance.tdsAmount,
    finalPayableAmount: balance.finalPayableAmount,
    advanceAppliedAmount: balance.advanceAmount,
    balanceAmount: balance.balanceAmount,
    balancePaidAmount,
  };
}

export function snapshotFromPayableRow(row: {
  freightAmount: Decimalish;
  additionalChargesAmount: Decimalish;
  deductionsAmount: Decimalish;
  tdsAmount: Decimalish;
  finalPayableAmount: Decimalish;
  advanceAppliedAmount: Decimalish;
  balanceAmount: Decimalish;
  balancePaidAmount: Decimalish;
}): PayableAmountSnapshot {
  return {
    freightAmount: n(row.freightAmount),
    additionalChargesAmount: n(row.additionalChargesAmount),
    deductionsAmount: n(row.deductionsAmount),
    tdsAmount: n(row.tdsAmount),
    finalPayableAmount: n(row.finalPayableAmount),
    advanceAppliedAmount: n(row.advanceAppliedAmount),
    balanceAmount: n(row.balanceAmount),
    balancePaidAmount: n(row.balancePaidAmount),
  };
}

function snapshotsEqual(a: PayableAmountSnapshot, b: PayableAmountSnapshot): boolean {
  const keys = Object.keys(a) as (keyof PayableAmountSnapshot)[];
  return keys.every((k) => Math.abs(a[k] - b[k]) < 0.01);
}

type TripLiveBalance = {
  freightAmount: number;
  additionalChargesAmount: number;
  deductionsAmount: number;
  advanceAmount: number;
  tdsAmount: number;
  manualBalancePaid?: number;
};

/** Sum issued vendor note deltas (trip charges are excluded — merged separately). */
export function mergeVendorPayableWithIssuedNotes(
  live: TripLiveBalance,
  notes: { businessPurpose: string; totalAmount: Decimalish }[]
): PayableAmountSnapshot {
  let noteAdditional = 0;
  let noteDeductions = 0;
  for (const note of notes) {
    const amount = n(note.totalAmount);
    if (note.businessPurpose === "VENDOR_FREIGHT_INCREASE") noteAdditional += amount;
    else if (note.businessPurpose === "VENDOR_FREIGHT_REDUCTION") noteDeductions += amount;
  }
  const additionalChargesAmount = round2(live.additionalChargesAmount + noteAdditional);
  const deductionsAmount = round2(live.deductionsAmount + noteDeductions);
  const computed = computeVendorBalance({
    vendorRate: live.freightAmount,
    advanceAmount: live.advanceAmount,
    additionalCharges: additionalChargesAmount,
    deductions: deductionsAmount,
    tdsAmount: live.tdsAmount,
  });
  const balancePaidAmount = live.manualBalancePaid ?? 0;
  return snapshotFromComputedBalance({ ...computed, manualBalancePaid: balancePaidAmount }, balancePaidAmount);
}

/** Trip rate/charges/advance plus issued vendor financial notes (authoritative payable amounts). */
export async function buildVendorPayableAmounts(
  tripId: string,
  balancePaidAmount?: number
): Promise<PayableAmountSnapshot | null> {
  const live = await computeTripVendorBalance(tripId);
  if (!live) return null;

  const notes = await prisma.financialNote.findMany({
    where: {
      tripId,
      counterpartyType: "VENDOR",
      status: "ISSUED",
      payableEffect: "APPLY_TO_SUBLEDGER",
    },
    select: { businessPurpose: true, totalAmount: true },
  });

  const paid = balancePaidAmount ?? live.manualBalancePaid ?? 0;
  return mergeVendorPayableWithIssuedNotes({ ...live, manualBalancePaid: paid }, notes);
}

async function loadAdvanceOutstanding(tripId: string): Promise<number> {
  const advances = await prisma.advanceRequest.findMany({
    where: {
      tripId,
      ...managedAdvanceSourceFilter(),
      status: { in: [...COMMITTED_ADVANCE_STATUSES] },
    },
    select: {
      approvedAmount: true,
      negotiatedAmount: true,
      requestedAmount: true,
      paidAmount: true,
    },
  });
  return advances.reduce(
    (s, a) =>
      s +
      advanceOutstandingAmount({
        approvedAmount: n(a.approvedAmount),
        negotiatedAmount: n(a.negotiatedAmount),
        requestedAmount: n(a.requestedAmount),
        paidAmount: n(a.paidAmount),
      }),
    0
  );
}

export async function getAuthoritativeTripPayable(tripId: string): Promise<AuthoritativeTripPayable | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      vendorId: true,
      indentId: true,
      vendorTripPayable: true,
      balancePaymentTask: { select: { id: true, status: true, paidAmount: true } },
    },
  });
  if (!trip) return null;

  const advanceOutstanding = await loadAdvanceOutstanding(tripId);
  const payable = trip.vendorTripPayable;

  if (payable) {
    const snap = snapshotFromPayableRow(payable);
    const balanceOutstanding = balanceOutstandingAmount({
      balanceAmount: snap.balanceAmount,
      paidAmount: snap.balancePaidAmount,
    });
    return {
      tripId: trip.id,
      vendorId: trip.vendorId,
      indentId: trip.indentId,
      currency: payable.currency,
      commercialApprovalStatus: payable.commercialApprovalStatus,
      balancePaymentTaskId: payable.balancePaymentTaskId,
      balanceTaskStatus: trip.balancePaymentTask?.status ?? null,
      ...snap,
      balanceOutstanding,
      advanceOutstanding: round2(advanceOutstanding),
      vendorOutstanding: round2(balanceOutstanding + advanceOutstanding),
      source: "PAYABLE_RECORD",
    };
  }

  const live = await computeTripVendorBalance(tripId);
  if (!live) return null;
  const snap = snapshotFromComputedBalance(live, live.manualBalancePaid ?? 0);
  const balanceOutstanding = balanceOutstandingAmount({
    balanceAmount: snap.balanceAmount,
    paidAmount: snap.balancePaidAmount,
  });
  return {
    tripId: trip.id,
    vendorId: trip.vendorId,
    indentId: trip.indentId,
    currency: "INR",
    commercialApprovalStatus: "DRAFT",
    balancePaymentTaskId: trip.balancePaymentTask?.id ?? null,
    balanceTaskStatus: trip.balancePaymentTask?.status ?? null,
    ...snap,
    balanceOutstanding,
    advanceOutstanding: round2(advanceOutstanding),
    vendorOutstanding: round2(balanceOutstanding + advanceOutstanding),
    source: "LIVE_COMPUTE",
  };
}

type SyncContext = {
  balancePaymentTaskId?: string | null;
  commercialApprovalStatus?: string;
  commercialApprovedAt?: Date | null;
  commercialApprovedById?: string | null;
  adjustmentType?: string;
  reason?: string | null;
  tripChargeId?: string | null;
  createdById?: string | null;
  recordAdjustment?: boolean;
};

/** Upsert VendorTripPayable from live trip financials (POD task creation, charge changes). */
export async function syncVendorTripPayableFromTrip(tripId: string, ctx: SyncContext = {}) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      vendorId: true,
      indentId: true,
      vendorTripPayable: true,
      balancePaymentTask: { select: { id: true, status: true, paidAmount: true } },
    },
  });
  if (!trip) return null;

  const taskPaid = n(trip.balancePaymentTask?.paidAmount);
  const snap = await buildVendorPayableAmounts(
    tripId,
    taskPaid > 0 ? taskPaid : undefined
  );
  if (!snap) return null;

  const existing = trip.vendorTripPayable;
  const taskId = ctx.balancePaymentTaskId ?? trip.balancePaymentTask?.id ?? existing?.balancePaymentTaskId;

  const approvalStatus =
    ctx.commercialApprovalStatus ??
    existing?.commercialApprovalStatus ??
    (trip.balancePaymentTask?.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "DRAFT");

  const data = {
    vendorId: trip.vendorId,
    indentId: trip.indentId,
    ...snap,
    currency: existing?.currency ?? "INR",
    commercialApprovalStatus: approvalStatus,
    commercialApprovedAt: ctx.commercialApprovedAt ?? existing?.commercialApprovedAt ?? null,
    commercialApprovedById: ctx.commercialApprovedById ?? existing?.commercialApprovedById ?? null,
    balancePaymentTaskId: taskId ?? null,
  };

  return prisma.$transaction(async (tx) => {
    let payable;
    if (existing) {
      const previous = snapshotFromPayableRow(existing);
      const amountsChanged = !snapshotsEqual(previous, snap);
      const frozen = existing.commercialApprovalStatus === "APPROVED";

      if (frozen && amountsChanged && ctx.recordAdjustment !== false) {
        await tx.vendorTripPayableAdjustment.create({
          data: {
            payableId: existing.id,
            adjustmentType: ctx.adjustmentType ?? "RECALCULATION",
            status: "APPLIED",
            previousAmounts: previous,
            newAmounts: snap,
            reason: ctx.reason ?? "Trip financial recalculation",
            tripChargeId: ctx.tripChargeId ?? null,
            createdById: ctx.createdById ?? null,
          },
        });
      }

      payable = await tx.vendorTripPayable.update({
        where: { id: existing.id },
        data,
      });
    } else {
      payable = await tx.vendorTripPayable.create({
        data: {
          tripId: trip.id,
          ...data,
        },
      });
    }
    return payable;
  });
}

export async function markVendorTripPayableCommercialApproved(
  tripId: string,
  actorId?: string | null,
  approvedAt = new Date()
) {
  const live = await computeTripVendorBalance(tripId);
  if (!live) return null;

  const payable = await syncVendorTripPayableFromTrip(tripId, {
    commercialApprovalStatus: "APPROVED",
    commercialApprovedAt: approvedAt,
    commercialApprovedById: actorId ?? null,
    adjustmentType: "COMMERCIAL_APPROVED",
    reason: "Balance payable approved by Finance",
    recordAdjustment: true,
  });

  const { safePostVendorTripPayableAccrualJournal } = await import("../accounting/operational-posting.service");
  await safePostVendorTripPayableAccrualJournal(tripId, actorId);

  return payable;
}

export async function updateVendorTripPayablePaidAmount(tripId: string, balancePaidAmount: number) {
  const existing = await prisma.vendorTripPayable.findUnique({ where: { tripId } });
  if (!existing) {
    await syncVendorTripPayableFromTrip(tripId);
  }
  return prisma.vendorTripPayable.update({
    where: { tripId },
    data: { balancePaidAmount },
  });
}

export type PayableReconciliationIssue = {
  tripId: string;
  lrNumber?: string;
  kind: string;
  message: string;
  expected?: number;
  actual?: number;
};

/** Compare authoritative payable, balance task snapshot, and live recomputation. */
export async function reconcileTripPayable(tripId: string): Promise<PayableReconciliationIssue[]> {
  const issues: PayableReconciliationIssue[] = [];
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      lrNumber: true,
      vendorTripPayable: true,
      balancePaymentTask: true,
    },
  });
  if (!trip) return issues;

  const authoritative = await buildVendorPayableAmounts(tripId);
  const auth = await getAuthoritativeTripPayable(tripId);
  const task = trip.balancePaymentTask;

  if (task && authoritative) {
    const taskBalance = n(task.balanceAmount);
    const expectedBalance = authoritative.balanceAmount;
    if (Math.abs(taskBalance - expectedBalance) > 0.01 && task.status !== "PROCESSED") {
      issues.push({
        tripId,
        lrNumber: trip.lrNumber,
        kind: "TASK_VS_LIVE",
        message: "Balance task balanceAmount differs from authoritative payable",
        expected: expectedBalance,
        actual: taskBalance,
      });
    }
    const taskPaid = n(task.paidAmount);
    const payablePaid = n(trip.vendorTripPayable?.balancePaidAmount);
    if (trip.vendorTripPayable && Math.abs(taskPaid - payablePaid) > 0.01) {
      issues.push({
        tripId,
        lrNumber: trip.lrNumber,
        kind: "PAYABLE_VS_TASK_PAID",
        message: "VendorTripPayable.balancePaidAmount differs from task.paidAmount",
        expected: taskPaid,
        actual: payablePaid,
      });
    }
  }

  if (trip.vendorTripPayable && authoritative && auth) {
    if (Math.abs(auth.balanceAmount - authoritative.balanceAmount) > 0.01) {
      issues.push({
        tripId,
        lrNumber: trip.lrNumber,
        kind: "PAYABLE_VS_LIVE",
        message: "Stored payable balance differs from trip + notes recalculation",
        expected: authoritative.balanceAmount,
        actual: auth.balanceAmount,
      });
    }
  }

  return issues;
}

export async function reconcileAllVendorTripPayables(limit = 500): Promise<PayableReconciliationIssue[]> {
  const trips = await prisma.trip.findMany({
    where: {
      OR: [{ vendorTripPayable: { isNot: null } }, { balancePaymentTask: { isNot: null } }],
    },
    select: { id: true },
    take: limit,
  });

  const all: PayableReconciliationIssue[] = [];
  for (const t of trips) {
    const issues = await reconcileTripPayable(t.id);
    all.push(...issues);
  }
  return all;
}
