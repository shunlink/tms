import { describe, expect, it } from "vitest";
import { stripSignupLockedProfileFields } from "./portal-access";
import { parsePortalAccessIdentifier } from "./superadmin/portal-access-marker";

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
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
    });
    expect(stripSignupLockedProfileFields(input, "SUBMITTED")).toEqual({
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
    });
    expect(stripSignupLockedProfileFields(input, "REJECTED")).toEqual({
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
