/**
 * Shared finance reconciliation helpers — single formulas for vendor, customer,
 * margin, and cross-module validation. No new payment/ledger models.
 */
import { invoiceOutstanding } from "./invoice-payment";
import {
  advanceOutstandingAmount,
  balanceOutstandingAmount,
  resolveAdvanceApprovedAmount,
} from "./payables";
import { computeVendorBalance, computeVendorTdsAmount } from "./vendor-balance";
import { balanceTaskCountsTowardOutstanding } from "./services/vendor-payables.service";

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export type VendorSettlementInput = {
  freight: number;
  additionalCharges?: number;
  deductions?: number;
  tdsAmount?: number;
  /** Approved advance commitment (for advance outstanding). */
  advanceApproved?: number;
  advancePaid?: number;
  /** Post-advance balance obligation (finalPayable − advancePaid). */
  balanceAmount?: number;
  balancePaid?: number;
};

export type VendorSettlementResult = {
  grossPayable: number;
  finalPayable: number;
  advanceOutstanding: number;
  balanceOutstanding: number;
  vendorOutstanding: number;
};

/** grossPayable = freight + charges − deductions; finalPayable = gross − TDS. */
export function computeGrossPayable(
  freight: number,
  additionalCharges = 0,
  deductions = 0
): number {
  return round2(freight + additionalCharges - deductions);
}

/** advanceOutstanding + balanceOutstanding (never negative components). */
export function computeVendorOutstanding(
  advanceOutstanding: number,
  balanceOutstanding: number
): number {
  return round2(Math.max(0, advanceOutstanding) + Math.max(0, balanceOutstanding));
}

/**
 * Vendor settlement from freight/charges/TDS and paid amounts.
 * When balanceAmount is omitted, derives it from finalPayable − advancePaid.
 */
export function computeVendorSettlement(input: VendorSettlementInput): VendorSettlementResult {
  const freight = input.freight;
  const additionalCharges = input.additionalCharges ?? 0;
  const deductions = input.deductions ?? 0;
  const tdsAmount = input.tdsAmount ?? 0;
  const advancePaid = input.advancePaid ?? 0;

  const grossPayable = computeGrossPayable(freight, additionalCharges, deductions);
  const finalPayable = round2(grossPayable - tdsAmount);

  const advanceApproved = input.advanceApproved ?? advancePaid;
  const advanceOutstanding = advanceOutstandingAmount({
    approvedAmount: advanceApproved,
    requestedAmount: advanceApproved,
    paidAmount: advancePaid,
  });

  const balanceAmount =
    input.balanceAmount != null ? input.balanceAmount : round2(finalPayable - advancePaid);
  const balancePaid = input.balancePaid ?? 0;
  const balanceOutstanding = balanceOutstandingAmount({
    balanceAmount,
    paidAmount: balancePaid,
  });

  return {
    grossPayable,
    finalPayable,
    advanceOutstanding,
    balanceOutstanding,
    vendorOutstanding: computeVendorOutstanding(advanceOutstanding, balanceOutstanding),
  };
}

/** Live vendor settlement when no balance task snapshot exists. */
export function computeLiveVendorSettlement(input: {
  vendorRate: number;
  additionalCharges?: number;
  deductions?: number;
  tdsApplicable: boolean;
  advancePaid: number;
  advanceApproved?: number;
}): VendorSettlementResult {
  const tdsAmount = computeVendorTdsAmount(input.vendorRate, input.tdsApplicable);
  const balance = computeVendorBalance({
    vendorRate: input.vendorRate,
    advanceAmount: input.advancePaid,
    additionalCharges: input.additionalCharges,
    deductions: input.deductions,
    tdsAmount,
  });

  const advanceApproved = input.advanceApproved ?? input.advancePaid;
  const advanceOutstanding = advanceOutstandingAmount({
    approvedAmount: advanceApproved,
    requestedAmount: advanceApproved,
    paidAmount: input.advancePaid,
  });

  const balanceOutstanding = balanceOutstandingAmount({
    balanceAmount: balance.balanceAmount,
    paidAmount: 0,
  });

  return {
    grossPayable: computeGrossPayable(
      input.vendorRate,
      input.additionalCharges,
      input.deductions
    ),
    finalPayable: balance.finalPayableAmount,
    advanceOutstanding,
    balanceOutstanding,
    vendorOutstanding: computeVendorOutstanding(advanceOutstanding, balanceOutstanding),
  };
}

/**
 * Allocate invoice-level collections to a single trip line (multi-trip invoices).
 * Proportional to line amount; never exceeds line amount or invoice paid total.
 */
export function allocateTripInvoicePayment(
  lineAmount: number,
  invoiceTotal: number,
  invoicePaid: number
): { invoiceAmount: number; collected: number; outstanding: number } {
  if (lineAmount <= 0) {
    return { invoiceAmount: 0, collected: 0, outstanding: 0 };
  }
  const collected =
    invoiceTotal > 0
      ? round2(Math.min(lineAmount, (invoicePaid / invoiceTotal) * lineAmount))
      : 0;
  const outstanding = Math.max(0, round2(lineAmount - collected));
  return { invoiceAmount: lineAmount, collected, outstanding };
}

