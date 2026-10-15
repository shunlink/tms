import {
  detailedAgeingBucketForDays,
  type DetailedAgeingBuckets,
  type AgeingBucketFilter,
} from "./receivables";

export type { DetailedAgeingBuckets, AgeingBucketFilter };

/** Advance statuses where the amount is committed and only payment remains. */
export const COMMITTED_ADVANCE_STATUSES = ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING"] as const;

export type PayableDisplayStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "ACTION_REQUIRED"
  | "SLA_BREACHED";

export type PayableTypeFilter = "ADVANCE" | "BALANCE";

/**
 * Commercial payable ageing anchor — when the obligation is recognized, not the payment SLA.
 * Balance: POD verification date (post-delivery settlement becomes due).
 * Advance: approval/acceptance date (committed advance awaiting payout).
 */
export const PAYABLE_AGEING_LABEL = "Ageing from POD verification or advance approval";

export type PayableAgeingInput = {
  vendorName: string;
  tripLr: string;
  outstanding: number;
  ageingAnchor: Date;
  payableType: "ADVANCE" | "BALANCE" | "LEDGER";
};

export type PayableAgeingRow = {
  vendor: string;
  tripLr: string;
  outstanding: number;
  days: number;
  payableType: "ADVANCE" | "BALANCE" | "LEDGER";
};

/** Days since commercial payable recognition date. */
export function vendorPayableAgeingDays(ageingAnchor: Date, nowMs = Date.now()): number {
  return Math.floor((nowMs - ageingAnchor.getTime()) / (24 * 60 * 60 * 1000));
}

export function resolveAdvanceAgeingAnchor(advance: {
  approvedAt?: Date | null;
  vendorAcceptedAt?: Date | null;
  requestedAt: Date;
}): Date {
  return advance.approvedAt ?? advance.vendorAcceptedAt ?? advance.requestedAt;
}

export function resolveAdvanceApprovedAmount(advance: {
  approvedAmount?: number | null;
  negotiatedAmount?: number | null;
  requestedAmount: number;
}): number {
  return advance.approvedAmount ?? advance.negotiatedAmount ?? advance.requestedAmount;
}

export function advanceOutstandingAmount(advance: {
  approvedAmount?: number | null;
  negotiatedAmount?: number | null;
  requestedAmount: number;
  paidAmount?: number | null;
}): number {
  const approved = resolveAdvanceApprovedAmount(advance);
  const paid = advance.paidAmount ?? 0;
  return Math.max(0, approved - paid);
}

export function balanceOutstandingAmount(task: {
  balanceAmount: number;
  paidAmount?: number | null;
}): number {
  return Math.max(0, task.balanceAmount - (task.paidAmount ?? 0));
}

export function buildPayableAgeingRows(
  inputs: PayableAgeingInput[],
  nowMs = Date.now()
): PayableAgeingRow[] {
  const rows: PayableAgeingRow[] = [];
  for (const input of inputs) {
    if (input.outstanding <= 0) continue;
    const days = vendorPayableAgeingDays(input.ageingAnchor, nowMs);
    rows.push({
      vendor: input.vendorName,
      tripLr: input.tripLr,
      outstanding: input.outstanding,
      days,
      payableType: input.payableType,
    });
  }
  rows.sort((a, b) => b.days - a.days);
  return rows;
}

export function splitPayableAgeingBuckets(rows: PayableAgeingRow[]): DetailedAgeingBuckets {
  const buckets: DetailedAgeingBuckets = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
  };
  for (const row of rows) {
    const bucket = detailedAgeingBucketForDays(row.days);
    if (bucket === "overdue") continue;
    buckets[bucket] += row.outstanding;
  }
  for (const key of Object.keys(buckets) as (keyof DetailedAgeingBuckets)[]) {
    buckets[key] = Math.round(buckets[key] * 100) / 100;
  }
  return buckets;
}

export function derivePayableDisplayStatus(input: {
  balanceOutstanding: number;
  advanceOutstanding: number;
  balancePaid: number;
  advancePaid: number;
  hasSlaBreached: boolean;
  hasPendingAction: boolean;
}): PayableDisplayStatus {
  const totalOutstanding = input.balanceOutstanding + input.advanceOutstanding;
  if (totalOutstanding <= 0) return "UNPAID";
  if (input.hasSlaBreached) return "SLA_BREACHED";
  if (input.hasPendingAction) return "ACTION_REQUIRED";
  if (input.balancePaid > 0 || input.advancePaid > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}

export function isBalanceActionRequired(status: string): boolean {
  return ["PENDING_REVIEW", "APPROVED", "SLA_BREACHED"].includes(status);
}

export function isAdvanceActionRequired(status: string): boolean {
  return ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING", "SLA_BREACHED"].includes(status);
}

export type PayablesSummaryInput = PayableAgeingInput & {
  vendorId: string;
  advanceOutstanding: number;
  balanceOutstanding: number;
  ledgerOutstanding: number;
  tdsAmount: number;
  hasSlaBreached: boolean;
  hasPendingAction: boolean;
};

export function buildPayablesSummary(inputs: PayablesSummaryInput[], nowMs = Date.now()) {
  const ageingRows = buildPayableAgeingRows(inputs, nowMs);
  const buckets = splitPayableAgeingBuckets(ageingRows);

  let totalOutstanding = 0;
  let advancesOutstanding = 0;
  let balancePending = 0;
  let dueActionRequired = 0;
  let tdsToWithhold = 0;
  const vendorIds = new Set<string>();

  for (const input of inputs) {
    if (input.outstanding <= 0) continue;
    totalOutstanding += input.outstanding;
    advancesOutstanding += input.advanceOutstanding;
    balancePending += input.balanceOutstanding + input.ledgerOutstanding;
    tdsToWithhold += input.tdsAmount;
    vendorIds.add(input.vendorId);
    if (input.hasSlaBreached || input.hasPendingAction) {
      dueActionRequired += input.outstanding;
    }
  }

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    advancesOutstanding: Math.round(advancesOutstanding * 100) / 100,
    balancePending: Math.round(balancePending * 100) / 100,
    dueActionRequired: Math.round(dueActionRequired * 100) / 100,
    tdsToWithhold: Math.round(tdsToWithhold * 100) / 100,
    vendorsWithOutstanding: vendorIds.size,
    buckets,
    ageingLabel: PAYABLE_AGEING_LABEL,
  };
}
