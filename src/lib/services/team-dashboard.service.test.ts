import { describe, it, expect } from "vitest";
import { isAdminTeam } from "./team-dashboard.service";

describe("team-dashboard.service", () => {
  describe("isAdminTeam", () => {
    it("returns true for ADMIN team", () => {
      expect(isAdminTeam("ADMIN", "ADMIN")).toBe(true);
    });

    it("returns true for SUPER_ADMIN regardless of team", () => {
      expect(isAdminTeam("SALES", "SUPER_ADMIN")).toBe(true);
    });

    it("returns false for non-admin teams", () => {
      expect(isAdminTeam("SALES", "SALES")).toBe(false);
      expect(isAdminTeam("OPERATIONS", "OPERATIONS")).toBe(false);
      expect(isAdminTeam("FINANCE", "FINANCE")).toBe(false);
    });
  });
});
