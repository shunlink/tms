import { describe, expect, it } from "vitest";
import { isVendorEligibleForIndentOps } from "./vendor-onboarding-eligibility";

describe("isVendorEligibleForIndentOps", () => {
  it("allows vendors with no onboarding case (legacy)", () => {
    expect(isVendorEligibleForIndentOps(undefined)).toBe(true);
    expect(isVendorEligibleForIndentOps(null)).toBe(true);
  });

  it("allows APPROVED vendors", () => {
    expect(isVendorEligibleForIndentOps("APPROVED")).toBe(true);
  });

  it("blocks pending, submitted, and rejected vendors", () => {
    expect(isVendorEligibleForIndentOps("PENDING")).toBe(false);
    expect(isVendorEligibleForIndentOps("SUBMITTED")).toBe(false);
    expect(isVendorEligibleForIndentOps("REJECTED")).toBe(false);
  });
});
