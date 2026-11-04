export type PaymentProviderId = "none" | "mock" | "juspay";

export function paymentProviderId(): PaymentProviderId {
  const raw = (process.env.PAYMENT_GATEWAY_PROVIDER ?? "none").trim().toLowerCase();
  if (raw === "mock") return "mock";
  if (raw === "juspay") return "juspay";
  return "none";
}

export function gatewayExecutionEnabled(): boolean {
  const provider = paymentProviderId();
  if (provider === "none") return false;
  if (provider === "mock") {
    return process.env.NODE_ENV !== "production";
  }
  if (provider === "juspay") {
    return Boolean(process.env.JUSPAY_API_KEY?.trim() && process.env.JUSPAY_MERCHANT_ID?.trim());
  }
  return true;
}

export function paymentWebhookSecret(providerId: string): string | null {
  const key = `PAYMENT_WEBHOOK_SECRET_${providerId.toUpperCase()}`;
  return process.env[key]?.trim() || process.env.PAYMENT_WEBHOOK_SECRET?.trim() || null;
}
