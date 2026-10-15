import { describe, expect, it } from "vitest";
import {
  assertCanRaiseAdvanceOnBehalf,
  buildOnBehalfEventRemarks,
  formatAdvanceRaisedByLabel,
  formatAdvanceSourceLabel,
} from "./advance-source";
import { isManagedAdvanceSource, MANAGED_ADVANCE_SOURCES } from "./constants";
import { internalAdvanceRaiseSchema } from "./validation";

describe("formatAdvanceSourceLabel", () => {
  it("labels internal, vendor, and external sources", () => {
    expect(formatAdvanceSourceLabel("INTERNAL")).toBe("Internal");
    expect(formatAdvanceSourceLabel("SHUNLINK")).toBe("Vendor");
    expect(formatAdvanceSourceLabel("EXTERNAL")).toBe("External");
  });
});

describe("formatAdvanceRaisedByLabel", () => {
  it("shows finance user for internal requests", () => {
    expect(formatAdvanceRaisedByLabel("INTERNAL", { name: "Vikram" })).toBe("Finance — Vikram");
  });

  it("shows vendor for portal requests", () => {
    expect(formatAdvanceRaisedByLabel("SHUNLINK", { name: "Vendor User" })).toBe("Vendor");
  });
});

describe("buildOnBehalfEventRemarks", () => {
  it("records on-behalf message for audit trail", () => {
    expect(buildOnBehalfEventRemarks("Acme Transport", "Vikram")).toBe(
      "Advance request raised on behalf of Acme Transport by Vikram"
    );
  });
});

describe("assertCanRaiseAdvanceOnBehalf", () => {
  it("allows internal staff", () => {
    expect(() =>
      assertCanRaiseAdvanceOnBehalf({ id: "u1", role: "FINANCE", name: "Vikram" })
    ).not.toThrow();
    expect(() =>
      assertCanRaiseAdvanceOnBehalf({ id: "u2", role: "ADMIN", name: "Admin" })
    ).not.toThrow();
    expect(() =>
      assertCanRaiseAdvanceOnBehalf({ id: "u3", role: "SUPER_ADMIN", name: "Super" })
    ).not.toThrow();
  });

  it("blocks vendor users", () => {
    expect(() =>
      assertCanRaiseAdvanceOnBehalf({ id: "v1", role: "VENDOR", vendorId: "vendor-1" })
    ).toThrow(/Vendor users cannot/);
  });

  it("blocks portal client users", () => {
    expect(() =>
      assertCanRaiseAdvanceOnBehalf({ id: "c1", role: "CLIENT", clientId: "client-1" })
    ).toThrow(/Unauthorized/);
  });
});

describe("MANAGED_ADVANCE_SOURCES", () => {
  it("includes SHUNLINK and INTERNAL workflow sources", () => {
    expect(MANAGED_ADVANCE_SOURCES).toContain("SHUNLINK");
    expect(MANAGED_ADVANCE_SOURCES).toContain("INTERNAL");
    expect(isManagedAdvanceSource("INTERNAL")).toBe(true);
    expect(isManagedAdvanceSource("EXTERNAL")).toBe(false);
  });
});

describe("internalAdvanceRaiseSchema", () => {
  it("requires trip, vendor, and positive amount", () => {
    const ok = internalAdvanceRaiseSchema.safeParse({
      tripId: "trip-1",
      vendorId: "vendor-1",
      amount: 20000,
      remarks: "Vendor cannot access portal",
    });
    expect(ok.success).toBe(true);

    const bad = internalAdvanceRaiseSchema.safeParse({
      tripId: "",
      vendorId: "vendor-1",
      amount: 0,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects non-positive amounts", () => {
    const result = internalAdvanceRaiseSchema.safeParse({
      tripId: "trip-1",
      vendorId: "vendor-1",
      amount: -100,
    });
    expect(result.success).toBe(false);
  });
});
