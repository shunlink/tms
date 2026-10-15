import { describe, it, expect } from "vitest";
import { AUDIT_ACTIONS, formatAuditAction, AUDIT_ACTION_GROUPS } from "./audit-actions";

describe("audit-actions", () => {
  it("formats canonical actions with human labels", () => {
    expect(formatAuditAction(AUDIT_ACTIONS.APPROVED_ADVANCE)).toBe("Approved advance");
    expect(formatAuditAction(AUDIT_ACTIONS.POD_VERIFIED)).toBe("POD verified");
  });

  it("falls back for unknown actions", () => {
    expect(formatAuditAction("some.custom_action")).toBe("some custom action");
  });

  it("groups employee actions by function", () => {
    const all = AUDIT_ACTION_GROUPS.flatMap((g) => g.actions);
    expect(all).toContain(AUDIT_ACTIONS.EMPLOYEE_CREATED);
    expect(all).toContain(AUDIT_ACTIONS.CREATED_INVOICE);
    expect(all).toContain(AUDIT_ACTIONS.INVOICE_EDITED);
    expect(all).toContain(AUDIT_ACTIONS.INVOICE_FINALIZED);
    expect(all).toContain(AUDIT_ACTIONS.POD_VERIFICATION_FAILED);
  });
});
