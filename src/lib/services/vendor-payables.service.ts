import { prisma } from "../prisma";
import {
  ACTIVE_BALANCE_PAYMENT_STATUSES,
  OUTSTANDING_BALANCE_PAYMENT_STATUSES,
} from "../balance-payment-states";
import { managedAdvanceSourceFilter } from "../constants";

type Decimalish = { toNumber(): number } | number | null | undefined;
const n = (v: Decimalish) => {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
};

/** Advance statuses where the amount is committed and only payment remains. */
const COMMITTED_ADVANCE_STATUSES = ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING"];

type OutstandingPayablesInput = {
  balanceTasks: {
    balanceAmount: Decimalish;
    paidAmount: Decimalish;
    status?: string;
    commercialApprovalStatus?: string | null;
  }[];
  advances: {
    approvedAmount?: Decimalish;
    negotiatedAmount?: Decimalish;
    requestedAmount?: Decimalish;
    paidAmount?: Decimalish;
  }[];
  pendingLedgerTotal: number;
};

/**
 * Sum vendor payables from commitments and unpaid ledger entries only.
 * Uses task.paidAmount (VendorBalancePayment totals), not PAID VendorPayment rows,
 * so balance workflow payouts are never double-counted with the ledger.
 */
export function balanceTaskCountsTowardOutstanding(task: {
  status?: string;
  commercialApprovalStatus?: string | null;
}): boolean {
  if (task.commercialApprovalStatus === "APPROVED") return true;
  const status = task.status ?? "";
  return OUTSTANDING_BALANCE_PAYMENT_STATUSES.includes(
    status as (typeof OUTSTANDING_BALANCE_PAYMENT_STATUSES)[number]
  );
}

export function sumOutstandingVendorPayables(input: OutstandingPayablesInput): number {
  const balanceOutstanding = input.balanceTasks.reduce((s, t) => {
    if (!balanceTaskCountsTowardOutstanding(t)) return s;
    return s + Math.max(0, n(t.balanceAmount) - n(t.paidAmount));
  }, 0);
  const advanceCommitted = input.advances.reduce((s, a) => {
    const approved = n(a.approvedAmount ?? a.negotiatedAmount ?? a.requestedAmount);
    const paid = n(a.paidAmount);
    return s + Math.max(0, approved - paid);
  }, 0);
  return Math.round((balanceOutstanding + advanceCommitted + input.pendingLedgerTotal) * 100) / 100;
}

/**
 * Money ShunLink currently owes vendors: outstanding post-POD balances, committed
 * advances not yet paid, and unpaid manual ledger entries. Paid cash (VendorPayment
 * with status PAID) is excluded; balance tasks track partial payments via paidAmount.
 */
export async function computeOutstandingVendorPayables(vendorId?: string) {
  const scope = vendorId ? { vendorId } : {};
  const [balanceTasks, advances, ledger] = await Promise.all([
    prisma.vendorBalancePaymentTask.findMany({
      where: { ...scope, status: { in: ACTIVE_BALANCE_PAYMENT_STATUSES } },
      select: {
        balanceAmount: true,
        paidAmount: true,
        status: true,
        vendorTripPayable: { select: { commercialApprovalStatus: true } },
      },
    }),
    prisma.advanceRequest.findMany({
      where: { ...scope, ...managedAdvanceSourceFilter(), status: { in: COMMITTED_ADVANCE_STATUSES } },
      select: {
        approvedAmount: true,
        negotiatedAmount: true,
        requestedAmount: true,
        paidAmount: true,
      },
    }),
    prisma.vendorPayment.aggregate({
      where: { ...scope, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { netPayable: true },
    }),
  ]);

  return sumOutstandingVendorPayables({
    balanceTasks: balanceTasks.map((t) => ({
      balanceAmount: t.balanceAmount,
      paidAmount: t.paidAmount,
      status: t.status,
      commercialApprovalStatus: t.vendorTripPayable?.commercialApprovalStatus ?? null,
    })),
    advances,
    pendingLedgerTotal: n(ledger._sum.netPayable),
  });
}
