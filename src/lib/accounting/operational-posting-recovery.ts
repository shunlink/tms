import { rupeesToMinor } from "../payments/money";
import { sumJournalSides } from "./posting-validation";
import type { VendorPayableAccrualContext } from "./posting-rules";
import { buildVendorPayableAccrualLines } from "./posting-rules";

/** Embedded in VendorBalancePayment.remarks by gateway settlement for stable GL dedup. */
export const GATEWAY_OUTBOUND_REMARK_PREFIX = "gateway:outbound:";

export function formatGatewayBalancePaymentRemarks(outboundPaymentId: string): string {
  return `${GATEWAY_OUTBOUND_REMARK_PREFIX}${outboundPaymentId}`;
}

export function parseGatewayOutboundIdFromRemarks(remarks: string | null | undefined): string | null {
  if (!remarks) return null;
  if (!remarks.startsWith(GATEWAY_OUTBOUND_REMARK_PREFIX)) return null;
  const id = remarks.slice(GATEWAY_OUTBOUND_REMARK_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export type OperationalPostingKind =
  | "VENDOR_PAYMENT"
  | "CLIENT_PAYMENT"
  | "VENDOR_TRIP_PAYABLE_ACCRUAL"
  | "CLIENT_INVOICE_ACCRUAL";

export type OperationalPostingGap = {
  kind: OperationalPostingKind;
  sourceId: string;
  reference: string;
  detail?: string;
};

export type StaleAccrualFinding = {
  payableId: string;
  tripId: string;
  expectedMinor: number;
  postedExpenseMinor: number;
  message: string;
};

function n(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

/** Compare posted accrual journal to current payable snapshot (does not mutate data). */
export function detectStaleVendorPayableAccrual(input: {
  payable: {
    id: string;
    tripId: string;
    finalPayableAmount: { toNumber(): number } | number;
    advanceAppliedAmount: { toNumber(): number } | number;
    vendorId: string;
    indentId?: string | null;
  };
  postedLines: { accountCode: string; debitMinor: number; creditMinor: number }[];
}): StaleAccrualFinding | null {
  const ctx: VendorPayableAccrualContext = {
    payableId: input.payable.id,
    finalPayableMinor: rupeesToMinor(n(input.payable.finalPayableAmount)),
    advanceAppliedMinor: rupeesToMinor(n(input.payable.advanceAppliedAmount)),
    vendorId: input.payable.vendorId,
    tripId: input.payable.tripId,
    indentId: input.payable.indentId,
  };
  if (ctx.finalPayableMinor <= 0) return null;

  const expectedLines = buildVendorPayableAccrualLines(ctx);
  const expectedExpense = expectedLines
    .filter((l) => l.accountCode === "5100")
    .reduce((s, l) => s + (l.debitMinor ?? 0), 0);

  const postedExpense = input.postedLines
    .filter((l) => l.accountCode === "5100")
    .reduce((s, l) => s + l.debitMinor, 0);

  if (expectedExpense === postedExpense) return null;

  return {
    payableId: input.payable.id,
    tripId: input.payable.tripId,
    expectedMinor: expectedExpense,
    postedExpenseMinor: postedExpense,
    message: `Payable accrual journal expense ${postedExpense} minor ≠ current payable ${expectedExpense} minor — correction requires reversal/adjustment note`,
  };
}

export function journalLinesBalanced(lines: { debitMinor: number; creditMinor: number }[]): boolean {
  const sides = sumJournalSides(lines);
  return sides.debitMinor === sides.creditMinor && sides.debitMinor > 0;
}
