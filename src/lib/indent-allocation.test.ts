import { describe, it, expect } from "vitest";
import {
  ALLOCATABLE_STATUSES_BIDDING,
  ALLOCATABLE_STATUSES_MANUAL,
  isAllocatableStatus,
} from "./indent-allocation";

describe("manual vendor allocation status gate", () => {
  it("allows manual allocation straight from Draft (regression: 'cannot be allocated')", () => {
    expect(isAllocatableStatus("MANUAL", "DRAFT")).toBe(true);
  });

  it("allows manual allocation across the whole pre-allocation finance queue", () => {
    for (const status of ["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING", "ADVANCE_PAID"]) {
      expect(isAllocatableStatus("MANUAL", status)).toBe(true);
    }
  });

  it("keeps manual allocation working once the indent is in the placement pipeline", () => {
    for (const status of ALLOCATABLE_STATUSES_BIDDING) {
      expect(ALLOCATABLE_STATUSES_MANUAL).toContain(status);
      expect(isAllocatableStatus("MANUAL", status)).toBe(true);
    }
  });

  it("never allows manual allocation after placement or in a terminal state", () => {
    for (const status of [
      "VEHICLE_PLACED",
      "DRIVER_ASSIGNED",
      "IN_TRANSIT",
      "COMPLETED",
      "CANCELLED",
    ]) {
      expect(isAllocatableStatus("MANUAL", status)).toBe(false);
    }
  });

  it("bidding allocation stays restricted to released/quoting/placed states", () => {
    expect(isAllocatableStatus("BIDDING", "DRAFT")).toBe(false);
    expect(isAllocatableStatus("BIDDING", "WAITING_FOR_ADVANCE")).toBe(false);
    expect(isAllocatableStatus("BIDDING", "ADVANCE_PAID")).toBe(false);
    expect(isAllocatableStatus("BIDDING", "RELEASED_TO_VENDORS")).toBe(true);
    expect(isAllocatableStatus("BIDDING", "QUOTING")).toBe(true);
  });

  it("treats a missing/unknown allocation mode as bidding (safe default)", () => {
    expect(isAllocatableStatus(null, "QUOTING")).toBe(true);
    expect(isAllocatableStatus(undefined, "DRAFT")).toBe(false);
  });
});
