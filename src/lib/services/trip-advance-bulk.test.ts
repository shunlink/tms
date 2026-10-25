import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    indent: { findFirst: vi.fn() },
    trip: { findMany: vi.fn() },
    advanceRequest: { findFirst: vi.fn() },
  },
}));

vi.mock("../prisma", () => ({ prisma: prismaMock }));

vi.mock("../advance-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../advance-limits")>();
  return actual;
});

import {
  splitBulkAdvanceAmounts,
  validateBulkShunLinkAdvanceItems,
  type BulkAdvanceEligibleTrip,
} from "./trip-advance.service";

describe("splitBulkAdvanceAmounts", () => {
  const eligible: BulkAdvanceEligibleTrip[] = [
    { tripId: "t1", lrNumber: "LR-1", route: "A → B", vendorRate: 100000, maxAdvance: 85000 },
    { tripId: "t2", lrNumber: "LR-2", route: "A → B", vendorRate: 100000, maxAdvance: 85000 },
  ];

  it("max split assigns each trip its cap", () => {
    const items = splitBulkAdvanceAmounts(eligible, "max");
    expect(items).toEqual([
      { tripId: "t1", requestedAmount: 85000 },
      { tripId: "t2", requestedAmount: 85000 },
    ]);
  });

  it("equal split distributes total within caps", () => {
    const items = splitBulkAdvanceAmounts(eligible, "equal", 100000);
    expect(items).toHaveLength(2);
    expect(items[0].requestedAmount + items[1].requestedAmount).toBe(100000);
  });

  it("rejects total above combined max", () => {
    expect(() => splitBulkAdvanceAmounts(eligible, "equal", 200000)).toThrow(/exceeds combined maximum/);
  });
});

describe("validateBulkShunLinkAdvanceItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects trip not on indent", async () => {
    prismaMock.trip.findMany.mockResolvedValue([
      { id: "t1", lrNumber: "LR-1", vendorRate: 100000, status: "IN_TRANSIT" },
    ]);

    await expect(
      validateBulkShunLinkAdvanceItems("ven_1", "ind_1", [
        { tripId: "t1", requestedAmount: 50000 },
        { tripId: "t2", requestedAmount: 50000 },
      ])
    ).rejects.toThrow(/not part of this indent/);
  });

  it("rejects delivered trips", async () => {
    prismaMock.trip.findMany.mockResolvedValue([
      { id: "t1", lrNumber: "LR-1", vendorRate: 100000, status: "DELIVERED" },
    ]);

    await expect(
      validateBulkShunLinkAdvanceItems("ven_1", "ind_1", [{ tripId: "t1", requestedAmount: 50000 }])
    ).rejects.toThrow(/before the trip is marked delivered/);
  });

  it("blocks when live advance exists", async () => {
    prismaMock.trip.findMany.mockResolvedValue([
      { id: "t1", lrNumber: "LR-1", vendorRate: 100000, status: "IN_TRANSIT" },
    ]);
    prismaMock.advanceRequest.findFirst.mockResolvedValue({ requestNumber: "ADV-1", status: "PENDING_REVIEW" });

    await expect(
      validateBulkShunLinkAdvanceItems("ven_1", "ind_1", [{ tripId: "t1", requestedAmount: 50000 }])
    ).rejects.toThrow(/already exists/);
  });
});
