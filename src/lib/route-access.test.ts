import { describe, it, expect } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";
import {
  canAccessHref,
  normalizePathname,
  parseRefererPath,
  resolveDeniedRedirectTarget,
} from "./route-access";

const financeCtx = {
  granted: DEFAULT_ROLE_PERMISSIONS.FINANCE,
  teamCode: "FINANCE" as const,
  role: "FINANCE",
  accessMode: "INHERIT_ROLE" as const,
};

describe("normalizePathname", () => {
  it("strips query and trailing slash", () => {
    expect(normalizePathname("/indents/?foo=1")).toBe("/indents");
    expect(normalizePathname("/")).toBe("/");
  });
});

describe("canAccessHref", () => {
  it("finance inherit: indents allowed, settings and users denied", () => {
    expect(canAccessHref("/indents", financeCtx)).toBe(true);
    expect(canAccessHref("/indents/abc-123", financeCtx)).toBe(true);
    expect(canAccessHref("/settings", financeCtx)).toBe(false);
    expect(canAccessHref("/users", financeCtx)).toBe(false);
    expect(canAccessHref("/invoices", financeCtx)).toBe(true);
  });

  it("custom roles: no team menu — invoice only cannot open indents", () => {
    const ctx = {
      granted: ["dashboard.view", "invoice.view", "invoice.create"],
      teamCode: "FINANCE" as const,
      role: "FINANCE",
      accessMode: "CUSTOM_ROLES" as const,
    };
    expect(canAccessHref("/invoices", ctx)).toBe(true);
    expect(canAccessHref("/indents", ctx)).toBe(false);
    expect(canAccessHref("/indents/xyz", ctx)).toBe(false);
  });

  it("prefix: accounting journal detail inherits journal permission", () => {
    expect(canAccessHref("/accounting/journals/j-1", financeCtx)).toBe(true);
  });

  it("/indents/new requires indent.create", () => {
    const viewOnly = {
      granted: ["dashboard.view", "indent.view"],
      teamCode: "OPERATIONS" as const,
      role: "OPERATIONS",
      accessMode: "INHERIT_ROLE" as const,
    };
    expect(canAccessHref("/indents", viewOnly)).toBe(true);
    expect(canAccessHref("/indents/new", viewOnly)).toBe(false);

    const creator = {
      granted: ["dashboard.view", "indent.view", "indent.create"],
      teamCode: "OPERATIONS" as const,
      role: "OPERATIONS",
      accessMode: "INHERIT_ROLE" as const,
    };
    expect(canAccessHref("/indents/new", creator)).toBe(true);
  });

  it("finance trip finance page allows payment or invoice view", () => {
    expect(canAccessHref("/finance/trips/trip-1", financeCtx)).toBe(true);
    const invoiceOnly = {
      granted: ["dashboard.view", "invoice.view"],
      teamCode: "FINANCE" as const,
      role: "FINANCE",
      accessMode: "CUSTOM_ROLES" as const,
    };
    expect(canAccessHref("/finance/trips/trip-1", invoiceOnly)).toBe(true);
  });

  it("super bypass allows settings security", () => {
    expect(
      canAccessHref("/settings/security", { ...financeCtx, superBypass: true })
    ).toBe(true);
  });

  it("unknown paths are denied", () => {
    expect(canAccessHref("/totally-unknown", financeCtx)).toBe(false);
  });
});

describe("parseRefererPath", () => {
  it("accepts same-origin referer paths", () => {
    expect(parseRefererPath("http://localhost:3000/invoices", "http://localhost:3000")).toBe(
      "/invoices"
    );
  });

  it("rejects external referer", () => {
    expect(parseRefererPath("https://evil.example/invoices", "http://localhost:3000")).toBe(null);
  });
});

describe("resolveDeniedRedirectTarget", () => {
  it("prefers allowed same-origin referer", () => {
    const target = resolveDeniedRedirectTarget(financeCtx, {
      referer: "http://localhost:3000/invoices",
      origin: "http://localhost:3000",
    });
    expect(target).toBe("/invoices");
  });

  it("falls back to dashboard when referer is not allowed", () => {
    const target = resolveDeniedRedirectTarget(financeCtx, {
      referer: "http://localhost:3000/settings",
      origin: "http://localhost:3000",
    });
    expect(target).toBe("/");
  });
});
