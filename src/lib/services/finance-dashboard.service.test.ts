import { describe, expect, it } from "vitest";
import { parseFinanceDashboardFilters } from "./finance-dashboard.service";
import { buildReportOutstandingAgeing } from "../receivables";

const NOW = new Date("2026-10-05").getTime();

describe("buildReportOutstandingAgeing (finance dashboard)", () => {
  it("buckets receivables by days since issue/finalize", () => {
    const ageing = buildReportOutstandingAgeing(
      [
        {
          clientName: "A",
          invoiceNumber: "INV-1",
          totalAmount: 10000,
          paidAmount: 0,
          status: "UNPAID",
          dueDate: new Date("2026-12-01"),
          issueDate: new Date("2026-09-01"),
          finalizedAt: new Date("2026-09-25"),
        },
        {
          clientName: "B",
          invoiceNumber: "INV-2",
          totalAmount: 20000,
          paidAmount: 0,
          status: "OVERDUE",
          dueDate: new Date("2026-09-20"),
          issueDate: new Date("2026-09-01"),
          finalizedAt: new Date("2026-08-01"),
        },
        {
          clientName: "C",
          invoiceNumber: "INV-3",
          totalAmount: 30000,
          paidAmount: 0,
          status: "OVERDUE",
          dueDate: new Date("2026-06-01"),
          issueDate: new Date("2026-05-01"),
          finalizedAt: new Date("2026-06-01"),
        },
      ],
      NOW
    );
    const buckets = ageing.buckets;
    expect(buckets.d0_30).toBe(10000);
    expect(buckets.d61_90).toBe(20000);
    expect(buckets.d90plus).toBe(30000);
    expect(buckets.d0_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90plus).toBe(ageing.total);
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
