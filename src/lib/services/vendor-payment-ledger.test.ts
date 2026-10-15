import { describe, expect, it } from "vitest";
import { buildBalanceVendorLedgerEntry, validateManualVendorPaymentContext } from "./vendor-payment.service";
import { sumOutstandingVendorPayables } from "./vendor-payables.service";

describe("buildBalanceVendorLedgerEntry", () => {
  const task = {
    tripId: "trip-1",
    vendorId: "vendor-1",
    indentId: "indent-1",
    trip: { indentId: "indent-1" },
  };

  it("maps each VendorBalancePayment to actual cash movement", () => {
    const paidAt = new Date("2026-10-01");
    const entry = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-1",
        amount: 20000,
        paidAt,
        paymentMode: "NEFT",
        utrReference: "UTR123",
        chequeNumber: null,
        remarks: "First partial",
        proofFileId: "proof-1",
        recordedById: "user-1",
      },
      task,
    });

    expect(entry).toMatchObject({
      sourceType: "BALANCE_PAYMENT",
      sourceId: "balance:bp-1",
      paymentType: "BALANCE",
      amount: 20000,
      netPayable: 20000,
      advanceAmount: 0,
      tdsAmount: 0,
      paidAt,
      paymentMode: "NEFT",
      referenceNo: "UTR123",
      notes: "First partial",
    });
  });

  it("uses actual payment amount for second partial payment, not task final payable", () => {
    const entry = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-2",
        amount: 30000,
        paidAt: new Date("2026-10-05"),
        paymentMode: "NEFT",
        utrReference: "UTR456",
        chequeNumber: null,
        remarks: "Final settlement",
        proofFileId: null,
        recordedById: "user-1",
      },
      task,
    });

    expect(entry.amount).toBe(30000);
    expect(entry.netPayable).toBe(30000);
    expect(entry.sourceId).toBe("balance:bp-2");
  });

  it("supports full single payment", () => {
    const entry = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-full",
        amount: 50000,
        paidAt: new Date("2026-10-02"),
        paymentMode: "IMPS",
        utrReference: "UTR999",
        chequeNumber: null,
        remarks: null,
        proofFileId: null,
        recordedById: null,
      },
      task,
    });

    expect(entry.amount).toBe(50000);
    expect(entry.netPayable).toBe(50000);
  });

  it("records TDS only when the balance task is fully settled", () => {
    const partial = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-partial-tds",
        amount: 30000,
        paidAt: new Date("2026-10-03"),
        paymentMode: "NEFT",
        utrReference: "UTR-P1",
        chequeNumber: null,
        remarks: null,
        proofFileId: null,
        recordedById: null,
      },
      task: {
        ...task,
        freightAmount: 100000,
        balanceAmount: 58000,
        paidAmount: 30000,
        tdsAmount: 2000,
      },
    });
    expect(partial.tdsAmount).toBe(0);
    expect(partial.netPayable).toBe(30000);

    const final = buildBalanceVendorLedgerEntry({
      payment: {
        id: "bp-final-tds",
        amount: 28000,
        paidAt: new Date("2026-10-04"),
        paymentMode: "NEFT",
        utrReference: "UTR-P2",
        chequeNumber: null,
        remarks: null,
        proofFileId: null,
        recordedById: null,
      },
      task: {
        ...task,
        freightAmount: 100000,
        balanceAmount: 58000,
        paidAmount: 58000,
        tdsAmount: 2000,
      },
    });
    expect(final.tdsAmount).toBe(2000);
    expect(final.amount).toBe(100000);
    expect(final.netPayable).toBe(28000);
  });
});

describe("sumOutstandingVendorPayables", () => {
  it("uses task paidAmount and ignores PAID ledger cash", () => {
    const outstanding = sumOutstandingVendorPayables({
      balanceTasks: [{ balanceAmount: 50000, paidAmount: 20000, status: "APPROVED" }],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(outstanding).toBe(30000);
  });

  it("does not double-count partial balance payments with task outstanding", () => {
    const outstanding = sumOutstandingVendorPayables({
      balanceTasks: [{ balanceAmount: 50000, paidAmount: 50000, status: "PROCESSED" }],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(outstanding).toBe(0);
  });

  it("adds committed advances separately from balance outstanding", () => {
    const outstanding = sumOutstandingVendorPayables({
      balanceTasks: [{ balanceAmount: 58000, paidAmount: 0, status: "APPROVED" }],
      advances: [{ approvedAmount: 40000 }],
      pendingLedgerTotal: 0,
    });
    expect(outstanding).toBe(98000);
  });

  it("reduces committed advance by amount already paid", () => {
    const outstanding = sumOutstandingVendorPayables({
      balanceTasks: [],
      advances: [{ approvedAmount: 40000, paidAmount: 15000 }],
      pendingLedgerTotal: 0,
    });
    expect(outstanding).toBe(25000);
  });

  it("uses net balance task outstanding after TDS, not gross freight", () => {
    const outstanding = sumOutstandingVendorPayables({
      balanceTasks: [{ balanceAmount: 58000, paidAmount: 0, status: "APPROVED" }],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(outstanding).toBe(58000);
  });

  it("includes only pending manual ledger commitments", () => {
    const outstanding = sumOutstandingVendorPayables({
      balanceTasks: [],
      advances: [],
      pendingLedgerTotal: 15000,
    });
    expect(outstanding).toBe(15000);
  });
});

describe("validateManualVendorPaymentContext", () => {
  it("blocks manual BALANCE when a balance task exists", () => {
    expect(
      validateManualVendorPaymentContext({
        paymentType: "BALANCE",
        hasBalanceTask: true,
        balanceTaskStatus: "PARTIALLY_PAID",
      })
    ).toContain("Balance Payments");
  });

  it("blocks manual BALANCE when task is already processed", () => {
    expect(
      validateManualVendorPaymentContext({
        paymentType: "BALANCE",
        hasBalanceTask: true,
        balanceTaskStatus: "PROCESSED",
      })
    ).toContain("already fully paid");
  });

  it("allows manual BALANCE when no task exists", () => {
    expect(
      validateManualVendorPaymentContext({
        paymentType: "BALANCE",
        hasBalanceTask: false,
      })
    ).toBeNull();
  });

  it("blocks manual ADVANCE when workflow request exists", () => {
    expect(
      validateManualVendorPaymentContext({
        paymentType: "ADVANCE",
        hasBalanceTask: false,
        openAdvanceRequest: { requestNumber: "ADV-1", status: "PROCESSING" },
      })
    ).toContain("Advance Payments");
  });

  it("blocks manual ADVANCE for processed workflow requests", () => {
    expect(
      validateManualVendorPaymentContext({
        paymentType: "ADVANCE",
        hasBalanceTask: false,
        openAdvanceRequest: { requestNumber: "ADV-1", status: "PROCESSED" },
      })
    ).toContain("ADV-1");
  });

  it("allows manual OTHER payments", () => {
    expect(
      validateManualVendorPaymentContext({
        paymentType: "OTHER",
        hasBalanceTask: true,
        balanceTaskStatus: "APPROVED",
      })
    ).toBeNull();
  });
});
