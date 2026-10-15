import { describe, it, expect } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";
import { filterNavGroups, getTeamSidebarHrefs, TEAM_NAV_HREFS } from "./nav-permissions";

describe("team sidebar navigation", () => {
  it("Finance sidebar contains operations and finance pages", () => {
    const hrefs = getTeamSidebarHrefs(DEFAULT_ROLE_PERMISSIONS.FINANCE, "FINANCE", "FINANCE");
    expect(hrefs).toEqual([
      "/",
      "/indents",
      "/trips",
      "/invoices",
      "/receivables",
      "/payables",
      "/client-payments",
      "/payments",
      "/pods",
      "/accounting/journals",
      "/accounting/periods",
      "/accounting/reports",
      "/accounting/subledgers/vendors",
      "/accounting/subledgers/clients",
      "/financial-notes",
    ]);
  });

  it("Operations sidebar does not include Bidding System", () => {
    const hrefs = getTeamSidebarHrefs(DEFAULT_ROLE_PERMISSIONS.OPERATIONS, "OPERATIONS", "OPERATIONS");
    expect(hrefs).not.toContain("/bidding-management");
  });

  it("Operations sidebar contains operations and partner fleet pages", () => {
    const hrefs = getTeamSidebarHrefs(DEFAULT_ROLE_PERMISSIONS.OPERATIONS, "OPERATIONS", "OPERATIONS");
    expect(hrefs).toEqual([
      "/",
      "/indents",
      "/placement",
      "/onboarding",
      "/requirements",
      "/trips",
      "/vendors",
      "/vehicles",
      "/drivers",
    ]);
  });

  it("Sales sidebar contains dashboard, indents, and requirements only", () => {
    const hrefs = getTeamSidebarHrefs(DEFAULT_ROLE_PERMISSIONS.SALES, "SALES", "SALES");
    expect(hrefs).toEqual(["/", "/indents", "/requirements"]);
  });

  it("Admin sidebar includes partners, finance, and employees but not roles & permissions", () => {
    const hrefs = getTeamSidebarHrefs(DEFAULT_ROLE_PERMISSIONS.ADMIN, "ADMIN", "ADMIN");
    expect(hrefs).toContain("/clients");
    expect(hrefs).toContain("/vendors");
    expect(hrefs).toContain("/drivers");
    expect(hrefs).toContain("/vehicles");
    expect(hrefs).toContain("/invoices");
    expect(hrefs).toContain("/receivables");
    expect(hrefs).toContain("/payables");
    expect(hrefs).toContain("/client-payments");
    expect(hrefs).toContain("/payments");
    expect(hrefs).toContain("/financial-notes");
    expect(hrefs).not.toContain("/accounting/chart-of-accounts");
    expect(hrefs).not.toContain("/accounting/reconciliation");
    expect(hrefs).not.toContain("/advance-payments");
    expect(hrefs).not.toContain("/balance-payments");
    expect(hrefs).toContain("/users");
    expect(hrefs).toContain("/bidding-management");
    expect(hrefs).not.toContain("/permissions");
  });

  it("Super Admin sees roles & permissions and users", () => {
    const hrefs = getTeamSidebarHrefs(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN, "ADMIN", "SUPER_ADMIN");
    expect(hrefs).toContain("/permissions");
    expect(hrefs).toContain("/users");
  });

  it("filters empty groups from Finance team nav", () => {
    const groups = filterNavGroups(DEFAULT_ROLE_PERMISSIONS.FINANCE, {
      teamCode: "FINANCE",
      role: "FINANCE",
    });
    expect(groups.map((g) => g.title)).toEqual(["Overview", "Operations", "Finance"]);
  });

  it("filters empty groups from Operations team nav", () => {
    const groups = filterNavGroups(DEFAULT_ROLE_PERMISSIONS.OPERATIONS, {
      teamCode: "OPERATIONS",
      role: "OPERATIONS",
    });
    expect(groups.map((g) => g.title)).toEqual(["Overview", "Operations", "Partners"]);
  });

  it("filters empty groups from Sales team nav", () => {
    const groups = filterNavGroups(DEFAULT_ROLE_PERMISSIONS.SALES, {
      teamCode: "SALES",
      role: "SALES",
    });
    expect(groups.map((g) => g.title)).toEqual(["Overview", "Operations"]);
  });

  it("documents team nav href configs", () => {
    expect(TEAM_NAV_HREFS.FINANCE).toBeDefined();
    expect(TEAM_NAV_HREFS.OPERATIONS).toBeDefined();
    expect(TEAM_NAV_HREFS.SALES).toBeDefined();
  });

  it("finance nav items expose pending count keys", () => {
    const finance = filterNavGroups(DEFAULT_ROLE_PERMISSIONS.FINANCE, {
      teamCode: "FINANCE",
      role: "FINANCE",
    }).find((g) => g.title === "Finance");
    const keys = finance?.items.map((i) => i.pendingCountKey).filter(Boolean);
    expect(keys).toEqual(["invoices", "clientPayments", "vendorPayments", "pods"]);
  });
});
