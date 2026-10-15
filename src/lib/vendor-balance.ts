import {
  resolveIndentAdvanceAmount,
  resolveTripVendorAdvance,
  tripAdvanceSummarySelect,
  type TripAdvanceRequestRow,
} from "./advance";
import { VENDOR_TDS_RATE } from "./constants";

type Decimalish = { toNumber(): number } | number | null | undefined;

type TripChargeRow = {
  chargeType: string;
  amount: Decimalish;
};

type TripFinancialSource = {
  vendorRate: Decimalish;
  advanceRequests?: TripAdvanceRequestRow[];
  charges?: TripChargeRow[];
  indent?: {
    advanceStatus?: string | null;
    advanceApproved?: Decimalish;
    advanceRequested?: Decimalish;
    payments?: { paymentType?: string; amount: { toNumber(): number } }[];
  } | null;
};

function n(v: Decimalish): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

/** Resolved advance paid to vendor for a trip (processed AdvanceRequest, else legacy indent advance). */
export function resolveTripAdvanceAmount(trip: TripFinancialSource): number {
  const tripAdvance = resolveTripVendorAdvance(trip.advanceRequests);
  if (tripAdvance?.paidAmount != null && tripAdvance.paidAmount > 0) {
    return tripAdvance.paidAmount;
  }
  if (trip.indent) {
    const indentAdvance = resolveIndentAdvanceAmount(trip.indent as Parameters<typeof resolveIndentAdvanceAmount>[0]);
    if (indentAdvance != null) return indentAdvance;
  }
  return 0;
}

export function sumTripCharges(charges: TripChargeRow[] | undefined) {
  let additionalCharges = 0;
  let deductions = 0;
  for (const c of charges ?? []) {
    const amount = n(c.amount);
    if (c.chargeType === "DEDUCTION") deductions += amount;
    else additionalCharges += amount;
  }
  return { additionalCharges, deductions };
}

/** TDS withheld on vendor freight when VendorCommercial.tdsApplicable is true. */
export function computeVendorTdsAmount(freightAmount: number, tdsApplicable: boolean): number {
  if (!tdsApplicable || freightAmount <= 0) return 0;
  return Math.round(freightAmount * VENDOR_TDS_RATE * 100) / 100;
}

/**
 * Vendor balance payable:
 * finalPayable = freight + additionalCharges - deductions - tds
 * balanceAmount = finalPayable - advanceAmount
 */
export function computeVendorBalance(input: {
  vendorRate: number;
  advanceAmount: number;
  additionalCharges?: number;
  deductions?: number;
  tdsAmount?: number;
}) {
  const freightAmount = input.vendorRate;
  const additionalChargesAmount = input.additionalCharges ?? 0;
  const deductionsAmount = input.deductions ?? 0;
  const tdsAmount = input.tdsAmount ?? 0;
  const finalPayableAmount =
    freightAmount + additionalChargesAmount - deductionsAmount - tdsAmount;
  const balanceAmount = finalPayableAmount - input.advanceAmount;
  return {
    freightAmount,
    additionalChargesAmount,
    deductionsAmount,
    finalPayableAmount,
    advanceAmount: input.advanceAmount,
    tdsAmount,
    balanceAmount,
  };
}

/** Load trip financial inputs and compute remaining vendor balance. */
export async function computeTripVendorBalance(tripId: string) {
  const { prisma } = await import("./prisma");
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      vendorRate: true,
      vendor: { select: { commercial: { select: { tdsApplicable: true } } } },
      advanceRequests: {
        select: tripAdvanceSummarySelect,
        orderBy: { createdAt: "desc" },
      },
      charges: { select: { chargeType: true, amount: true } },
      indent: {
        select: {
          advanceStatus: true,
          advanceApproved: true,
          advanceRequested: true,
          payments: { select: { paymentType: true, amount: true } },
        },
      },
      vendorPayments: {
        where: { status: "PAID", paymentType: { in: ["ADVANCE", "BALANCE"] } },
        select: { paymentType: true, sourceType: true, netPayable: true },
      },
    },
  });
  if (!trip) return null;

  const manualAdvance = trip.vendorPayments
    .filter((p) => p.paymentType === "ADVANCE" && p.sourceType === "MANUAL")
    .reduce((s, p) => s + n(p.netPayable), 0);
  const manualBalancePaid = trip.vendorPayments
    .filter((p) => p.paymentType === "BALANCE" && p.sourceType === "MANUAL")
    .reduce((s, p) => s + n(p.netPayable), 0);
  const workflowAdvance = resolveTripAdvanceAmount(trip);
  const hasWorkflowLedgerAdvance = trip.vendorPayments.some(
    (p) => p.paymentType === "ADVANCE" && p.sourceType === "ADVANCE_REQUEST"
  );
  // Never deduct the same advance via workflow + manual ledger rows.
  const advanceAmount = hasWorkflowLedgerAdvance ? workflowAdvance : workflowAdvance + manualAdvance;
  const { additionalCharges, deductions } = sumTripCharges(trip.charges);
  const freightAmount = n(trip.vendorRate);
  const tdsAmount = computeVendorTdsAmount(
    freightAmount,
    trip.vendor.commercial?.tdsApplicable ?? false
  );
  return {
    ...computeVendorBalance({
      vendorRate: freightAmount,
      advanceAmount,
      additionalCharges,
      deductions,
      tdsAmount,
    }),
    manualBalancePaid,
  };
}
