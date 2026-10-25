import { describe, expect, it } from "vitest";
import { assertBalancedJournal } from "../accounting/posting-validation";
import { buildFinancialNoteJournalLines } from "./posting-rules";
import { computeNoteTotals } from "./calculations";
import { canTransitionNote, isNoteEditable } from "./lifecycle";
import { inferVendorNoteFromTripCharge } from "./purpose";
import { getFinancialNotePolicy, noteRequiresApproval } from "./policy";

describe("financial note lifecycle", () => {
  it("allows draft to pending approval and issued only from approved", () => {
    expect(canTransitionNote("DRAFT", "PENDING_APPROVAL")).toBe(true);
    expect(canTransitionNote("APPROVED", "ISSUED")).toBe(true);
    expect(canTransitionNote("ISSUED", "DRAFT")).toBe(false);
    expect(isNoteEditable("DRAFT")).toBe(true);
    expect(isNoteEditable("ISSUED")).toBe(false);
  });
});

describe("financial note totals", () => {
  it("sums lines with tax", () => {
    const totals = computeNoteTotals([
      { amount: 1000, taxRate: 0.12 },
      { amount: 500, taxAmount: 0 },
    ]);
    expect(totals.taxableAmount).toBe(1500);
    expect(totals.taxAmount).toBe(120);
    expect(totals.totalAmount).toBe(1620);
  });
});

describe("financial note posting rules", () => {
  it("builds balanced vendor freight increase journal", () => {
    const lines = buildFinancialNoteJournalLines({
      noteId: "n1",
      noteNumber: "DBN-2026-0001",
      businessPurpose: "VENDOR_FREIGHT_INCREASE",
      counterpartyType: "VENDOR",
      vendorId: "v1",
      tripId: "t1",
      taxableAmountInr: 1000,
      taxAmountInr: 0,
      totalAmountInr: 1000,
      currency: "INR",
      includeSubledgerAmount: true,
    });
    assertBalancedJournal(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
    expect(lines[0].accountCode).toBe("5100");
    expect(lines[1].accountCode).toBe("2110");
  });

  it("builds balanced client billing reduction journal", () => {
    const lines = buildFinancialNoteJournalLines({
      noteId: "n2",
      noteNumber: "CRN-2026-0001",
      businessPurpose: "CLIENT_BILLING_REDUCTION",
      counterpartyType: "CLIENT",
      clientId: "c1",
      taxableAmountInr: 500,
      taxAmountInr: 60,
      totalAmountInr: 560,
      currency: "INR",
      includeSubledgerAmount: true,
    });
    assertBalancedJournal(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
    expect(lines[0].accountCode).toBe("4150");
    expect(lines[1].accountCode).toBe("1200");
  });
});

describe("trip charge note inference", () => {
  it("maps deduction to debit note with subledger already reflected", () => {
    const inferred = inferVendorNoteFromTripCharge("DEDUCTION");
    expect(inferred.noteType).toBe("DEBIT_NOTE");
    expect(inferred.payableEffect).toBe("SUBLEDGER_ALREADY_REFLECTED");
  });

  it("maps detention to credit note for vendor increase", () => {
    const inferred = inferVendorNoteFromTripCharge("DETENTION");
    expect(inferred.noteType).toBe("CREDIT_NOTE");
    expect(inferred.businessPurpose).toBe("VENDOR_FREIGHT_INCREASE");
  });
});

describe("approval policy", () => {
  it("does not require approval when threshold is disabled", () => {
    expect(noteRequiresApproval(100)).toBe(false);
  });
});

describe("issuer vs approver (documented behavior)", () => {
  it("separate issuer policy is on by default in policy config", () => {
    expect(getFinancialNotePolicy().separateIssuerFromApprover).toBe(true);
  });
});
