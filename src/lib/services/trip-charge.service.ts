import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import type { SessionUser } from "../auth";
import { computeTripVendorBalance } from "../vendor-balance";
import { canBalancePaymentTransition } from "../balance-payment-states";

export const TRIP_CHARGE_TYPES = ["DETENTION", "DEDUCTION", "OTHER"] as const;
export type TripChargeType = (typeof TRIP_CHARGE_TYPES)[number];

function n(v: { toNumber(): number } | number): number {
  return typeof v === "number" ? v : v.toNumber();
}

export async function listTripCharges(tripId: string) {
  const rows = await prisma.tripCharge.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    tripId: r.tripId,
    chargeType: r.chargeType,
    amount: n(r.amount),
    description: r.description,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

export async function createTripCharge(
  tripId: string,
  input: { chargeType: TripChargeType; amount: number; description?: string | null },
  actor?: SessionUser | null
) {
  if (input.amount <= 0) throw new Error("Amount must be greater than zero");
  if (!TRIP_CHARGE_TYPES.includes(input.chargeType)) {
    throw new Error("Invalid charge type");
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { id: true, balancePaymentTask: { select: { id: true, status: true } } },
  });
  if (!trip) throw new Error("Trip not found");
  if (trip.balancePaymentTask?.status === "PROCESSED") {
    throw new Error("Cannot add charges after balance payment is completed");
  }

  const charge = await prisma.tripCharge.create({
    data: {
      tripId,
      chargeType: input.chargeType,
      amount: input.amount,
      description: input.description ?? null,
      createdById: actor?.id ?? null,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  await syncBalanceTaskAmounts(tripId);

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.TRIP_CHARGE_ADDED,
    entity: "TripCharge",
    entityId: charge.id,
    tripId,
    meta: { chargeType: input.chargeType, amount: input.amount },
  });

  return {
    id: charge.id,
    tripId: charge.tripId,
    chargeType: charge.chargeType,
    amount: n(charge.amount),
    description: charge.description,
    createdBy: charge.createdBy,
    createdAt: charge.createdAt,
  };
}

export async function deleteTripCharge(chargeId: string, actor?: SessionUser | null) {
  const charge = await prisma.tripCharge.findFirst({ where: { id: chargeId } });
  if (!charge) return null;

  const task = await prisma.vendorBalancePaymentTask.findUnique({
    where: { tripId: charge.tripId },
    select: { status: true },
  });
  if (task?.status === "PROCESSED") {
    throw new Error("Cannot remove charges after balance payment is completed");
  }

  await prisma.tripCharge.delete({ where: { id: chargeId } });
  await syncBalanceTaskAmounts(charge.tripId);

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.TRIP_CHARGE_REMOVED,
    entity: "TripCharge",
    entityId: chargeId,
    tripId: charge.tripId,
  });

  return true;
}

/** Recalculate vendor balance task amounts from trip data. */
export async function syncBalanceTaskAmounts(tripId: string) {
  const balance = await computeTripVendorBalance(tripId);
  if (!balance) return null;

  const task = await prisma.vendorBalancePaymentTask.findUnique({ where: { tripId } });
  if (!task || task.status === "PROCESSED") return null;

  const paidAmount = n(task.paidAmount);
  const outstanding = Math.max(0, Math.round((balance.balanceAmount - paidAmount) * 100) / 100);

  let statusPatch: { status: string; processedAt?: Date } | Record<string, never> = {};
  if (paidAmount > 0 && outstanding <= 0 && canBalancePaymentTransition(task.status, "PROCESSED")) {
    statusPatch = { status: "PROCESSED", processedAt: new Date() };
  } else if (paidAmount > 0 && outstanding > 0 && canBalancePaymentTransition(task.status, "PARTIALLY_PAID")) {
    statusPatch = { status: "PARTIALLY_PAID" };
  }

  const updated = await prisma.vendorBalancePaymentTask.update({
    where: { id: task.id },
    data: {
      freightAmount: balance.freightAmount,
      additionalChargesAmount: balance.additionalChargesAmount,
      deductionsAmount: balance.deductionsAmount,
      finalPayableAmount: balance.finalPayableAmount,
      advanceAmount: balance.advanceAmount,
      tdsAmount: balance.tdsAmount,
      balanceAmount: balance.balanceAmount,
      ...statusPatch,
    },
  });

  const { syncVendorTripPayableFromTrip } = await import("./authoritative-vendor-payable.service");
  await syncVendorTripPayableFromTrip(tripId, {
    adjustmentType: "CHARGE_CHANGE",
    reason: "Trip charges changed — balance recalculated",
    recordAdjustment: true,
  });

  return updated;
}
