import { describe, expect, it } from "vitest";
import {
  buildFinanceTimeline,
  computeAccruedMargin,
  computeCashMargin,
  computeExpectedMargin,
  computeGrossPayable,
  computeVendorOutstanding,
} from "./trip-finance.service";
import { advanceOutstandingAmount, balanceOutstandingAmount } from "../payables";
import { invoiceOutstanding } from "../invoice-payment";
import { allocateTripInvoicePayment } from "../finance-reconciliation";
import { computeVendorBalance, computeVendorTdsAmount } from "../vendor-balance";

describe("computeExpectedMargin", () => {
  it("calculates sell minus buy and margin percent", () => {
    const result = computeExpectedMargin(100000, 80000);
    expect(result.expectedMargin).toBe(20000);
    expect(result.expectedMarginPercent).toBe(20);
  });

  it("handles zero sell rate", () => {
    const result = computeExpectedMargin(0, 50000);
    expect(result.expectedMargin).toBe(-50000);
    expect(result.expectedMarginPercent).toBe(0);
  });

  it("uses trip snapshot rates independently of quote changes", () => {
    const historical = computeExpectedMargin(95000, 78000);
    const currentQuote = computeExpectedMargin(110000, 85000);
    expect(historical.expectedMargin).toBe(17000);
    expect(currentQuote.expectedMargin).toBe(25000);
    expect(historical).not.toEqual(currentQuote);
  });
});

describe("computeGrossPayable", () => {
  it("sums freight, charges, and deductions", () => {
    expect(computeGrossPayable(80000, 5000, 2000)).toBe(83000);
  });
});

describe("vendor settlement without vendor", () => {
  it("produces zero outstanding when no freight", () => {
    expect(computeVendorOutstanding(0, 0)).toBe(0);
    expect(computeGrossPayable(0, 0, 0)).toBe(0);
  });
});

describe("partial advance", () => {
  it("computes advance outstanding from approved minus paid", () => {
    const outstanding = advanceOutstandingAmount({
      approvedAmount: 30000,
      negotiatedAmount: null,
      requestedAmount: 25000,
      paidAmount: 15000,
    });
    expect(outstanding).toBe(15000);
  });

  it("never produces negative advance outstanding", () => {
    const outstanding = advanceOutstandingAmount({
      approvedAmount: 30000,
      requestedAmount: 30000,
      paidAmount: 35000,
    });
    expect(outstanding).toBe(0);
  });
});

describe("partial vendor balance payments", () => {
  it("computes balance outstanding from balance amount minus paid", () => {
    expect(
      balanceOutstandingAmount({ balanceAmount: 58000, paidAmount: 30000 })
    ).toBe(28000);
  });

  it("handles multiple partial payments via cumulative paid amount", () => {
    const paidAfterFirst = 20000;
    const paidAfterSecond = 45000;
    const balanceAmount = 58000;
    expect(balanceOutstandingAmount({ balanceAmount, paidAmount: paidAfterFirst })).toBe(38000);
    expect(balanceOutstandingAmount({ balanceAmount, paidAmount: paidAfterSecond })).toBe(13000);
  });
});

describe("vendor payments without double counting", () => {
  it("vendor outstanding is advance outstanding plus balance outstanding only", () => {
    const advanceOutstanding = 10000;
    const balanceOutstanding = 28000;
    expect(computeVendorOutstanding(advanceOutstanding, balanceOutstanding)).toBe(38000);
  });

  it("fully paid vendor has zero outstanding", () => {
    expect(computeVendorOutstanding(0, 0)).toBe(0);
    expect(balanceOutstandingAmount({ balanceAmount: 58000, paidAmount: 58000 })).toBe(0);
  });
});

describe("TDS calculation and display", () => {
  it("withholds TDS from freight only, not added as extra expense", () => {
    const freight = 100000;
    const tds = computeVendorTdsAmount(freight, true);
    const balance = computeVendorBalance({
      vendorRate: freight,
      advanceAmount: 40000,
      tdsAmount: tds,
    });
    expect(tds).toBe(2000);
    expect(balance.finalPayableAmount).toBe(98000);
    expect(balance.balanceAmount).toBe(58000);
    const gross = computeGrossPayable(freight, 0, 0);
    expect(gross - tds).toBe(balance.finalPayableAmount);
  });
});

