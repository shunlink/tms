import { describe, expect, it } from "vitest";
import {
  buildClientInvoiceAccrualLines,
  buildClientReceiptLines,
  buildOutboundPaymentSettlementLines,
  buildVendorCashPaymentLines,
  buildVendorPayableAccrualLines,
} from "./posting-rules";
import { assertBalancedJournal, sumJournalSides } from "./posting-validation";

describe("outbound payment posting rule", () => {
  it("posts vendor advance for ADVANCE purpose", () => {
    const lines = buildOutboundPaymentSettlementLines({
      paymentId: "pay-1",
      amountMinor: 250_00,
      currency: "INR",
      purpose: "ADVANCE",
      vendorId: "v-1",
      tripId: "t-1",
    });
    const resolved = lines.map((l) => ({
      debitMinor: l.debitMinor ?? 0,
      creditMinor: l.creditMinor ?? 0,
    }));
    assertBalancedJournal(resolved);
    expect(lines[0].accountCode).toBe("2150");
    expect(lines[1].accountCode).toBe("1015");
    expect(lines[0].debitMinor).toBe(250_00);
  });

  it("posts vendor payable for BALANCE purpose", () => {
    const lines = buildOutboundPaymentSettlementLines({
      paymentId: "pay-2",
      amountMinor: 100_00,
      currency: "INR",
      purpose: "BALANCE",
      vendorId: "v-1",
    });
    expect(lines[0].accountCode).toBe("2110");
    assertBalancedJournal(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
  });
});

describe("manual vendor cash payment", () => {
  it("credits bank for balance payment", () => {
    const lines = buildVendorCashPaymentLines({
      vendorPaymentId: "vp-1",
      amountMinor: 50_000,
      paymentType: "BALANCE",
      vendorId: "v-1",
      tripId: "t-1",
    });
    assertBalancedJournal(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
    expect(lines[0].accountCode).toBe("2110");
    expect(lines[1].accountCode).toBe("1010");
  });
});

describe("vendor payable accrual", () => {
  it("balances with advance application", () => {
    const lines = buildVendorPayableAccrualLines({
      payableId: "p-1",
      finalPayableMinor: 100_000,
      advanceAppliedMinor: 40_000,
      vendorId: "v-1",
      tripId: "t-1",
    });
    const sides = sumJournalSides(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
    expect(sides.debitMinor).toBe(sides.creditMinor);
    expect(sides.debitMinor).toBe(140_000);
  });
});

describe("client invoice and receipt", () => {
  it("accrual Dr AR Cr revenue", () => {
    const lines = buildClientInvoiceAccrualLines({
      invoiceId: "inv-1",
      invoiceNumber: "INV-1",
      totalMinor: 118_000,
      clientId: "c-1",
    });
    assertBalancedJournal(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
    expect(lines[0].accountCode).toBe("1200");
    expect(lines[1].accountCode).toBe("4100");
  });

  it("receipt Dr bank Cr AR", () => {
    const lines = buildClientReceiptLines({
      clientPaymentId: "cp-1",
      amountMinor: 50_000,
      clientId: "c-1",
    });
    assertBalancedJournal(
      lines.map((l) => ({ debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
    );
  });
});
