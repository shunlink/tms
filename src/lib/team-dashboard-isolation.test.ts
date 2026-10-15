import { describe, it, expect } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";
import { EVENT_TARGET_TEAM } from "./team-event-routing";

describe("dashboard permission isolation", () => {
  it("SALES cannot view finance SLA permissions", () => {
    const sales = new Set(DEFAULT_ROLE_PERMISSIONS.SALES);
    expect(sales.has("advance.view")).toBe(false);
    expect(sales.has("invoice.view")).toBe(false);
    expect(sales.has("payment.view")).toBe(false);
  });

  it("OPERATIONS cannot view finance payment permissions", () => {
    const ops = new Set(DEFAULT_ROLE_PERMISSIONS.OPERATIONS);
    expect(ops.has("payment.process")).toBe(false);
    expect(ops.has("invoice.create")).toBe(false);
    expect(ops.has("advance.decide")).toBe(false);
  });

  it("FINANCE can approve PODs; OPERATIONS cannot", () => {
    const finance = new Set(DEFAULT_ROLE_PERMISSIONS.FINANCE);
    const ops = new Set(DEFAULT_ROLE_PERMISSIONS.OPERATIONS);
    expect(finance.has("pod.approve")).toBe(true);
    expect(finance.has("pod.manage")).toBe(true);
    expect(ops.has("pod.approve")).toBe(false);
    expect(ops.has("pod.manage")).toBe(false);
  });

  it("finance events route to FINANCE team only", () => {
    expect(EVENT_TARGET_TEAM.INVOICE_PENDING).toBe("FINANCE");
    expect(EVENT_TARGET_TEAM.BALANCE_PAYMENT_SLA_BREACHED).toBe("FINANCE");
    expect(EVENT_TARGET_TEAM.ADVANCE_SLA_BREACHED).toBe("FINANCE");
  });

  it("POD events route to FINANCE; placement events route to OPERATIONS", () => {
    expect(EVENT_TARGET_TEAM.POD_PENDING).toBe("FINANCE");
    expect(EVENT_TARGET_TEAM.POD_SLA_BREACHED).toBe("FINANCE");
    expect(EVENT_TARGET_TEAM.POD_REJECTED).toBe("FINANCE");
    expect(EVENT_TARGET_TEAM.ALLOCATION_PLACEMENT_DEADLINE).toBe("OPERATIONS");
  });
});
