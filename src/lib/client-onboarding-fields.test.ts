import { describe, expect, it } from "vitest";
import {
  clientOnboardingFullProfileComplete,
  clientOnboardingMandatoryProfileComplete,
  validateClientOnboardingMandatoryProfile,
} from "./client-onboarding-fields";

const mandatoryBase = {
  gstin: "27AABCU9603R1ZM",
  pan: "AABCU9603R",
  bankName: "HDFC Bank",
  bankAccount: "1234567890",
  bankIfsc: "HDFC0001234",
  accountHolder: "Acme Pvt Ltd",
};

describe("validateClientOnboardingMandatoryProfile", () => {
  it("accepts valid mandatory fields", () => {
    const result = validateClientOnboardingMandatoryProfile(mandatoryBase);
    expect(result.ok).toBe(true);
  });

  it("rejects missing bank details", () => {
    const result = validateClientOnboardingMandatoryProfile({
      ...mandatoryBase,
      bankName: "",
    });
    expect(result.ok).toBe(false);
  });
});

describe("clientOnboardingMandatoryProfileComplete", () => {
  it("tracks mandatory completion separately from full profile", () => {
    expect(clientOnboardingMandatoryProfileComplete(mandatoryBase)).toBe(true);
    expect(clientOnboardingFullProfileComplete(mandatoryBase)).toBe(false);
  });
});
