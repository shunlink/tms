import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  indent: { findFirst: vi.fn(), update: vi.fn() },
  indentAllocation: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  indentLine: { update: vi.fn() },
  vendorQuote: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
};

vi.mock("../prisma", () => ({
  prisma: {
    indent: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../audit", () => ({ logAudit: vi.fn() }));

vi.mock("../indent-line-sync", () => ({
  reconcileIndentLines: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../vendor-onboarding-eligibility", () => ({
  assertVendorEligibleForIndentOps: vi.fn().mockResolvedValue(undefined),
}));

import { allocateVendorInTransaction } from "./allocation.service";

describe("allocateVendorInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.indentAllocation.findFirst.mockResolvedValue(null);
    tx.vendorQuote.findFirst.mockResolvedValue(null);
    tx.indentLine.update.mockResolvedValue({});
    tx.indentAllocation.create.mockResolvedValue({});
    tx.indent.update.mockResolvedValue({});
  });

  it("allocates from DRAFT under MANUAL mode without releaseIndentToVendors", async () => {
    tx.indent.findFirst.mockResolvedValue({
      id: "ind_1",
      indentNumber: "IND-1",
      status: "DRAFT",
      allocationMode: "MANUAL",
      vendorId: null,
      vehicleId: null,
      driverId: null,
      lines: [{ id: "line_1", tripId: null, status: "OPEN" }],
    });

    const result = await allocateVendorInTransaction(
      tx as never,
      "ind_1",
      { vendorId: "ven_1", vendorRate: 38000 },
      null
    );

    expect(result.vendorId).toBe("ven_1");
    expect(tx.indent.update).toHaveBeenCalledWith({
      where: { id: "ind_1" },
      data: expect.objectContaining({
        status: "PLACEMENT_PENDING",
        placementStatus: "PLACEMENT_PENDING",
        vendorId: "ven_1",
      }),
    });
    expect(tx.indentAllocation.create).toHaveBeenCalledTimes(1);
  });

  it("creates one active allocation per open line", async () => {
    tx.indent.findFirst.mockResolvedValue({
      id: "ind_1",
      indentNumber: "IND-1",
      status: "DRAFT",
      allocationMode: "MANUAL",
      vendorId: null,
      vehicleId: null,
      driverId: null,
      lines: [
        { id: "line_1", tripId: null, status: "OPEN" },
        { id: "line_2", tripId: null, status: "OPEN" },
      ],
    });

    await allocateVendorInTransaction(
      tx as never,
      "ind_1",
      { vendorId: "ven_1", vendorRate: 38000 },
      null
    );

    expect(tx.indentAllocation.create).toHaveBeenCalledTimes(2);
  });
});
