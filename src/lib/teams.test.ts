import { describe, it, expect } from "vitest";
import { isInternalRole, isPortalRole, ROLE_DEFAULT_TEAM } from "./teams";

describe("teams", () => {
  it("includes VENDOR_TEAM as internal", () => {
    expect(isInternalRole("VENDOR_TEAM")).toBe(true);
    expect(isInternalRole("VENDOR")).toBe(false);
  });

  it("identifies portal roles", () => {
    expect(isPortalRole("CLIENT")).toBe(true);
    expect(isPortalRole("DRIVER")).toBe(true);
    expect(isPortalRole("FINANCE")).toBe(false);
  });

  it("maps internal roles to default teams", () => {
    expect(ROLE_DEFAULT_TEAM.FINANCE).toBe("FINANCE");
    expect(ROLE_DEFAULT_TEAM.VENDOR_TEAM).toBe("VENDOR_TEAM");
    expect(ROLE_DEFAULT_TEAM.SUPER_ADMIN).toBe("ADMIN");
  });
});
