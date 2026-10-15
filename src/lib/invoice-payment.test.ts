import { describe, expect, it } from "vitest";
import {
  computeInvoicePaymentRevert,
  computeInvoicePaymentState,
  invoiceOutstanding,
  rejectDirectInvoicePaymentFields,
  validateInvoicePaymentAmount,
} from "./invoice-payment";

const TOTAL = 50000;

describe("invoice payment acceptance cases", () => {
  it("case 1: no payments → paid ₹0, outstanding ₹50,000, UNPAID", () => {
    expect(invoiceOutstanding(TOTAL, 0)).toBe(50000);
    const state = computeInvoicePaymentState(TOTAL, 0, 0, "UNPAID");
    expect(state.paidAmount).toBe(0);
    expect(state.outstanding).toBe(50000);
    expect(state.status).toBe("UNPAID");
  });

  it("case 2: ClientPayment ₹20,000 → PARTIALLY_PAID with ₹30,000 outstanding", () => {
    const state = computeInvoicePaymentState(TOTAL, 0, 20000, "UNPAID");
    expect(state.paidAmount).toBe(20000);
    expect(state.outstanding).toBe(30000);
    expect(state.status).toBe("PARTIALLY_PAID");
  });

  it("case 3: second ClientPayment ₹30,000 → PAID with ₹0 outstanding", () => {
    const state = computeInvoicePaymentState(TOTAL, 20000, 30000, "PARTIALLY_PAID");
    expect(state.paidAmount).toBe(50000);
    expect(state.outstanding).toBe(0);
    expect(state.status).toBe("PAID");
  });

  it("case 4: direct paidAmount mutation is rejected", () => {
    expect(rejectDirectInvoicePaymentFields({ paidAmount: TOTAL })).toMatch(/Record Payment/);
    expect(rejectDirectInvoicePaymentFields({ status: "PAID" })).toMatch(/Record Payment/);
    expect(rejectDirectInvoicePaymentFields({ status: "PARTIALLY_PAID" })).toMatch(/Record Payment/);
    expect(rejectDirectInvoicePaymentFields({ status: "UNPAID" })).toBeNull();
  });

  it("case 5: overpayment ₹60,000 against ₹50,000 invoice is rejected", () => {
    const outstanding = invoiceOutstanding(TOTAL, 0);
    expect(validateInvoicePaymentAmount(outstanding, 60000)).toMatch(/exceeds outstanding/);
    expect(validateInvoicePaymentAmount(outstanding, 50000)).toBeNull();
  });
});

describe("invoice payment reversal", () => {
  it("reverts full payment back to UNPAID", () => {
    const state = computeInvoicePaymentRevert(TOTAL, 50000, 50000, "PAID");
    expect(state.paidAmount).toBe(0);
    expect(state.outstanding).toBe(50000);
    expect(state.status).toBe("UNPAID");
  });

  it("reverts partial payment to PARTIALLY_PAID", () => {
    const state = computeInvoicePaymentRevert(TOTAL, 50000, 30000, "PAID");
    expect(state.paidAmount).toBe(20000);
    expect(state.outstanding).toBe(30000);
    expect(state.status).toBe("PARTIALLY_PAID");
  });
});
