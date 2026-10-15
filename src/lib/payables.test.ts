import { describe, expect, it } from "vitest";
import {
  advanceOutstandingAmount,
  balanceOutstandingAmount,
  buildPayableAgeingRows,
  buildPayablesSummary,
  derivePayableDisplayStatus,
  resolveAdvanceAgeingAnchor,
  resolveAdvanceApprovedAmount,
  splitPayableAgeingBuckets,
  vendorPayableAgeingDays,
} from "./payables";

const NOW = new Date("2026-10-05").getTime();
const POD_DATE = new Date("2026-09-01");
const APPROVED_DATE = new Date("2026-08-15");

describe("advanceOutstandingAmount", () => {
  it("approved 20k paid 10k → advance outstanding 10k", () => {
    expect(
      advanceOutstandingAmount({ approvedAmount: 20000, requestedAmount: 20000, paidAmount: 10000 })
    ).toBe(10000);
  });

  it("fully paid advance has zero outstanding", () => {
    expect(
      advanceOutstandingAmount({ approvedAmount: 20000, requestedAmount: 20000, paidAmount: 20000 })
    ).toBe(0);
  });
});

describe("balanceOutstandingAmount", () => {
  it("final balance 50k no payment → outstanding 50k", () => {
    expect(balanceOutstandingAmount({ balanceAmount: 50000, paidAmount: 0 })).toBe(50000);
  });

  it("50k balance 20k paid → outstanding 30k", () => {
    expect(balanceOutstandingAmount({ balanceAmount: 50000, paidAmount: 20000 })).toBe(30000);
  });

  it("second 30k payment → outstanding 0", () => {
    expect(balanceOutstandingAmount({ balanceAmount: 50000, paidAmount: 50000 })).toBe(0);
  });
});

describe("resolveAdvanceApprovedAmount", () => {
  it("prefers approved over negotiated and requested", () => {
    expect(
      resolveAdvanceApprovedAmount({
        approvedAmount: 40000,
        negotiatedAmount: 35000,
        requestedAmount: 30000,
      })
    ).toBe(40000);
  });
});

describe("vendorPayableAgeingDays", () => {
  it("uses days since commercial anchor", () => {
    expect(vendorPayableAgeingDays(POD_DATE, NOW)).toBe(34);
  });

  it("current bucket when anchor is today", () => {
    expect(vendorPayableAgeingDays(new Date(NOW), NOW)).toBe(0);
  });
});

describe("resolveAdvanceAgeingAnchor", () => {
  it("uses approvedAt when present", () => {
    expect(
      resolveAdvanceAgeingAnchor({
        approvedAt: APPROVED_DATE,
        vendorAcceptedAt: new Date("2026-08-10"),
        requestedAt: new Date("2026-08-01"),
      })
    ).toEqual(APPROVED_DATE);
  });
});

describe("buildPayableAgeingRows and buckets", () => {
  it("maps outstanding into ageing buckets", () => {
    const rows = buildPayableAgeingRows(
      [
        {
          vendorName: "V1",
          tripLr: "LR-1",
          outstanding: 10000,
          ageingAnchor: new Date("2026-10-04"),
          payableType: "BALANCE",
        },
        {
          vendorName: "V2",
          tripLr: "LR-2",
          outstanding: 20000,
          ageingAnchor: new Date("2026-08-01"),
          payableType: "ADVANCE",
        },
      ],
      NOW
    );
    const buckets = splitPayableAgeingBuckets(rows);
    expect(buckets.d1_30).toBe(10000);
    expect(buckets.d31_60 + buckets.d61_90 + buckets.d90plus).toBeGreaterThan(0);
  });
});

describe("derivePayableDisplayStatus", () => {
  it("partial balance payment", () => {
    expect(
      derivePayableDisplayStatus({
        balanceOutstanding: 30000,
        advanceOutstanding: 0,
        balancePaid: 20000,
        advancePaid: 0,
        hasSlaBreached: false,
        hasPendingAction: false,
      })
    ).toBe("PARTIALLY_PAID");
  });

  it("SLA breached takes precedence", () => {
    expect(
      derivePayableDisplayStatus({
        balanceOutstanding: 50000,
        advanceOutstanding: 0,
        balancePaid: 0,
        advancePaid: 0,
        hasSlaBreached: true,
        hasPendingAction: false,
      })
    ).toBe("SLA_BREACHED");
  });

  it("pending review shows action required", () => {
    expect(
      derivePayableDisplayStatus({
        balanceOutstanding: 50000,
        advanceOutstanding: 0,
        balancePaid: 0,
        advancePaid: 0,
        hasSlaBreached: false,
        hasPendingAction: true,
      })
    ).toBe("ACTION_REQUIRED");
  });
});

describe("buildPayablesSummary", () => {
  it("aggregates vendor payables summary metrics", () => {
    const summary = buildPayablesSummary(
      [
        {
          vendorId: "v1",
          vendorName: "Vendor A",
          tripLr: "LR-1",
          outstanding: 30000,
          ageingAnchor: POD_DATE,
          payableType: "BALANCE",
          advanceOutstanding: 0,
          balanceOutstanding: 30000,
          ledgerOutstanding: 0,
          tdsAmount: 2000,
          hasSlaBreached: false,
          hasPendingAction: true,
        },
        {
          vendorId: "v2",
          vendorName: "Vendor B",
          tripLr: "LR-2",
          outstanding: 10000,
          ageingAnchor: APPROVED_DATE,
          payableType: "ADVANCE",
          advanceOutstanding: 10000,
          balanceOutstanding: 0,
          ledgerOutstanding: 0,
          tdsAmount: 0,
          hasSlaBreached: true,
          hasPendingAction: true,
        },
      ],
      NOW
    );

    expect(summary.totalOutstanding).toBe(40000);
    expect(summary.advancesOutstanding).toBe(10000);
    expect(summary.balancePending).toBe(30000);
    expect(summary.dueActionRequired).toBe(40000);
    expect(summary.tdsToWithhold).toBe(2000);
    expect(summary.vendorsWithOutstanding).toBe(2);
  });
});
