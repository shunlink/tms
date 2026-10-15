export type PaymentProviderId = "none" | "mock";

export function paymentProviderId(): PaymentProviderId {
  const raw = (process.env.PAYMENT_GATEWAY_PROVIDER ?? "none").trim().toLowerCase();
  if (raw === "mock") return "mock";
  return "none";
}

export function gatewayExecutionEnabled(): boolean {
  const provider = paymentProviderId();
  if (provider === "none") return false;
  if (provider === "mock") {
    return process.env.NODE_ENV !== "production";
  }
  return true;
}

export function paymentWebhookSecret(providerId: string): string | null {
  const key = `PAYMENT_WEBHOOK_SECRET_${providerId.toUpperCase()}`;
  return process.env[key]?.trim() || process.env.PAYMENT_WEBHOOK_SECRET?.trim() || null;
}
