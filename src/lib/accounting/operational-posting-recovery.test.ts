import { describe, expect, it } from "vitest";
import {
  detectStaleVendorPayableAccrual,
  formatGatewayBalancePaymentRemarks,
  parseGatewayOutboundIdFromRemarks,
} from "./operational-posting-recovery";
import { assertBalancedJournal } from "./posting-validation";
import { buildVendorPayableAccrualLines } from "./posting-rules";

describe("gateway remark linking", () => {
  it("round-trips outbound payment id in remarks", () => {
    const remarks = formatGatewayBalancePaymentRemarks("ob-pay-123");
    expect(parseGatewayOutboundIdFromRemarks(remarks)).toBe("ob-pay-123");
    expect(parseGatewayOutboundIdFromRemarks("Settled via payment gateway")).toBeNull();
  });
});

describe("vendor payable accrual idempotency keys", () => {
  it("duplicate approval builds identical balanced lines", () => {
    const ctx = {
      payableId: "pay-1",
      finalPayableMinor: 100_000,
      advanceAppliedMinor: 25_000,
      vendorId: "v-1",
      tripId: "t-1",
    };
    const a = buildVendorPayableAccrualLines(ctx);
    const b = buildVendorPayableAccrualLines(ctx);
    assertBalancedJournal(
      a.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
    expect(a).toEqual(b);
  });
});

describe("stale payable accrual detection", () => {
  it("flags when posted expense differs from current payable", () => {
    const stale = detectStaleVendorPayableAccrual({
      payable: {
        id: "p1",
        tripId: "t1",
        finalPayableAmount: 120_000,
        advanceAppliedAmount: 0,
        vendorId: "v1",
      },
      postedLines: [{ accountCode: "5100", debitMinor: 10_000_000, creditMinor: 0 }],
    });
    expect(stale).not.toBeNull();
    expect(stale?.expectedMinor).toBe(12_000_000);
    expect(stale?.postedExpenseMinor).toBe(10_000_000);
  });

  it("returns null when accrual matches payable", () => {
    const stale = detectStaleVendorPayableAccrual({
      payable: {
        id: "p1",
        tripId: "t1",
        finalPayableAmount: 50_000,
        advanceAppliedAmount: 10_000,
        vendorId: "v1",
      },
      postedLines: [
        { accountCode: "5100", debitMinor: 5_000_000, creditMinor: 0 },
        { accountCode: "2110", debitMinor: 0, creditMinor: 5_000_000 },
        { accountCode: "2110", debitMinor: 1_000_000, creditMinor: 0 },
        { accountCode: "2150", debitMinor: 0, creditMinor: 1_000_000 },
      ],
    });
    expect(stale).toBeNull();
  });
});
