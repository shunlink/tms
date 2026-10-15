import { describe, it, expect } from "vitest";
import {
  ADVANCE_SLA_MS,
  ADVANCE_SLA_HOURS,
  POD_SLA_MS,
  POD_SLA_HOURS,
  INVOICE_SLA_MS,
  INVOICE_SLA_HOURS,
  BALANCE_PAYMENT_SLA_MS,
  BALANCE_PAYMENT_SLA_HOURS,
} from "./constants";
import { SLA_TYPES, SLA_TARGET_TEAMS } from "./sla-types";

/** Simulates unified SLA breach detection using controlled timestamps. */
type SimSla = {
  type: string;
  status: string;
  startAt: Date;
  deadlineAt: Date;
  escalatedAt: Date | null;
};

function shouldBreach(task: SimSla, now: Date): boolean {
  return task.status === "ACTIVE" && task.deadlineAt < now && !task.escalatedAt;
}

function breach(task: SimSla, now: Date): SimSla {
  return { ...task, status: "BREACHED", escalatedAt: now };
}

describe("unified SLA durations", () => {
  it("advance request SLA is 24 hours", () => {
    expect(ADVANCE_SLA_HOURS).toBe(24);
    expect(ADVANCE_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("bad POD SLA is 24 hours", () => {
    expect(POD_SLA_HOURS).toBe(24);
    expect(POD_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("invoice SLA is 24 hours after POD verification", () => {
    expect(INVOICE_SLA_HOURS).toBe(24);
    expect(INVOICE_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("balance payment SLA is 96 hours after POD verification", () => {
    expect(BALANCE_PAYMENT_SLA_HOURS).toBe(96);
    expect(BALANCE_PAYMENT_SLA_HOURS).toBe(24 * 4);
    expect(BALANCE_PAYMENT_SLA_MS).toBe(96 * 60 * 60 * 1000);
  });
});

describe("unified SLA breach simulation", () => {
  const start = new Date("2026-01-01T00:00:00Z");

  it("breaches advance at 24h+1ms with controlled timestamp", () => {
    const task: SimSla = {
      type: SLA_TYPES.ADVANCE_REQUEST,
      status: "ACTIVE",
      startAt: start,
      deadlineAt: new Date(start.getTime() + ADVANCE_SLA_MS),
      escalatedAt: null,
    };
    const justBefore = new Date(task.deadlineAt.getTime() - 1);
    const justAfter = new Date(task.deadlineAt.getTime() + 1);
    expect(shouldBreach(task, justBefore)).toBe(false);
    expect(shouldBreach(task, justAfter)).toBe(true);
    expect(breach(task, justAfter).status).toBe("BREACHED");
  });

  it("breaches balance payment at 96h+1ms", () => {
    const task: SimSla = {
      type: SLA_TYPES.BALANCE_PAYMENT,
      status: "ACTIVE",
      startAt: start,
      deadlineAt: new Date(start.getTime() + BALANCE_PAYMENT_SLA_MS),
      escalatedAt: null,
    };
    const justAfter = new Date(task.deadlineAt.getTime() + 1);
    expect(shouldBreach(task, justAfter)).toBe(true);
  });

  it("does not re-escalate already breached tasks", () => {
    const task: SimSla = {
      type: SLA_TYPES.INVOICE,
      status: "ACTIVE",
      startAt: start,
      deadlineAt: new Date(start.getTime() + INVOICE_SLA_MS),
      escalatedAt: new Date(),
    };
    expect(shouldBreach(task, new Date())).toBe(false);
  });

  it("routes SLA types to correct teams", () => {
    expect(SLA_TARGET_TEAMS[SLA_TYPES.ADVANCE_REQUEST]).toBe("FINANCE");
    expect(SLA_TARGET_TEAMS[SLA_TYPES.BAD_POD]).toBe("OPERATIONS");
    expect(SLA_TARGET_TEAMS[SLA_TYPES.INVOICE]).toBe("FINANCE");
    expect(SLA_TARGET_TEAMS[SLA_TYPES.BALANCE_PAYMENT]).toBe("FINANCE");
  });
});
