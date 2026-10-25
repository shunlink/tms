import { describe, expect, it } from "vitest";
import {
  buildOutstandingAgeing,
  buildReceivablesSummary,
  buildReportOutstandingAgeing,
  deriveReceivableDisplayStatus,
  invoiceAgeingDays,
  invoiceBalanceAgeDays,
  isOutstandingInvoiceStatus,
  splitDetailedAgeingBuckets,
} from "./receivables";

const CLIENT = "Tata Steel";
const ISSUE = new Date("2026-09-01");
const DUE_FUTURE = new Date("2026-12-01");
const DUE_PAST = new Date("2026-08-01");
const NOW = new Date("2026-10-05").getTime();

function row(
  status: string,
  totalAmount: number,
  paidAmount: number,
  dueDate: Date | null = DUE_FUTURE
) {
  return {
    clientName: CLIENT,
    invoiceNumber: `INV-${status}`,
    totalAmount,
    paidAmount,
    status,
    dueDate,
    issueDate: ISSUE,
  };
}

describe("isOutstandingInvoiceStatus", () => {
  it("includes finalized unpaid statuses", () => {
    expect(isOutstandingInvoiceStatus("UNPAID")).toBe(true);
    expect(isOutstandingInvoiceStatus("PARTIALLY_PAID")).toBe(true);
    expect(isOutstandingInvoiceStatus("OVERDUE")).toBe(true);
    expect(isOutstandingInvoiceStatus("SENT")).toBe(true);
  });

  it("excludes draft, cancelled, and paid", () => {
    expect(isOutstandingInvoiceStatus("DRAFT")).toBe(false);
    expect(isOutstandingInvoiceStatus("CANCELLED")).toBe(false);
    expect(isOutstandingInvoiceStatus("PAID")).toBe(false);
  });
});

describe("buildOutstandingAgeing", () => {
  it("₹50k UNPAID invoice → ₹50k outstanding", () => {
    const result = buildOutstandingAgeing([row("UNPAID", 50000, 0)], NOW);
    expect(result.total).toBe(50000);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].balance).toBe(50000);
  });

  it("₹50k PARTIALLY_PAID with ₹20k paid → ₹30k outstanding", () => {
    const result = buildOutstandingAgeing([row("PARTIALLY_PAID", 50000, 20000)], NOW);
    expect(result.total).toBe(30000);
    expect(result.rows[0].balance).toBe(30000);
  });

  it("PAID invoice → ₹0 outstanding", () => {
    const result = buildOutstandingAgeing([row("PAID", 50000, 50000)], NOW);
    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it("DRAFT invoice → excluded", () => {
    const result = buildOutstandingAgeing([row("DRAFT", 50000, 0)], NOW);
    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it("overdue UNPAID invoice appears in overdue ageing bucket", () => {
    const days = invoiceAgeingDays(DUE_PAST, ISSUE, NOW);
    expect(days).toBeGreaterThan(30);

    const result = buildOutstandingAgeing([row("UNPAID", 50000, 0, DUE_PAST)], NOW);
    expect(result.total).toBe(50000);
    expect(result.rows[0].days).toBeGreaterThan(30);
    expect(result.buckets.d30 + result.buckets.d60 + result.buckets.d90).toBe(50000);
    expect(result.buckets.current).toBe(0);
  });

  it("not-yet-due UNPAID invoice stays in current bucket", () => {
    const result = buildOutstandingAgeing([row("UNPAID", 50000, 0, DUE_FUTURE)], NOW);
    expect(result.buckets.current).toBe(50000);
    expect(result.rows[0].days).toBeLessThanOrEqual(0);
  });
});

describe("buildReceivablesSummary", () => {
  it("computes total overdue from past-due balances", () => {
    const summary = buildReceivablesSummary([row("UNPAID", 50000, 0, DUE_PAST)], NOW);
    expect(summary.total).toBe(50000);
    expect(summary.totalOverdue).toBe(50000);
  });
});

describe("deriveReceivableDisplayStatus", () => {
  it("marks overdue from due date not stored status", () => {
    expect(deriveReceivableDisplayStatus(50000, 0, DUE_PAST, ISSUE, NOW)).toBe("OVERDUE");
  });
});

describe("buildReportOutstandingAgeing", () => {
  it("buckets unpaid invoices by days since finalize, not payment due date", () => {
    const result = buildReportOutstandingAgeing(
      [
        {
          ...row("UNPAID", 100_000, 0, DUE_FUTURE),
          invoiceNumber: "INV-A",
          finalizedAt: new Date("2026-09-25"),
        },
        {
          ...row("UNPAID", 200_000, 0, DUE_FUTURE),
          invoiceNumber: "INV-B",
          finalizedAt: new Date("2026-08-01"),
        },
        {
          ...row("UNPAID", 80_031, 0, DUE_FUTURE),
          invoiceNumber: "INV-C",
          finalizedAt: new Date("2026-06-01"),
        },
      ],
      NOW
    );
    expect(result.total).toBe(380_031);
    expect(result.buckets.d0_30).toBe(100_000);
    expect(result.buckets.d61_90).toBe(200_000);
    expect(result.buckets.d90plus).toBe(80_031);
    expect(invoiceBalanceAgeDays(ISSUE, new Date("2026-09-25"), NOW)).toBeLessThanOrEqual(30);
  });
});

describe("splitDetailedAgeingBuckets", () => {
  it("includes 90+ bucket", () => {
    const ageing = buildOutstandingAgeing(
      [row("OVERDUE", 30000, 0, new Date("2026-05-01"))],
      NOW
    );
    const buckets = splitDetailedAgeingBuckets(ageing.rows);
    expect(buckets.d90plus).toBe(30000);
  });
});
