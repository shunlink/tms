import { describe, expect, it } from "vitest";
import type { VendorSubledgerLine } from "./vendor-subledger.service";

function filterOperational(lines: VendorSubledgerLine[]): VendorSubledgerLine[] {
  return lines.filter((l) => l.postingLayer === "OPERATIONAL");
}

describe("vendor subledger operational view", () => {
  it("drops GL mirror lines from running balance", () => {
    const lines: VendorSubledgerLine[] = [
      {
        id: "1",
        effectiveDate: new Date("2026-10-24"),
        documentType: "PAYABLE_COMMERCIAL_APPROVED",
        reference: "LR-1",
        description: "Approved",
        indentId: null,
        tripId: "t1",
        debitMinor: 0,
        creditMinor: 4700000,
        runningBalanceMinor: 0,
        sourceType: "VendorTripPayable",
        sourceId: "p1",
        journalEntryId: null,
        journalNumber: null,
        postingLayer: "OPERATIONAL",
        paymentStatus: null,
      },
      {
        id: "2",
        effectiveDate: new Date("2026-10-24"),
        documentType: "GL_POSTING",
        reference: "JRN-1",
        description: "GL duplicate",
        indentId: null,
        tripId: "t1",
        debitMinor: 0,
        creditMinor: 4700000,
        runningBalanceMinor: 0,
        sourceType: "VENDOR_TRIP_PAYABLE",
        sourceId: "p1",
        journalEntryId: "j1",
        journalNumber: "JRN-1",
        postingLayer: "POSTED_GL",
        paymentStatus: null,
      },
    ];
    const operational = filterOperational(lines);
    expect(operational).toHaveLength(1);
    expect(operational[0].documentType).toBe("PAYABLE_COMMERCIAL_APPROVED");
  });
});
