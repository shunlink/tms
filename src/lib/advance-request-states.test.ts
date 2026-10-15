import { describe, it, expect } from "vitest";
import {
  canAdvanceRequestTransition,
  assertAdvanceRequestTransition,
} from "./advance-request-states";

describe("Advance request state machine", () => {
  it("supports direct approval flow", () => {
    expect(canAdvanceRequestTransition("PENDING_REVIEW", "APPROVED")).toBe(true);
    expect(canAdvanceRequestTransition("APPROVED", "PROCESSING")).toBe(true);
    expect(canAdvanceRequestTransition("PROCESSING", "PROCESSED")).toBe(true);
  });

  it("supports negotiation flow", () => {
    expect(canAdvanceRequestTransition("PENDING_REVIEW", "NEGOTIATED")).toBe(true);
    expect(canAdvanceRequestTransition("NEGOTIATED", "VENDOR_ACCEPTED")).toBe(true);
    expect(canAdvanceRequestTransition("VENDOR_ACCEPTED", "PROCESSING")).toBe(true);
  });

  it("supports SLA breach escalation", () => {
    expect(canAdvanceRequestTransition("PENDING_REVIEW", "SLA_BREACHED")).toBe(true);
    expect(canAdvanceRequestTransition("SLA_BREACHED", "PROCESSING")).toBe(true);
  });

  it("allows every status the SLA escalator picks up to breach", () => {
    for (const status of ["PENDING_REVIEW", "NEGOTIATED", "VENDOR_ACCEPTED", "APPROVED"]) {
      expect(canAdvanceRequestTransition(status, "SLA_BREACHED")).toBe(true);
    }
  });

  it("rejects invalid transitions", () => {
    expect(() => assertAdvanceRequestTransition("PROCESSED", "PROCESSING")).toThrow(/Invalid advance request transition/);
    expect(() => assertAdvanceRequestTransition("NEGOTIATED", "PROCESSING")).toThrow(/Invalid advance request transition/);
  });
});
