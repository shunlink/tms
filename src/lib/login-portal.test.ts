import { describe, expect, it } from "vitest";
import { loginPortalFromLegacyQuery, roleMatchesLoginPortal } from "./login-portal";

describe("roleMatchesLoginPortal", () => {
  it("matches client and vendor roles", () => {
    expect(roleMatchesLoginPortal("CLIENT", "client")).toBe(true);
    expect(roleMatchesLoginPortal("VENDOR", "vendor")).toBe(true);
    expect(roleMatchesLoginPortal("CLIENT", "vendor")).toBe(false);
  });

  it("matches internal employee roles", () => {
    expect(roleMatchesLoginPortal("OPERATIONS", "employee")).toBe(true);
    expect(roleMatchesLoginPortal("CLIENT", "employee")).toBe(false);
  });

  it("maps legacy portal query values", () => {
    expect(loginPortalFromLegacyQuery("transporter")).toBe("vendor");
    expect(loginPortalFromLegacyQuery("employee")).toBe("employee");
  });
});
