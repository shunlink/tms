import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  assertPaymentTransition,
  canTransitionPayment,
  TERMINAL_PAYMENT_STATUSES,
} from "./state-machine";
import { minorToRupees, rupeesToMinor } from "./money";
import { createMockPaymentGateway, resetMockPaymentStore } from "./gateway/mock";
import { gatewayExecutionEnabled, paymentProviderId } from "./config";
import { setPaymentGatewayForTests, resetPaymentGatewayCache } from "./gateway/registry";

describe("payment state machine", () => {
  it("allows draft to pending approval", () => {
    expect(canTransitionPayment("DRAFT", "PENDING_APPROVAL")).toBe(true);
    assertPaymentTransition("DRAFT", "PENDING_APPROVAL");
  });

  it("rejects client-forged success transitions", () => {
    expect(canTransitionPayment("DRAFT", "SUCCEEDED")).toBe(false);
    expect(() => assertPaymentTransition("DRAFT", "SUCCEEDED")).toThrow();
  });

  it("marks terminal statuses", () => {
    expect(TERMINAL_PAYMENT_STATUSES.has("SUCCEEDED")).toBe(true);
    expect(TERMINAL_PAYMENT_STATUSES.has("PROCESSING")).toBe(false);
  });
});

describe("money helpers", () => {
  it("converts rupees to paise", () => {
    expect(rupeesToMinor(10.5)).toBe(1050);
    expect(minorToRupees(1050)).toBe(10.5);
  });
});

describe("mock gateway", () => {
  beforeEach(() => {
    resetMockPaymentStore();
    setPaymentGatewayForTests(createMockPaymentGateway());
  });

  afterEach(() => {
    resetPaymentGatewayCache();
    setPaymentGatewayForTests(null);
  });

  it("is idempotent on duplicate idempotency keys", async () => {
    const gw = createMockPaymentGateway();
    const req = {
      internalPaymentId: "pay-1",
      idempotencyKey: "idem-1",
      amountMinor: 100_00,
      currency: "INR",
      beneficiary: { method: "BANK_TRANSFER", accountNumber: "1234567890", ifsc: "HDFC0000001" },
    };
    const a = await gw.initiateTransfer(req);
    const b = await gw.initiateTransfer(req);
    expect(a.providerRef).toBeTruthy();
    expect(b.providerRef).toBeTruthy();
  });

  it("rejects webhooks with invalid mock signature", () => {
    const gw = createMockPaymentGateway();
    const body = JSON.stringify({ eventId: "evt-1", providerRef: "mock-1", status: "SUCCEEDED" });
    const headers = new Headers();
    expect(gw.verifyWebhookSignature(headers, body)).toBe(false);
  });

  it("does not enable mock execution in production", () => {
    const prevProvider = process.env.PAYMENT_GATEWAY_PROVIDER;
    const prevNodeEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_GATEWAY_PROVIDER", "mock");
    resetPaymentGatewayCache();
    expect(paymentProviderId()).toBe("mock");
    expect(gatewayExecutionEnabled()).toBe(false);
    vi.stubEnv("PAYMENT_GATEWAY_PROVIDER", prevProvider ?? "");
    vi.stubEnv("NODE_ENV", prevNodeEnv ?? "test");
    resetPaymentGatewayCache();
  });
});
