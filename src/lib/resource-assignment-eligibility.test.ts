import { describe, it, expect, vi, beforeEach } from "vitest";

const { tripFindFirstMock, allocFindFirstMock } = vi.hoisted(() => ({
  tripFindFirstMock: vi.fn(),
  allocFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findFirst: tripFindFirstMock },
    indentAllocation: { findFirst: allocFindFirstMock },
  },
}));

import {
  assertDriverAvailableForIndentLine,
  assertVehicleAvailableForIndentLine,
  isResourceAssignmentConflictMessage,
} from "./resource-assignment-eligibility";

describe("resource-assignment-eligibility", () => {
  beforeEach(() => {
    tripFindFirstMock.mockReset();
    allocFindFirstMock.mockReset();
    tripFindFirstMock.mockResolvedValue(null);
    allocFindFirstMock.mockResolvedValue(null);
  });

  it("blocks driver when another trip is IN_TRANSIT", async () => {
    tripFindFirstMock.mockResolvedValue({
      id: "trip-other",
      lrNumber: "LR-99",
      status: "IN_TRANSIT",
      indent: { indentNumber: "IND-1" },
    });

    await expect(assertDriverAvailableForIndentLine("drv-1", "line-b", null)).rejects.toThrow(
      /Driver is already on trip LR-99 \(indent IND-1\) until delivery/
    );
    expect(tripFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: "drv-1",
          status: { notIn: expect.arrayContaining(["DELIVERED", "CANCELLED"]) },
        }),
      })
    );
  });

  it("allows driver when blocking trip is excluded via excludeTripId", async () => {
    tripFindFirstMock.mockResolvedValue(null);

    await expect(
      assertDriverAvailableForIndentLine("drv-1", "line-a", "trip-same")
    ).resolves.toBeUndefined();

    expect(tripFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "trip-same" },
        }),
      })
    );
  });

  it("blocks vehicle on active indent allocation on another line", async () => {
    allocFindFirstMock.mockResolvedValue({
      indent: { indentNumber: "IND-2", status: "DRIVER_ASSIGNED" },
      indentLine: { lineNumber: 1 },
    });

    await expect(assertVehicleAvailableForIndentLine("veh-1", "line-b", null)).rejects.toThrow(
      /Vehicle is already allocated on indent IND-2 \(vehicle slot 1\)/
    );
  });

  it("does not block when trip and allocation queries are empty", async () => {
    await expect(assertDriverAvailableForIndentLine("drv-1", "line-a", null)).resolves.toBeUndefined();
    await expect(assertVehicleAvailableForIndentLine("veh-1", "line-a", null)).resolves.toBeUndefined();
  });

  it("isResourceAssignmentConflictMessage detects conflict errors", () => {
    expect(isResourceAssignmentConflictMessage("Driver is already on trip LR-1 until delivery.")).toBe(
      true
    );
    expect(isResourceAssignmentConflictMessage("Vehicle is already allocated on indent IND-2.")).toBe(
      true
    );
    expect(isResourceAssignmentConflictMessage("Vendor must be allocated")).toBe(false);
  });
});