describe("customer partial payment", () => {
  it("computes invoice outstanding correctly", () => {
    expect(invoiceOutstanding(50000, 20000)).toBe(30000);
  });

  it("never produces negative customer outstanding", () => {
    expect(Math.max(0, invoiceOutstanding(50000, 55000))).toBe(0);
  });
});

describe("fully paid customer invoice", () => {
  it("shows zero outstanding when fully collected", () => {
    expect(invoiceOutstanding(75000, 75000)).toBe(0);
  });
});

describe("no invoice", () => {
  it("accrued margin unavailable without finalized invoice", () => {
    expect(computeAccruedMargin(50000, 40000, false, true)).toBeNull();
  });
});

describe("expected margin vs cash margin", () => {
  it("cash margin reflects actual payments not booking margin", () => {
    const { expectedMargin } = computeExpectedMargin(100000, 80000);
    const cashMargin = computeCashMargin(50000, 60000);
    expect(expectedMargin).toBe(20000);
    expect(cashMargin).toBe(-10000);
    expect(cashMargin).not.toBe(expectedMargin);
  });
});

describe("charges and deductions", () => {
  it("adjusts final payable with charges and deductions before TDS", () => {
    const result = computeVendorBalance({
      vendorRate: 80000,
      advanceAmount: 25000,
      additionalCharges: 5000,
      deductions: 2000,
      tdsAmount: 1600,
    });
    expect(computeGrossPayable(80000, 5000, 2000)).toBe(83000);
    expect(result.finalPayableAmount).toBe(81400);
    expect(result.balanceAmount).toBe(56400);
  });
});

describe("accrued margin", () => {
  it("computes settlement margin when invoice and vendor payable known", () => {
    expect(computeAccruedMargin(100000, 81400, true, true)).toBe(18600);
  });

  it("returns null when vendor settlement unknown", () => {
    expect(computeAccruedMargin(100000, 81400, true, false)).toBeNull();
  });
});

describe("multi-trip invoice allocation", () => {
  it("allocates partial payment proportionally to trip line", () => {
    const line = allocateTripInvoicePayment(40000, 80000, 40000);
    expect(line.collected).toBe(20000);
    expect(line.outstanding).toBe(20000);
  });
});

describe("buildFinanceTimeline", () => {
  const base = {
    advanceRequests: [] as {
      id: string;
      requestNumber: string;
      requestedAt: Date;
      approvedAt: Date | null;
      processedAt: Date | null;
      paymentDate: Date | null;
      paidAmount: number | null;
    }[],
    trip: { deliveredAt: null, podVerifiedAt: null, tripClosedAt: null },
    balanceTask: null,
    invoice: null,
    invoiceTask: null,
    clientPayments: [] as { id: string; amount: number; paidAt: Date }[],
    vendorPayments: [] as { id: string; amount: number; paidAt: Date | null; paymentType: string }[],
  };

  it("orders events chronologically", () => {
    const events = buildFinanceTimeline({
      ...base,
      advanceRequests: [
        {
          id: "a1",
          requestNumber: "ADV-1",
          requestedAt: new Date("2026-09-01"),
          approvedAt: new Date("2026-09-02"),
          processedAt: null,
          paymentDate: new Date("2026-09-03"),
          paidAmount: 30000,
        },
      ],
      trip: {
        deliveredAt: new Date("2026-09-10"),
        podVerifiedAt: new Date("2026-09-11"),
        tripClosedAt: null,
      },
      invoice: {
        id: "inv1",
        invoiceNumber: "INV-1",
        createdAt: new Date("2026-09-12"),
        finalizedAt: new Date("2026-09-13"),
        issueDate: new Date("2026-09-12"),
      },
    });

    expect(events.length).toBeGreaterThan(1);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        events[i - 1].timestamp.getTime()
      );
    }
    expect(events[0].type).toBe("ADVANCE_REQUESTED");
    expect(events.some((e) => e.type === "POD_VERIFIED")).toBe(true);
    expect(events.some((e) => e.type === "INVOICE_FINALIZED")).toBe(true);
  });
});
