import { describe, it, expect } from "vitest";
import { isRegisteredVendorCity, normalizeCityKey } from "./vendor-eligibility";

describe("vendor city normalization", () => {
  it("normalizes city keys case-insensitively", () => {
    expect(normalizeCityKey("Mumbai")).toBe("mumbai");
    expect(normalizeCityKey("  MUMBAI  ")).toBe("mumbai");
  });

  it("rejects placeholder cities", () => {
    expect(isRegisteredVendorCity("Pune")).toBe(true);
    expect(isRegisteredVendorCity("—")).toBe(false);
    expect(isRegisteredVendorCity("")).toBe(false);
  });
});
