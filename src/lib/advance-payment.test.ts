import { describe, it, expect } from "vitest";
import { ADVANCE_PAYMENT_METHODS } from "./advance-payment-methods";
import { advancePaymentSchema } from "./validation";
import { buildAdvanceVoucherHtml } from "./services/advance-voucher.service";

describe("advance payment processing", () => {
  it("accepts standard payment methods", () => {
    expect(ADVANCE_PAYMENT_METHODS).toContain("NEFT");
    expect(ADVANCE_PAYMENT_METHODS).toContain("IMPS");
    expect(ADVANCE_PAYMENT_METHODS).toContain("UPI");
  });

  it("validates required payment fields", () => {
    const ok = advancePaymentSchema.safeParse({
      paidAmount: 50000,
      paymentMethod: "NEFT",
      paymentDate: "2026-10-03",
      utrReference: "UTR123456",
    });
    expect(ok.success).toBe(true);

    const bad = advancePaymentSchema.safeParse({
      paidAmount: 0,
      paymentMethod: "",
      paymentDate: "",
      utrReference: "",
    });
    expect(bad.success).toBe(false);
  });

  it("builds voucher html with key fields", () => {
    const html = buildAdvanceVoucherHtml({
      voucherNumber: "APV-2026-0001",
      requestNumber: "ADV-2026-0001",
      advanceRequestId: "adv1",
      tripId: "trip1",
      tripLrNumber: "LR-2026-0001",
      indentId: "indent1",
      indentNumber: "IND-2026-0001",
      vendorName: "Sharma Transport",
      vendorGstin: "07AABCS1429B1Z1",
      routeFrom: "Mumbai",
      routeTo: "Delhi",
      freightAmount: 100000,
      requestedAmount: 60000,
      negotiatedAmount: 50000,
      approvedAmount: 50000,
      paidAmount: 50000,
      paymentMethod: "NEFT",
      paymentDate: new Date("2026-10-03"),
      utrReference: "UTR123456",
      bankAccountUsed: "HDFC Current",
      processedByName: "Finance User",
      processedAt: new Date("2026-10-03"),
      status: "PAID",
    });
    expect(html).toContain("APV-2026-0001");
    expect(html).toContain("Sharma Transport");
    expect(html).toContain("UTR123456");
    expect(html).toContain("PAID");
  });
});
