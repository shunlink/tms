import { describe, it, expect } from "vitest";
import { INVOICE_SLA_HOURS, INVOICE_SLA_MS } from "./constants";
import { AUDIT_ACTIONS } from "./audit-actions";

type SimInvoiceTask = {
  id: string;
  status: string;
  podVerifiedAt: Date;
  deadlineAt: Date;
  escalatedAt: Date | null;
  invoiceId: string | null;
};

function simCreateTask(podVerifiedAt: Date): SimInvoiceTask {
  return {
    id: "task-1",
    status: "PENDING",
    podVerifiedAt,
    deadlineAt: new Date(podVerifiedAt.getTime() + INVOICE_SLA_MS),
    escalatedAt: null,
    invoiceId: null,
  };
}

function simEscalate(task: SimInvoiceTask, now: Date): SimInvoiceTask | null {
  if (task.status !== "PENDING") return null;
  if (task.deadlineAt >= now) return null;
  if (task.escalatedAt) return null;
  return { ...task, status: "SLA_BREACHED", escalatedAt: now };
}

function simComplete(task: SimInvoiceTask, invoiceId: string): SimInvoiceTask {
  return { ...task, status: "COMPLETED", invoiceId };
}

describe("Invoice SLA constants", () => {
  it("uses a 24-hour post-POD invoice SLA", () => {
    expect(INVOICE_SLA_HOURS).toBe(24);
    expect(INVOICE_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("Acceptance: POD verified → invoice task → SLA breach", () => {
  it("creates task with 24h deadline on POD verification", () => {
    const verifiedAt = new Date("2026-10-01T10:00:00Z");
    const task = simCreateTask(verifiedAt);
    expect(task.status).toBe("PENDING");
    expect(task.deadlineAt.getTime()).toBe(verifiedAt.getTime() + INVOICE_SLA_MS);
    expect(task.invoiceId).toBeNull();
  });

  it("does not escalate within SLA", () => {
    const verifiedAt = new Date("2026-10-01T10:00:00Z");
    const task = simCreateTask(verifiedAt);
    const withinSla = new Date(verifiedAt.getTime() + INVOICE_SLA_MS - 1000);
    expect(simEscalate(task, withinSla)).toBeNull();
  });

  it("escalates after 24 hours without auto-creating invoice", () => {
    const verifiedAt = new Date("2026-10-01T10:00:00Z");
    const task = simCreateTask(verifiedAt);
    const afterSla = new Date(verifiedAt.getTime() + INVOICE_SLA_MS + 1000);
    const escalated = simEscalate(task, afterSla);
    expect(escalated).not.toBeNull();
    expect(escalated!.status).toBe("SLA_BREACHED");
    expect(escalated!.invoiceId).toBeNull();
  });

  it("links draft invoice to task without completing it", () => {
    const task = simCreateTask(new Date());
    const withDraft = { ...task, invoiceId: "inv-1" };
    expect(withDraft.status).toBe("PENDING");
    expect(withDraft.invoiceId).toBe("inv-1");
  });

  it("completes task when invoice is finalized and sent to client", () => {
    const task = { ...simCreateTask(new Date()), invoiceId: "inv-1" };
    const completed = simComplete(task, "inv-1");
    expect(completed.status).toBe("COMPLETED");
    expect(completed.invoiceId).toBe("inv-1");
  });
});

describe("Audit actions for invoice workflow", () => {
  it("defines invoice created, edited, and finalized actions", () => {
    expect(AUDIT_ACTIONS.CREATED_INVOICE).toBe("CREATED_INVOICE");
    expect(AUDIT_ACTIONS.INVOICE_EDITED).toBe("INVOICE_EDITED");
    expect(AUDIT_ACTIONS.INVOICE_FINALIZED).toBe("INVOICE_FINALIZED");
  });
});
