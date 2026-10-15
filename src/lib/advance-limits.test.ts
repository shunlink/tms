import { describe, it, expect } from "vitest";
import {
  maxAdvanceForVendorRate,
  assertAdvanceWithinFreightCap,
  advanceCapErrorMessage,
} from "./advance-limits";

describe("advance freight cap (85% of vendorRate)", () => {
  it("computes max advance as 85% of vendor freight", () => {
    expect(maxAdvanceForVendorRate(100_000)).toBe(85_000);
    expect(maxAdvanceForVendorRate(50_000)).toBe(42_500);
  });

  it("rejects amounts above 85% of vendorRate", () => {
    expect(() => assertAdvanceWithinFreightCap(90_000, 100_000)).toThrow(/85%/);
    expect(advanceCapErrorMessage(100_000)).toMatch(/85,000/);
  });

  it("allows amounts at or below the cap", () => {
    expect(() => assertAdvanceWithinFreightCap(85_000, 100_000)).not.toThrow();
    expect(() => assertAdvanceWithinFreightCap(50_000, 100_000)).not.toThrow();
  });
});
