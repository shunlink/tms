import { describe, expect, it } from "vitest";
import {
  canClientPerformPortalMutations,
  isClientPortalViewOnly,
  stripSignupLockedProfileFields,
} from "./portal-access";
import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";
import { parsePortalAccessIdentifier } from "./superadmin/portal-access-marker";

describe("client portal view-only", () => {
  it("allows mutations only when approved or actively onboarding", () => {
    expect(canClientPerformPortalMutations(ONBOARDING_CASE_STATUS.APPROVED)).toBe(true);
    expect(canClientPerformPortalMutations(ONBOARDING_CASE_STATUS.PENDING)).toBe(true);
    expect(canClientPerformPortalMutations(ONBOARDING_CASE_STATUS.PENDING_APPROVAL)).toBe(false);
    expect(isClientPortalViewOnly(ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION)).toBe(true);
  });
});

describe("stripSignupLockedProfileFields", () => {
  it("removes signup fields while onboarding is not approved", () => {
    const input = {
      name: "Acme",
      contactName: "Jane",
      phone: "9999999999",
      email: "jane@acme.com",
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
    };

    expect(stripSignupLockedProfileFields(input, "PENDING")).toEqual({
      contactName: "Jane",
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
    });
    expect(stripSignupLockedProfileFields(input, "SUBMITTED")).toEqual({
      contactName: "Jane",
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
    });
    expect(stripSignupLockedProfileFields(input, "REJECTED")).toEqual({
      contactName: "Jane",
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
    });
  });

  it("keeps signup fields after approval", () => {
    const input = {
      name: "Acme",
      contactName: "Jane",
      phone: "9999999999",
      email: "jane@acme.com",
      gstin: "27AAAAA0000A1Z5",
    };

    expect(stripSignupLockedProfileFields(input, "APPROVED")).toEqual(input);
  });
});

describe("parsePortalAccessIdentifier", () => {
  it("requires exact <= marker", () => {
    expect(parsePortalAccessIdentifier("<=employee@shunlink.in")).toMatchObject({
      ok: true,
      email: "employee@shunlink.in",
    });
    expect(parsePortalAccessIdentifier("<= employee@shunlink.in").ok).toBe(true);
    expect(parsePortalAccessIdentifier("employee@shunlink.in").ok).toBe(false);
  });
});
