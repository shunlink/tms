import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from "../permissions";

describe("Phase 5 accounting permissions", () => {
  const phase5 = [
    "accounting.report.view",
    "accounting.report.export",
    "accounting.subledger.view",
    "accounting.reconcile.view",
    "accounting.reconcile.bank.import",
    "accounting.reconcile.bank.view",
    "accounting.reconcile.bank.match",
    "accounting.reconcile.gateway.import",
    "accounting.reconcile.export",
    "accounting.period.validate",
  ] as const;

  it("registers new permission keys", () => {
    for (const key of phase5) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it("grants finance role access to reports and subledgers", () => {
    const finance = new Set(DEFAULT_ROLE_PERMISSIONS.FINANCE);
    for (const key of phase5) {
      expect(finance.has(key)).toBe(true);
    }
  });
});
