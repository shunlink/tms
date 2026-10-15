import { describe, expect, it } from "vitest";
import { sumOutstandingVendorPayables } from "./vendor-payables.service";

describe("sumOutstandingVendorPayables", () => {
  it("includes PENDING_REVIEW balance tasks in monetary outstanding", () => {
    const total = sumOutstandingVendorPayables({
      balanceTasks: [
        { balanceAmount: 50_000, paidAmount: 0, status: "PENDING_REVIEW" },
      ],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(total).toBe(50_000);
  });

  it("includes APPROVED balance task outstanding", () => {
    const total = sumOutstandingVendorPayables({
      balanceTasks: [
        { balanceAmount: 50_000, paidAmount: 10_000, status: "APPROVED" },
      ],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(total).toBe(40_000);
  });

  it("includes PENDING_REVIEW when commercial approval is recorded on payable", () => {
    const total = sumOutstandingVendorPayables({
      balanceTasks: [
        {
          balanceAmount: 30_000,
          paidAmount: 0,
          status: "PENDING_REVIEW",
          commercialApprovalStatus: "APPROVED",
        },
      ],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(total).toBe(30_000);
  });

  it("sums advance commitment and approved balance", () => {
    const total = sumOutstandingVendorPayables({
      balanceTasks: [{ balanceAmount: 20_000, paidAmount: 5_000, status: "PARTIALLY_PAID" }],
      advances: [{ approvedAmount: 15_000, requestedAmount: 15_000, paidAmount: 5_000 }],
      pendingLedgerTotal: 0,
    });
    expect(total).toBe(15_000 + 10_000);
  });

  it("fully paid balance task contributes zero", () => {
    const total = sumOutstandingVendorPayables({
      balanceTasks: [{ balanceAmount: 10_000, paidAmount: 10_000, status: "PROCESSING" }],
      advances: [],
      pendingLedgerTotal: 0,
    });
    expect(total).toBe(0);
  });
});
