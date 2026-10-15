import { describe, expect, it } from "vitest";
import { VENDOR_TDS_RATE } from "./constants";
import {
  computeVendorBalance,
  computeVendorTdsAmount,
  resolveTripAdvanceAmount,
  sumTripCharges,
} from "./vendor-balance";

describe("resolveTripAdvanceAmount", () => {
  it("sums processed advance requests using paidAmount", () => {
    const amount = resolveTripAdvanceAmount({
      vendorRate: 100000,
      advanceRequests: [
        { source: "SHUNLINK", status: "PROCESSED", approvedAmount: 30000, paidAmount: 30000 },
        { source: "SHUNLINK", status: "PROCESSED", approvedAmount: 20000, paidAmount: 20000 },
      ],
    });
    expect(amount).toBe(50000);
  });

  it("falls back to indent advance when no processed requests", () => {
    const amount = resolveTripAdvanceAmount({
      vendorRate: 100000,
      advanceRequests: [],
      indent: {
        advanceStatus: "PAID",
        payments: [{ paymentType: "ADVANCE", amount: { toNumber: () => 40000 } }],
      },
    });
    expect(amount).toBe(40000);
  });
});

describe("sumTripCharges", () => {
  it("separates detention and deductions", () => {
    const result = sumTripCharges([
      { chargeType: "DETENTION", amount: 5000 },
      { chargeType: "DEDUCTION", amount: 2000 },
    ]);
    expect(result).toEqual({ additionalCharges: 5000, deductions: 2000 });
  });
});

describe("computeVendorBalance", () => {
  it("matches the full payable formula with detention and deductions", () => {
    const result = computeVendorBalance({
      vendorRate: 80000,
      advanceAmount: 25000,
      additionalCharges: 5000,
      deductions: 2000,
      tdsAmount: 0,
    });
    expect(result).toEqual({
      freightAmount: 80000,
      additionalChargesAmount: 5000,
      deductionsAmount: 2000,
      finalPayableAmount: 83000,
      advanceAmount: 25000,
      tdsAmount: 0,
      balanceAmount: 58000,
    });
  });

  it("matches vendor payment net payable formula without charges", () => {
    const result = computeVendorBalance({
      vendorRate: 100000,
      advanceAmount: 40000,
      tdsAmount: 1000,
    });
    expect(result.balanceAmount).toBe(59000);
  });

  it("withholds configured TDS from freight only when vendor is TDS-applicable", () => {
    const freight = 100000;
    const tdsAmount = computeVendorTdsAmount(freight, true);
    expect(VENDOR_TDS_RATE).toBe(0.02);
    expect(tdsAmount).toBe(2000);

    const result = computeVendorBalance({
      vendorRate: freight,
      advanceAmount: 40000,
      tdsAmount,
    });
    expect(result.tdsAmount).toBe(2000);
    expect(result.finalPayableAmount).toBe(98000);
    expect(result.balanceAmount).toBe(58000);
  });

  it("returns zero TDS when vendor is not TDS-applicable", () => {
    expect(computeVendorTdsAmount(100000, false)).toBe(0);
  });
});

describe("advance applied without double-counting ledger", () => {
  it("uses workflow advance only when ADVANCE_REQUEST ledger rows exist", async () => {
    const { computeTripVendorBalance } = await import("./vendor-balance");
    const prismaModule = await import("./prisma");
    const original = prismaModule.prisma.trip.findFirst;
    prismaModule.prisma.trip.findFirst = (async () =>
      ({
        vendorRate: { toNumber: () => 100000 },
        vendor: { commercial: { tdsApplicable: false } },
        advanceRequests: [
          {
            source: "SHUNLINK",
            status: "PROCESSED",
            approvedAmount: 40000,
            paidAmount: 40000,
            createdAt: new Date(),
          },
        ],
        charges: [],
        indent: null,
        vendorPayments: [
          {
            paymentType: "ADVANCE",
            sourceType: "ADVANCE_REQUEST",
            status: "PAID",
            netPayable: { toNumber: () => 40000 },
          },
          {
            paymentType: "ADVANCE",
            sourceType: "MANUAL",
            status: "PAID",
            netPayable: { toNumber: () => 40000 },
          },
        ],
      }) as never) as unknown as typeof original;
    try {
      const result = await computeTripVendorBalance("trip-test");
      expect(result?.advanceAmount).toBe(40000);
      expect(result?.balanceAmount).toBe(60000);
    } finally {
      prismaModule.prisma.trip.findFirst = original;
    }
  });
});
