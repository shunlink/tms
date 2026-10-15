import { describe, expect, it } from "vitest";
import {
  allocateTripInvoicePayment,
  computeCashMargin,
  computeExpectedMargin,
  computeLiveVendorSettlement,
  computeSettlementMargin,
  computeTripCustomerSettlement,
  computeVendorSettlement,
  reconcileInvoiceOutstanding,
  reconcilePayablesTotal,
  reconcileVendorOutstanding,
} from "./finance-reconciliation";
import { validateInvoicePaymentAmount } from "./invoice-payment";
import { sumOutstandingVendorPayables } from "./services/vendor-payables.service";
import { buildBalanceVendorLedgerEntry } from "./services/vendor-payment.service";
import { computeVendorTdsAmount } from "./vendor-balance";

describe("complete trip with no advance", () => {
  it("final payable equals gross minus TDS with full balance outstanding", () => {
    const tds = computeVendorTdsAmount(50000, true);
    const settlement = computeVendorSettlement({
      freight: 50000,
      tdsAmount: tds,
      advancePaid: 0,
      balanceAmount: 49000,
      balancePaid: 0,
    });
    expect(settlement.grossPayable).toBe(50000);
    expect(settlement.finalPayable).toBe(49000);
    expect(settlement.vendorOutstanding).toBe(49000);
  });
});

describe("complete trip with full vendor advance", () => {
  it("balance outstanding is final payable minus advance paid", () => {
    const settlement = computeVendorSettlement({
      freight: 100000,
      tdsAmount: 2000,
      advanceApproved: 40000,
      advancePaid: 40000,
      balanceAmount: 58000,
      balancePaid: 0,
    });
    expect(settlement.advanceOutstanding).toBe(0);
    expect(settlement.balanceOutstanding).toBe(58000);
    expect(settlement.vendorOutstanding).toBe(58000);
  });
});

describe("partial vendor advance", () => {
  it("10k approved, 4k paid → 6k outstanding", () => {
    const settlement = computeVendorSettlement({
      freight: 80000,
      advanceApproved: 10000,
      advancePaid: 4000,
      balanceAmount: 70000,
      balancePaid: 0,
    });
    expect(settlement.advanceOutstanding).toBe(6000);
  });

  it("second 6k payment clears advance outstanding", () => {
    const settlement = computeVendorSettlement({
      freight: 80000,
      advanceApproved: 10000,
      advancePaid: 10000,
      balanceAmount: 70000,
      balancePaid: 0,
    });
    expect(settlement.advanceOutstanding).toBe(0);
  });
});

describe("partial vendor balance payments", () => {
  it("37800 final, 10k advance, balance 27800 with staged payments", () => {
    const balanceAmount = 27800;
    let paid = 0;
    for (const payment of [10000, 10000, 7800]) {
      paid += payment;
      const settlement = computeVendorSettlement({
        freight: 40000,
        tdsAmount: 0,
        advancePaid: 10000,
        balanceAmount,
        balancePaid: paid,
      });
      expect(settlement.balanceOutstanding).toBe(Math.max(0, balanceAmount - paid));
    }
    const final = computeVendorSettlement({
      freight: 40000,
      advancePaid: 10000,
      balanceAmount: 27800,
      balancePaid: 27800,
    });
    expect(final.balanceOutstanding).toBe(0);
    expect(final.vendorOutstanding).toBe(0);
  });
});

describe("customer partial and full payment", () => {
  it("40k invoice, 15k then 25k payments", () => {
    const line = allocateTripInvoicePayment(40000, 40000, 15000);
    expect(line.outstanding).toBe(25000);
    const paid = allocateTripInvoicePayment(40000, 40000, 40000);
    expect(paid.outstanding).toBe(0);
    expect(paid.collected).toBe(40000);
  });

  it("rejects overpayment", () => {
    expect(validateInvoicePaymentAmount(25000, 30000)).toMatch(/exceeds outstanding/);
  });
});

describe("TDS applicable and not applicable", () => {
  it("withholds 2% from freight only", () => {
    expect(computeVendorTdsAmount(100000, true)).toBe(2000);
    const settlement = computeVendorSettlement({
      freight: 100000,
      tdsAmount: 2000,
      advancePaid: 0,
      balanceAmount: 98000,
      balancePaid: 0,
    });
    expect(settlement.finalPayable).toBe(98000);
  });

  it("no TDS when not applicable", () => {
    expect(computeVendorTdsAmount(100000, false)).toBe(0);
    const live = computeLiveVendorSettlement({
      vendorRate: 100000,
      tdsApplicable: false,
      advancePaid: 0,
    });
    expect(live.finalPayable).toBe(100000);
  });
});

describe("charges and deductions", () => {
  it("adjusts gross before TDS", () => {
    const settlement = computeVendorSettlement({
      freight: 80000,
      additionalCharges: 5000,
      deductions: 2000,
      tdsAmount: 1600,
      advancePaid: 25000,
      balanceAmount: 56400,
      balancePaid: 0,
    });
    expect(settlement.grossPayable).toBe(83000);
    expect(settlement.finalPayable).toBe(81400);
    expect(settlement.balanceOutstanding).toBe(56400);
  });
});

