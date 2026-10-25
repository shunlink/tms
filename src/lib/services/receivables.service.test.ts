import { describe, expect, it } from "vitest";
import {
  applyReceivableComputedFilters,
  parseReceivablesFilters,
  sortReceivableRows,
  type ReceivableRow,
} from "./receivables.service";
import { paginated, parsePagination } from "../pagination";
import {
  buildOutstandingAgeing,
  buildReceivablesSummary,
  deriveReceivableDisplayStatus,
  splitDetailedAgeingBuckets,
} from "../receivables";

const NOW = new Date("2026-10-05").getTime();
const ISSUE = new Date("2026-09-01");
const DUE_FUTURE = new Date("2026-12-01");
const DUE_PAST = new Date("2026-08-01");

function ageingRow(
  status: string,
  total: number,
  paid: number,
  dueDate: Date | null = DUE_FUTURE,
  finalizedAt: Date = ISSUE
) {
  return {
    clientName: "Client",
    invoiceNumber: `INV-${status}`,
    totalAmount: total,
    paidAmount: paid,
    status,
    dueDate,
    issueDate: ISSUE,
    finalizedAt,
  };
}

function receivableRow(overrides: Partial<ReceivableRow> & { id: string }): ReceivableRow {
  return {
    id: overrides.id,
    invoiceNumber: overrides.invoiceNumber ?? overrides.id,
    issueDate: overrides.issueDate ?? ISSUE,
    dueDate: overrides.dueDate ?? DUE_FUTURE,
    clientId: overrides.clientId ?? "c1",
    clientName: overrides.clientName ?? "Acme",
    tripLr: overrides.tripLr ?? "LR-1",
    totalAmount: overrides.totalAmount ?? 50000,
    paidAmount: overrides.paidAmount ?? 0,
    outstanding: overrides.outstanding ?? 50000,
    daysOverdue: overrides.daysOverdue ?? 0,
    daysSinceIssue: overrides.daysSinceIssue ?? 10,
    ageingBucket: overrides.ageingBucket ?? "d0_30",
    displayStatus: overrides.displayStatus ?? "UNPAID",
    storedStatus: overrides.storedStatus ?? "UNPAID",
  };
}

describe("deriveReceivableDisplayStatus", () => {
  it("unpaid invoice with future due date", () => {
    expect(deriveReceivableDisplayStatus(50000, 0, DUE_FUTURE, ISSUE, NOW)).toBe("UNPAID");
  });

  it("partial payment", () => {
    expect(deriveReceivableDisplayStatus(50000, 20000, DUE_FUTURE, ISSUE, NOW)).toBe("PARTIALLY_PAID");
  });

  it("fully paid invoice", () => {
    expect(deriveReceivableDisplayStatus(50000, 50000, DUE_PAST, ISSUE, NOW)).toBe("PAID");
  });

  it("overdue invoice even when stored status is UNPAID", () => {
    expect(deriveReceivableDisplayStatus(50000, 0, DUE_PAST, ISSUE, NOW)).toBe("OVERDUE");
  });

  it("does not show PAID when status was manually set but amount unpaid", () => {
    expect(deriveReceivableDisplayStatus(50000, 0, DUE_FUTURE, ISSUE, NOW)).not.toBe("PAID");
  });
});

describe("buildOutstandingAgeing exclusions", () => {
  it("excludes draft invoice", () => {
    const result = buildOutstandingAgeing([ageingRow("DRAFT", 50000, 0)], NOW);
    expect(result.total).toBe(0);
  });

  it("excludes cancelled invoice", () => {
    const result = buildOutstandingAgeing([ageingRow("CANCELLED", 50000, 0)], NOW);
    expect(result.total).toBe(0);
  });

  it("excludes fully paid invoice", () => {
    const result = buildOutstandingAgeing([ageingRow("PAID", 50000, 50000)], NOW);
    expect(result.total).toBe(0);
  });
});

describe("buildReceivablesSummary ageing buckets", () => {
  it("maps outstanding by days since issue and overdue by due date", () => {
    const summary = buildReceivablesSummary(
      [
        ageingRow("UNPAID", 10000, 0, DUE_FUTURE, new Date("2026-09-25")),
        ageingRow("OVERDUE", 20000, 0, new Date("2026-09-20"), new Date("2026-08-01")),
        ageingRow("OVERDUE", 30000, 0, new Date("2026-06-01"), new Date("2026-06-01")),
      ],
      NOW
    );
    expect(summary.total).toBe(60000);
    expect(summary.buckets.d0_30).toBe(10000);
    expect(summary.buckets.d61_90).toBe(20000);
    expect(summary.buckets.d90plus).toBe(30000);
    expect(summary.totalOverdue).toBe(50000);
  });
});

