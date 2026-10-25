import { describe, expect, it } from "vitest";
import {
  generatePortalPassword,
  getPortalPasswordValidationError,
  isValidPortalPassword,
} from "./portal-password";

describe("portal-password", () => {
  it("generates passwords that pass validation", () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generatePortalPassword();
      expect(pwd.length).toBeGreaterThanOrEqual(8);
      expect(isValidPortalPassword(pwd)).toBe(true);
    }
  });

  it("rejects weak passwords", () => {
    expect(getPortalPasswordValidationError("short1!")).toMatch(/8 characters/);
    expect(getPortalPasswordValidationError("alllowercase1!")).toMatch(/uppercase/);
    expect(getPortalPasswordValidationError("ALLUPPERCASE1!")).toMatch(/lowercase/);
    expect(getPortalPasswordValidationError("NoNumbers!!")).toMatch(/number/);
    expect(getPortalPasswordValidationError("NoSymbols12")).toMatch(/symbol/);
  });
});
