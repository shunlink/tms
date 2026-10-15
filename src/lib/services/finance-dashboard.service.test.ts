import { describe, expect, it } from "vitest";
import { parseFinanceDashboardFilters } from "./finance-dashboard.service";
import { buildOutstandingAgeing, splitDetailedAgeingBuckets } from "../receivables";

const NOW = new Date("2026-10-05").getTime();

describe("splitDetailedAgeingBuckets", () => {
  it("splits ageing rows into five buckets including 90+", () => {
    const ageing = buildOutstandingAgeing(
      [
        {
          clientName: "A",
          invoiceNumber: "INV-1",
          totalAmount: 10000,
          paidAmount: 0,
          status: "UNPAID",
          dueDate: new Date("2026-12-01"),
          issueDate: new Date("2026-09-01"),
        },
        {
          clientName: "B",
          invoiceNumber: "INV-2",
          totalAmount: 20000,
          paidAmount: 0,
          status: "OVERDUE",
          dueDate: new Date("2026-09-20"),
          issueDate: new Date("2026-09-01"),
        },
        {
          clientName: "C",
          invoiceNumber: "INV-3",
          totalAmount: 30000,
          paidAmount: 0,
          status: "OVERDUE",
          dueDate: new Date("2026-06-01"),
          issueDate: new Date("2026-05-01"),
        },
      ],
      NOW
    );
    const buckets = splitDetailedAgeingBuckets(ageing.rows);
    expect(buckets.current).toBe(10000);
    expect(buckets.d1_30).toBe(20000);
    expect(buckets.d90plus).toBe(30000);
    expect(
      buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90plus
    ).toBe(ageing.total);
  });
});

describe("parseFinanceDashboardFilters", () => {
  it("parses query params into filter object", () => {
    const filters = parseFinanceDashboardFilters({
      from: "2026-01-01",
      to: "2026-01-31",
      clientId: "c1",
      vendorId: "v1",
      tripId: "t1",
      status: "CLOSED",
    });
    expect(filters.clientId).toBe("c1");
    expect(filters.vendorId).toBe("v1");
    expect(filters.tripId).toBe("t1");
    expect(filters.status).toBe("CLOSED");
    expect(filters.dateFrom).toEqual(new Date("2026-01-01"));
    expect(filters.dateTo).toEqual(new Date("2026-01-31"));
  });
});