describe("duplicate vendor ledger prevention", () => {
  it("each balance payment maps to unique sourceId", () => {
    const task = {
      tripId: "t1",
      vendorId: "v1",
      indentId: null,
      trip: { indentId: null },
      freightAmount: 100000,
      balanceAmount: 27800,
      paidAmount: 10000,
      tdsAmount: 2000,
    };
    const e1 = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-1",
        amount: 10000,
        paidAt: new Date(),
        paymentMode: "NEFT",
        utrReference: "U1",
        chequeNumber: null,
        remarks: null,
        proofFileId: null,
        recordedById: null,
      },
      task,
    });
    const e2 = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-2",
        amount: 17800,
        paidAt: new Date(),
        paymentMode: "NEFT",
        utrReference: "U2",
        chequeNumber: null,
        remarks: null,
        proofFileId: null,
        recordedById: null,
      },
      task: { ...task, paidAmount: 27800 },
    });
    expect(e1.sourceId).not.toBe(e2.sourceId);
    expect(e1.netPayable + e2.netPayable).toBe(27800);
    expect(e1.tdsAmount).toBe(0);
    expect(e2.tdsAmount).toBe(2000);
  });
});

describe("cancelled and draft invoice exclusion", () => {
  it("draft invoice does not create trip receivable", () => {
    const result = computeTripCustomerSettlement({
      lineAmount: 50000,
      invoiceTotal: 50000,
      invoicePaid: 0,
      invoicePayable: false,
      tripClientPayments: 0,
    });
    expect(result.invoiceAmount).toBe(0);
    expect(result.outstanding).toBe(0);
  });
});

describe("payables reconciliation", () => {
  it("matches sumOutstandingVendorPayables", () => {
    const balanceTasks = [{ balanceAmount: 27800, paidAmount: 10000, status: "APPROVED" }];
    const advances = [{ approvedAmount: 10000, paidAmount: 4000 }];
    const pendingLedger = 5000;
    const total = sumOutstandingVendorPayables({
      balanceTasks,
      advances,
      pendingLedgerTotal: pendingLedger,
    });
    const check = reconcilePayablesTotal(balanceTasks, advances, pendingLedger, total);
    expect(check.ok).toBe(true);
    expect(total).toBe(27800 - 10000 + 6000 + 5000);
  });
});

describe("receivables reconciliation", () => {
  it("invoice outstanding matches total minus paid", () => {
    const check = reconcileInvoiceOutstanding(40000, 15000, 25000);
    expect(check.ok).toBe(true);
  });
});

describe("vendor outstanding reconciliation", () => {
  it("advance plus balance equals vendor outstanding", () => {
    const check = reconcileVendorOutstanding({
      advanceOutstanding: 6000,
      balanceOutstanding: 17800,
      vendorOutstanding: 23800,
    });
    expect(check.ok).toBe(true);
  });
});

describe("expected vs settlement vs cash margin", () => {
  it("keeps booking, settlement, and cash separate", () => {
    const { expectedMargin } = computeExpectedMargin(100000, 80000);
    const settlement = computeSettlementMargin(100000, 81400, true, true);
    const cash = computeCashMargin(50000, 60000);
    expect(expectedMargin).toBe(20000);
    expect(settlement).toBe(18600);
    expect(cash).toBe(-10000);
    expect(settlement).not.toBe(cash);
  });

  it("settlement unavailable without finalized invoice", () => {
    expect(computeSettlementMargin(100000, 81400, false, true)).toBeNull();
  });
});

describe("multi-trip invoice handling", () => {
  it("allocates collections proportionally per line", () => {
    const tripA = allocateTripInvoicePayment(40000, 80000, 40000);
    const tripB = allocateTripInvoicePayment(40000, 80000, 40000);
    expect(tripA.collected).toBe(20000);
    expect(tripB.collected).toBe(20000);
    expect(tripA.outstanding).toBe(20000);
    expect(tripB.outstanding).toBe(20000);
    expect(tripA.collected + tripB.collected).toBe(40000);
  });

  it("fully paid multi-trip invoice clears each line", () => {
    const tripA = allocateTripInvoicePayment(40000, 80000, 80000);
    const tripB = allocateTripInvoicePayment(40000, 80000, 80000);
    expect(tripA.outstanding).toBe(0);
    expect(tripB.outstanding).toBe(0);
  });
});

describe("external advance and zero advance", () => {
  it("zero advance leaves full balance outstanding", () => {
    const settlement = computeVendorSettlement({
      freight: 50000,
      advanceApproved: 0,
      advancePaid: 0,
      balanceAmount: 49000,
      balancePaid: 0,
      tdsAmount: 1000,
    });
    expect(settlement.advanceOutstanding).toBe(0);
    expect(settlement.balanceOutstanding).toBe(49000);
  });
});

describe("historical trip sell/buy snapshot integrity", () => {
  it("expected margin uses snapshotted rates only", () => {
    const booked = computeExpectedMargin(95000, 78000);
    const repriced = computeExpectedMargin(110000, 85000);
    expect(booked.expectedMargin).toBe(17000);
    expect(repriced.expectedMargin).toBe(25000);
  });
});
