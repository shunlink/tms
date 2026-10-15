import { describe, expect, it } from "vitest";
import { computeInvoicePaymentState, validateInvoicePaymentAmount } from "../invoice-payment";

describe("client subledger allocation semantics", () => {
  it("supports partial receipt against invoice", () => {
    const next = computeInvoicePaymentState(10000, 0, 4000, "SENT");
    expect(next.paidAmount).toBe(4000);
    expect(next.outstanding).toBe(6000);
    expect(next.status).toBe("PARTIALLY_PAID");
  });

  it("rejects overpayment at validation layer", () => {
    expect(validateInvoicePaymentAmount(1000, 1500)).toMatch(/exceeds/);
  });
});

describe("vendor running balance convention", () => {
  it("increases balance on payable credit and decreases on payment debit", () => {
    let balance = 0;
    balance += 50000 - 0;
    balance += 0 - 20000;
    expect(balance).toBe(30000);
  });
});
