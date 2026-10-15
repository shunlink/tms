import type { PaymentGateway } from "./interface";

/** Placeholder when no real provider is configured — all execution attempts fail safely. */
export function createDisabledPaymentGateway(): PaymentGateway {
  const notConfigured = () => {
    throw new Error(
      "Payment gateway is not configured. Set PAYMENT_GATEWAY_PROVIDER when a provider adapter is available."
    );
  };

  return {
    id: "none",
    capabilities: {
      supportsWebhooks: false,
      supportsStatusPolling: false,
      supportsIdempotentInitiate: false,
    },
    initiateTransfer: notConfigured,
    queryTransfer: notConfigured,
    verifyWebhookSignature: () => false,
    parseWebhookEvent: notConfigured,
    mapError: (error: unknown) => ({
      category: "PROVIDER",
      code: "NOT_CONFIGURED",
      message: error instanceof Error ? error.message : "Gateway not configured",
      retryable: false,
    }),
  };
}
