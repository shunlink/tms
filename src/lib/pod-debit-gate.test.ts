import { describe, expect, it } from "vitest";
import { canPodTransition, POD_TRANSITIONS } from "./pod-states";
import { inferVendorNoteFromTripCharge } from "./financial-notes/purpose";

describe("bad POD resolution state machine", () => {
  it("allows BAD_POD → VERIFIED for mark-as-good only", () => {
    expect(POD_TRANSITIONS.BAD_POD).toContain("VERIFIED");
    expect(canPodTransition("BAD_POD", "VERIFIED")).toBe(true);
  });

  it("does not allow BAD_POD → PENDING_VERIFICATION", () => {
    expect(canPodTransition("BAD_POD", "PENDING_VERIFICATION")).toBe(false);
  });
});

describe("vendor deduction note type", () => {
  it("maps deduction to DEBIT_NOTE for vendor freight reduction", () => {
    const inferred = inferVendorNoteFromTripCharge("DEDUCTION");
    expect(inferred.noteType).toBe("DEBIT_NOTE");
    expect(inferred.businessPurpose).toBe("VENDOR_FREIGHT_REDUCTION");
  });

  it("maps detention to CREDIT_NOTE for vendor freight increase", () => {
    const inferred = inferVendorNoteFromTripCharge("DETENTION");
    expect(inferred.noteType).toBe("CREDIT_NOTE");
    expect(inferred.businessPurpose).toBe("VENDOR_FREIGHT_INCREASE");
  });
});
