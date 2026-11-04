import { describe, expect, it } from "vitest";
import { generateJuspayOrderId, isValidJuspayOrderId } from "./juspay/order-id";
import { verifyJuspayWebhookBasicAuth } from "./juspay/webhook-auth";

describe("Juspay order id", () => {
  it("generates alphanumeric ids under 21 chars", () => {
    const id = generateJuspayOrderId("T");
    expect(isValidJuspayOrderId(id)).toBe(true);
    expect(id.length).toBeLessThan(21);
  });
});

describe("Juspay webhook basic auth", () => {
  it("accepts matching credentials", () => {
    const token = Buffer.from("user:pass").toString("base64");
    const headers = new Headers({ authorization: `Basic ${token}` });
    expect(verifyJuspayWebhookBasicAuth(headers, { username: "user", password: "pass" })).toBe(true);
  });

  it("rejects wrong password", () => {
    const token = Buffer.from("user:wrong").toString("base64");
    const headers = new Headers({ authorization: `Basic ${token}` });
    expect(verifyJuspayWebhookBasicAuth(headers, { username: "user", password: "pass" })).toBe(false);
  });
});

describe("mock gateway webhook payload", () => {
  it("includes outbound channel", async () => {
    const { createMockPaymentGateway } = await import("./gateway/mock");
    const gw = createMockPaymentGateway();
    const parsed = gw.parseWebhookEvent(
      JSON.stringify({ eventId: "e1", providerRef: "mock-1", status: "SUCCEEDED" })
    );
    expect(parsed.channel).toBe("outbound");
  });
});
