import { describe, it, expect } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS } from "./permissions";
import {
  isRoleAllowedForTeam,
  validateEmployeeAssignment,
  TEAM_ALLOWED_ROLES,
} from "./teams";

describe("RBAC role permissions", () => {
  it("SUPER_ADMIN has all permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toEqual([...PERMISSION_KEYS]);
  });

  it("FINANCE has separate payment approve and process permissions", () => {
    const finance = new Set(DEFAULT_ROLE_PERMISSIONS.FINANCE);
    expect(finance.has("payment.approve")).toBe(true);
    expect(finance.has("payment.process")).toBe(true);
  });

  it("FINANCE can create indents, allocate, and verify POD but cannot edit trips", () => {
    const finance = new Set(DEFAULT_ROLE_PERMISSIONS.FINANCE);
    expect(finance.has("indent.create")).toBe(true);
    expect(finance.has("indent.allocate")).toBe(true);
    expect(finance.has("placement.update")).toBe(true);
    expect(finance.has("pod.approve")).toBe(true);
    expect(finance.has("pod.manage")).toBe(true);
    expect(finance.has("trip.edit")).toBe(false);
  });

  it("OPERATIONS cannot process finance payments", () => {
    const ops = new Set(DEFAULT_ROLE_PERMISSIONS.OPERATIONS);
    expect(ops.has("payment.create")).toBe(false);
    expect(ops.has("payment.process")).toBe(false);
    expect(ops.has("invoice.create")).toBe(false);
    expect(ops.has("advance.markPaid")).toBe(false);
    expect(ops.has("advance.process")).toBe(false);
  });

  it("SALES cannot access sensitive finance operations", () => {
    const sales = new Set(DEFAULT_ROLE_PERMISSIONS.SALES);
    expect(sales.has("invoice.view")).toBe(false);
    expect(sales.has("payment.view")).toBe(false);
    expect(sales.has("advance.decide")).toBe(false);
    expect(sales.has("client.payment.manage")).toBe(false);
    expect(sales.has("users.manage")).toBe(false);
  });

  it("ADMIN can access employee management and audit", () => {
    const admin = new Set(DEFAULT_ROLE_PERMISSIONS.ADMIN);
    expect(admin.has("users.manage")).toBe(true);
    expect(admin.has("team.manage")).toBe(true);
    expect(admin.has("audit.view")).toBe(true);
    expect(admin.has("events.manage")).toBe(true);
    expect(admin.has("invoice.create")).toBe(true);
    expect(admin.has("payment.process")).toBe(true);
  });

  it("portal roles are unchanged", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.VENDOR).toEqual(["quote.view", "quote.submit", "advance.request"]);
    expect(DEFAULT_ROLE_PERMISSIONS.CLIENT).toEqual(["requirement.create", "requirement.view"]);
    expect(DEFAULT_ROLE_PERMISSIONS.DRIVER).toEqual(["pod.upload", "tracking.post"]);
  });
});

describe("team assignment validation", () => {
  it("maps roles to allowed teams", () => {
    expect(isRoleAllowedForTeam("FINANCE", "FINANCE")).toBe(true);
    expect(isRoleAllowedForTeam("OPERATIONS", "FINANCE")).toBe(false);
    expect(isRoleAllowedForTeam("ADMIN", "ADMIN")).toBe(true);
    expect(isRoleAllowedForTeam("SUPER_ADMIN", "ADMIN")).toBe(true);
  });

  it("requires team for internal employees", () => {
    const result = validateEmployeeAssignment({ role: "FINANCE" }, "ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("team");
  });

  it("prevents non-super-admin from assigning SUPER_ADMIN", () => {
    const result = validateEmployeeAssignment(
      { role: "SUPER_ADMIN", teamCode: "ADMIN" },
      "ADMIN"
    );
    expect(result.ok).toBe(false);
  });

  it("portal users cannot have teams", () => {
    const result = validateEmployeeAssignment(
      { role: "VENDOR", teamId: "team-1", vendorId: "v1" },
      "ADMIN"
    );
    expect(result.ok).toBe(false);
  });

  it("each team allows only its roles", () => {
    for (const [team, roles] of Object.entries(TEAM_ALLOWED_ROLES)) {
      expect(roles.length).toBeGreaterThan(0);
      expect(isRoleAllowedForTeam("OPERATIONS", team)).toBe(team === "OPERATIONS");
    }
  });
});
