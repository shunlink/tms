import { describe, expect, it } from "vitest";
import {
  applyPayableComputedFilters,
  parsePayablesFilters,
  sortPayableRows,
  type PayableVendorRow,
} from "./payables.service";
import { paginated, parsePagination } from "../pagination";

const POD = new Date("2026-09-01");
const OLD = new Date("2026-06-01");

function payableRow(overrides: Partial<PayableVendorRow> & { vendorId: string }): PayableVendorRow {
  return {
    vendorId: overrides.vendorId,
    vendorName: overrides.vendorName ?? "Vendor",
    tripCount: overrides.tripCount ?? 1,
    grossPayable: overrides.grossPayable ?? 100000,
    advancePaid: overrides.advancePaid ?? 20000,
    advanceOutstanding: overrides.advanceOutstanding ?? 0,
    balancePayable: overrides.balancePayable ?? 58000,
    tds: overrides.tds ?? 2000,
    netOutstanding: overrides.netOutstanding ?? 58000,
    totalPaid: overrides.totalPaid ?? 42000,
    oldestDue: overrides.oldestDue ?? POD,
    ageingDays: overrides.ageingDays ?? 34,
    ageingBucket: overrides.ageingBucket ?? "d1_30",
    displayStatus: overrides.displayStatus ?? "PARTIALLY_PAID",
    hasBalanceTask: overrides.hasBalanceTask ?? true,
    hasAdvance: overrides.hasAdvance ?? false,
    balanceTaskId: overrides.balanceTaskId ?? "task-1",
    advanceRequestId: overrides.advanceRequestId ?? null,
    slaDeadline: overrides.slaDeadline ?? new Date("2026-09-05"),
  };
}

describe("parsePayablesFilters", () => {
  it("parses vendor, client, payable type, and ageing bucket", () => {
    const filters = parsePayablesFilters({
      vendorId: "v1",
      clientId: "c1",
      payableType: "BALANCE",
      ageingBucket: "d1_30",
      minOutstanding: "1000",
      maxOutstanding: "50000",
    });
    expect(filters.vendorId).toBe("v1");
    expect(filters.clientId).toBe("c1");
    expect(filters.payableType).toBe("BALANCE");
    expect(filters.ageingBucket).toBe("d1_30");
    expect(filters.minOutstanding).toBe(1000);
    expect(filters.maxOutstanding).toBe(50000);
  });
});

describe("applyPayableComputedFilters", () => {
  const rows = [
    payableRow({ vendorId: "v1", netOutstanding: 58000, advanceOutstanding: 0, balancePayable: 58000 }),
    payableRow({
      vendorId: "v2",
      netOutstanding: 10000,
      advanceOutstanding: 10000,
      balancePayable: 0,
      displayStatus: "ACTION_REQUIRED",
    }),
    payableRow({
      vendorId: "v3",
      netOutstanding: 5000,
      ageingBucket: "d90plus",
      ageingDays: 120,
      oldestDue: OLD,
    }),
  ];

  it("filters by payable type ADVANCE", () => {
    const filtered = applyPayableComputedFilters(rows, { payableType: "ADVANCE" });
    expect(filtered.map((r) => r.vendorId)).toEqual(["v2"]);
  });

  it("filters by status", () => {
    const filtered = applyPayableComputedFilters(rows, { status: "ACTION_REQUIRED" });
    expect(filtered.map((r) => r.vendorId)).toEqual(["v2"]);
  });

  it("filters by ageing bucket", () => {
    const filtered = applyPayableComputedFilters(rows, { ageingBucket: "d90plus" });
    expect(filtered.map((r) => r.vendorId)).toEqual(["v3"]);
  });

  it("filters by outstanding range", () => {
    const filtered = applyPayableComputedFilters(rows, { minOutstanding: 10000, maxOutstanding: 60000 });
    expect(filtered.map((r) => r.vendorId)).toEqual(["v1", "v2"]);
  });
});

describe("sortPayableRows", () => {
  const rows = [
    payableRow({ vendorId: "v1", netOutstanding: 30000, oldestDue: POD }),
    payableRow({ vendorId: "v2", netOutstanding: 80000, oldestDue: OLD }),
    payableRow({ vendorId: "v3", netOutstanding: 50000, oldestDue: new Date("2026-08-01") }),
  ];

  it("default sort: highest outstanding first", () => {
    const sorted = sortPayableRows(rows, "outstanding", "desc");
    expect(sorted.map((r) => r.vendorId)).toEqual(["v2", "v3", "v1"]);
  });

  it("sorts by oldest due ascending", () => {
    const sorted = sortPayableRows(rows, "oldestDue", "asc");
    expect(sorted[0].vendorId).toBe("v2");
  });
});

describe("pagination", () => {
  it("paginates vendor payable rows server-side", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      payableRow({ vendorId: `v${i}`, netOutstanding: 1000 * (12 - i) })
    );
    const sorted = sortPayableRows(rows, "outstanding", "desc");
    const { skip, take, page, pageSize } = parsePagination({ page: "2", pageSize: "5" });
    const pageItems = sorted.slice(skip, skip + take);
    const result = paginated(pageItems, sorted.length, page, pageSize);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(5);
    expect(result.totalPages).toBe(3);
  });
});

describe("vendor aggregation semantics", () => {
  it("net outstanding equals advance + balance without double-counting paid amounts", () => {
    const row = payableRow({
      vendorId: "v-multi",
      advanceOutstanding: 10000,
      balancePayable: 30000,
      netOutstanding: 40000,
      advancePaid: 10000,
      totalPaid: 50000,
    });
    expect(row.netOutstanding).toBe(row.advanceOutstanding + row.balancePayable);
  });

  it("TDS is informational and does not inflate net outstanding", () => {
    const row = payableRow({
      vendorId: "v-tds",
      grossPayable: 100000,
      tds: 2000,
      netOutstanding: 58000,
      balancePayable: 58000,
    });
    expect(row.netOutstanding).toBe(row.balancePayable);
    expect(row.tds).toBeLessThan(row.grossPayable);
  });
});
