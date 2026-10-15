import { describe, it, expect } from "vitest";
import {
  buildBookingBuckets,
  buildIndentBuckets,
  bucketTotal,
  tripStartedCount,
  pendingPodCount,
  tripDeliveredCount,
  assertBucketsSumToTotal,
  TRIP_STATUSES,
} from "./dashboard-metrics";
import { INDENT_STATUSES } from "./indent-states";
import { ageBucket } from "./logic";

describe("dashboard-metrics", () => {
  it("booking buckets sum to trips total", () => {
    const tripStatus = {
      PENDING: 0,
      DISPATCHED: 1,
      IN_TRANSIT: 1,
      DELIVERED: 1,
      POD_RECEIVED: 0,
      INVOICED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };
    const buckets = buildBookingBuckets(tripStatus);
    const total = Object.values(tripStatus).reduce((a, b) => a + b, 0);
    expect(bucketTotal(buckets)).toBe(total);
    assertBucketsSumToTotal(buckets, total, "bookings");
    expect(tripStartedCount(tripStatus)).toBe(2);
    expect(pendingPodCount(tripStatus)).toBe(1);
    expect(tripDeliveredCount(tripStatus)).toBe(1);
  });

  it("indent buckets sum to indents total", () => {
    const indentStatus: Record<string, number> = {};
    for (const s of INDENT_STATUSES) indentStatus[s] = s === "DRAFT" ? 2 : 0;
    indentStatus.RELEASED_TO_VENDORS = 1;
    indentStatus.IN_TRANSIT = 1;
    const buckets = buildIndentBuckets(indentStatus);
    const total = Object.values(indentStatus).reduce((a, b) => a + b, 0);
    expect(bucketTotal(buckets)).toBe(total);
    assertBucketsSumToTotal(buckets, total, "indents");
  });

  it("covers all trip statuses exactly once", () => {
    const tripStatus: Record<string, number> = {};
    for (const s of TRIP_STATUSES) tripStatus[s] = 1;
    const buckets = buildBookingBuckets(tripStatus);
    expect(bucketTotal(buckets)).toBe(TRIP_STATUSES.length);
  });

  it("ageing buckets sum to invoice row balances", () => {
    const rows = [
      { balance: 1000, days: -5 },
      { balance: 2000, days: 15 },
      { balance: 500, days: 45 },
    ];
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    for (const r of rows) buckets[ageBucket(r.days)] += r.balance;
    const total = buckets.current + buckets.d30 + buckets.d60 + buckets.d90;
    expect(total).toBe(rows.reduce((s, r) => s + r.balance, 0));
  });

  it("covers all indent statuses exactly once", () => {
    const indentStatus: Record<string, number> = {};
    for (const s of INDENT_STATUSES) indentStatus[s] = 1;
    const buckets = buildIndentBuckets(indentStatus);
    expect(bucketTotal(buckets)).toBe(INDENT_STATUSES.length);
  });
});