describe("parseReceivablesFilters", () => {
  it("parses filter query params", () => {
    const filters = parseReceivablesFilters({
      clientId: "c1",
      status: "OVERDUE",
      ageingBucket: "d1_30",
      tripLr: "LR-99",
      minOutstanding: "1000",
      maxOutstanding: "50000",
      dueFrom: "2026-01-01",
      issueTo: "2026-12-31",
    });
    expect(filters.clientId).toBe("c1");
    expect(filters.status).toBe("OVERDUE");
    expect(filters.ageingBucket).toBe("d0_30");
    expect(filters.tripLr).toBe("LR-99");
    expect(filters.minOutstanding).toBe(1000);
    expect(filters.maxOutstanding).toBe(50000);
    expect(filters.dueFrom).toEqual(new Date("2026-01-01"));
    expect(filters.issueTo).toEqual(new Date("2026-12-31"));
  });
});

describe("applyReceivableComputedFilters", () => {
  const rows = [
    receivableRow({
      id: "1",
      displayStatus: "UNPAID",
      ageingBucket: "d0_30",
      outstanding: 10000,
      daysOverdue: 0,
    }),
    receivableRow({
      id: "2",
      displayStatus: "OVERDUE",
      ageingBucket: "d0_30",
      outstanding: 25000,
      daysOverdue: 15,
      clientName: "Beta",
    }),
    receivableRow({
      id: "3",
      displayStatus: "PARTIALLY_PAID",
      ageingBucket: "d31_60",
      outstanding: 5000,
      daysOverdue: 45,
    }),
  ];

  it("filters by status", () => {
    const filtered = applyReceivableComputedFilters(rows, { status: "OVERDUE" });
    expect(filtered.map((r) => r.id)).toEqual(["2"]);
  });

  it("filters by ageing bucket", () => {
    const filtered = applyReceivableComputedFilters(rows, { ageingBucket: "d0_30" });
    expect(filtered.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("filters any overdue bucket", () => {
    const filtered = applyReceivableComputedFilters(rows, { ageingBucket: "overdue" });
    expect(filtered.map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("filters by outstanding range", () => {
    const filtered = applyReceivableComputedFilters(rows, { minOutstanding: 20000, maxOutstanding: 30000 });
    expect(filtered.map((r) => r.id)).toEqual(["2"]);
  });
});

describe("sortReceivableRows", () => {
  const rows = [
    receivableRow({
      id: "1",
      dueDate: new Date("2026-12-01"),
      outstanding: 5000,
      issueDate: new Date("2026-09-01"),
      clientName: "Zeta",
    }),
    receivableRow({
      id: "2",
      dueDate: new Date("2026-08-01"),
      outstanding: 20000,
      issueDate: new Date("2026-08-15"),
      clientName: "Alpha",
    }),
    receivableRow({
      id: "3",
      dueDate: new Date("2026-10-01"),
      outstanding: 10000,
      issueDate: new Date("2026-09-20"),
      clientName: "Beta",
    }),
  ];

  it("default sorts oldest due date first", () => {
    const sorted = sortReceivableRows(rows, "dueDate", "asc");
    expect(sorted.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by outstanding descending", () => {
    const sorted = sortReceivableRows(rows, "outstanding", "desc");
    expect(sorted.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by client name", () => {
    const sorted = sortReceivableRows(rows, "client", "asc");
    expect(sorted.map((r) => r.clientName)).toEqual(["Alpha", "Beta", "Zeta"]);
  });

  it("sorts by invoice date", () => {
    const sorted = sortReceivableRows(rows, "issueDate", "asc");
    expect(sorted.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });
});

describe("pagination", () => {
  it("paginates sorted receivable rows", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      receivableRow({
        id: String(i + 1),
        dueDate: new Date(`2026-08-0${i + 1}`),
        outstanding: (i + 1) * 1000,
      })
    );
    const sorted = sortReceivableRows(rows, "dueDate", "asc");
    const { skip, take, page, pageSize } = parsePagination({ page: "2", pageSize: "2" });
    const result = paginated(sorted.slice(skip, skip + take), sorted.length, page, pageSize);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.items.map((r) => r.id)).toEqual(["3", "4"]);
  });
});

describe("splitDetailedAgeingBuckets", () => {
  it("totals match ageing total", () => {
    const ageing = buildOutstandingAgeing(
      [
        ageingRow("UNPAID", 10000, 0, DUE_FUTURE),
        ageingRow("UNPAID", 20000, 0, DUE_PAST),
      ],
      NOW
    );
    const buckets = splitDetailedAgeingBuckets(ageing.rows);
    const sum =
      buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90plus;
    expect(sum).toBe(ageing.total);
  });
});
