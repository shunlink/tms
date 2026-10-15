import { describe, it, expect } from "vitest";
import { EVENT_TARGET_TEAM, targetTeamForEventType } from "./team-event-routing";

describe("team-event-routing", () => {
  it("maps finance event types to FINANCE team", () => {
    expect(targetTeamForEventType("INVOICE_PENDING")).toBe("FINANCE");
    expect(targetTeamForEventType("ADVANCE_SLA_BREACHED")).toBe("FINANCE");
  });

  it("maps POD events to FINANCE and placement events to OPERATIONS", () => {
    expect(targetTeamForEventType("POD_PENDING")).toBe("FINANCE");
    expect(targetTeamForEventType("ALLOCATION_PLACEMENT_DEADLINE")).toBe("OPERATIONS");
    expect(targetTeamForEventType("POD_SLA_BREACHED")).toBe("FINANCE");
  });

  it("maps balance payment events to FINANCE team", () => {
    expect(targetTeamForEventType("BALANCE_PAYMENT_PENDING")).toBe("FINANCE");
    expect(targetTeamForEventType("BALANCE_PAYMENT_SLA_BREACHED")).toBe("FINANCE");
  });

  it("returns null for unknown event types", () => {
    expect(targetTeamForEventType("UNKNOWN_EVENT")).toBeNull();
  });

  it("covers all defined event types", () => {
    expect(Object.keys(EVENT_TARGET_TEAM).length).toBeGreaterThan(0);
  });
});