export type TripCustomerSettlementInput = {
  lineAmount: number | null;
  invoiceTotal: number | null;
  invoicePaid: number | null;
  invoicePayable: boolean;
  tripClientPayments: number;
};

export function computeTripCustomerSettlement(
  input: TripCustomerSettlementInput
): { invoiceAmount: number; collected: number; outstanding: number } {
  if (input.invoicePayable && input.lineAmount != null && input.invoiceTotal != null) {
    return allocateTripInvoicePayment(
      input.lineAmount,
      input.invoiceTotal,
      input.invoicePaid ?? 0
    );
  }
  const collected = input.tripClientPayments;
  return { invoiceAmount: 0, collected, outstanding: 0 };
}

/** Expected booking margin from trip rate snapshots. */
export function computeExpectedMargin(sellRate: number, buyRate: number) {
  const expectedMargin = round2(sellRate - buyRate);
  const expectedMarginPercent =
    sellRate > 0 ? round2((expectedMargin / sellRate) * 100) : 0;
  return { expectedMargin, expectedMarginPercent };
}

/**
 * Settlement/accrual margin when finalized invoice revenue and vendor final payable are known.
 * Returns null when prerequisites are missing — never invent a number.
 */
export function computeSettlementMargin(
  tripInvoiceAmount: number | null,
  finalPayable: number | null,
  invoiceFinalized: boolean,
  vendorSettlementKnown: boolean
): number | null {
  if (!invoiceFinalized || !vendorSettlementKnown) return null;
  if (tripInvoiceAmount == null || finalPayable == null) return null;
  return round2(tripInvoiceAmount - finalPayable);
}

/** Backward-compatible alias for settlement/accrual margin. */
export const computeAccruedMargin = computeSettlementMargin;

/** Cash margin = customer collections − vendor cash paid (not accounting profit). */
export function computeCashMargin(customerCollected: number, vendorPaidCash: number): number {
  return round2(customerCollected - vendorPaidCash);
}

export function resolveAdvanceApproved(input: {
  approvedAmount?: number | null;
  negotiatedAmount?: number | null;
  requestedAmount: number;
}): number {
  return resolveAdvanceApprovedAmount({
    approvedAmount: input.approvedAmount,
    negotiatedAmount: input.negotiatedAmount,
    requestedAmount: input.requestedAmount,
  });
}

export type ReconciliationCheck = {
  ok: boolean;
  message?: string;
};

/** Validate vendor outstanding matches advance + balance components. */
export function reconcileVendorOutstanding(parts: {
  advanceOutstanding: number;
  balanceOutstanding: number;
  vendorOutstanding: number;
}): ReconciliationCheck {
  const expected = computeVendorOutstanding(parts.advanceOutstanding, parts.balanceOutstanding);
  const ok = Math.abs(expected - parts.vendorOutstanding) < 0.01;
  return ok
    ? { ok: true }
    : {
        ok: false,
        message: `Vendor outstanding mismatch: expected ${expected}, got ${parts.vendorOutstanding}`,
      };
}

/** Validate invoice outstanding from total − paid. */
export function reconcileInvoiceOutstanding(
  totalAmount: number,
  paidAmount: number,
  reportedOutstanding: number
): ReconciliationCheck {
  const expected = Math.max(0, invoiceOutstanding(totalAmount, paidAmount));
  const ok = Math.abs(expected - reportedOutstanding) < 0.01;
  return ok
    ? { ok: true }
    : {
        ok: false,
        message: `Invoice outstanding mismatch: expected ${expected}, got ${reportedOutstanding}`,
      };
}

/** System payables total must match sumOutstandingVendorPayables inputs. */
export function reconcilePayablesTotal(
  balanceTasks: {
    balanceAmount: number;
    paidAmount: number;
    status?: string;
    commercialApprovalStatus?: string | null;
  }[],
  advances: {
    approvedAmount?: number;
    negotiatedAmount?: number;
    requestedAmount?: number;
    paidAmount?: number;
  }[],
  pendingLedgerTotal: number,
  reportedTotal: number
): ReconciliationCheck {
  const balanceOutstanding = balanceTasks.reduce((s, t) => {
    if (!balanceTaskCountsTowardOutstanding(t)) return s;
    return s + Math.max(0, round2(t.balanceAmount - t.paidAmount));
  }, 0);
  const advanceOutstanding = advances.reduce((s, a) => {
    const approved = resolveAdvanceApprovedAmount({
      approvedAmount: a.approvedAmount,
      negotiatedAmount: a.negotiatedAmount,
      requestedAmount: a.requestedAmount ?? 0,
    });
    const paid = a.paidAmount ?? 0;
    return s + Math.max(0, approved - paid);
  }, 0);
  const expected = round2(balanceOutstanding + advanceOutstanding + pendingLedgerTotal);
  const ok = Math.abs(expected - reportedTotal) < 0.01;
  return ok
    ? { ok: true }
    : {
        ok: false,
        message: `Payables total mismatch: expected ${expected}, got ${reportedTotal}`,
      };
}
