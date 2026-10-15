import { createHmac, randomUUID } from "crypto";
import type { PaymentGateway } from "./interface";
import type {
  InitiateTransferRequest,
  InitiateTransferResult,
  NormalizedWebhookEvent,
  QueryTransferResult,
} from "./types";

const store = new Map<string, { status: string; utr?: string; amountMinor: number }>();

/** In-memory mock — only for dev/test; never enabled in production via registry. */
export function createMockPaymentGateway(): PaymentGateway {
  return {
    id: "mock",
    capabilities: {
      supportsWebhooks: true,
      supportsStatusPolling: true,
      supportsIdempotentInitiate: true,
    },

    async initiateTransfer(req: InitiateTransferRequest): Promise<InitiateTransferResult> {
      const existing = store.get(req.idempotencyKey);
      if (existing) {
        return {
          providerRef: existing.utr ? `mock-${req.idempotencyKey}` : `mock-${req.idempotencyKey}`,
          status: existing.status === "SUCCEEDED" ? "SUCCEEDED" : "PROCESSING",
        };
      }
      const ref = `mock-${randomUUID()}`;
      store.set(req.idempotencyKey, { status: "PROCESSING", amountMinor: req.amountMinor });
      store.set(ref, { status: "PROCESSING", amountMinor: req.amountMinor });
      // Auto-complete after initiate for predictable tests
      store.set(ref, { status: "SUCCEEDED", utr: `UTR${Date.now()}`, amountMinor: req.amountMinor });
      return { providerRef: ref, status: "PROCESSING" };
    },

    async queryTransfer(providerRef: string): Promise<QueryTransferResult> {
      const row = store.get(providerRef);
      if (!row) {
        return { providerRef, status: "AMBIGUOUS" };
      }
      return {
        providerRef,
        status: row.status === "SUCCEEDED" ? "SUCCEEDED" : row.status === "FAILED" ? "FAILED" : "PROCESSING",
        utr: row.utr ?? null,
      };
    },

    verifyWebhookSignature(headers: Headers, rawBody: string): boolean {
      const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET ?? "mock-dev-secret";
      const sig = headers.get("x-mock-signature");
      if (!sig) return false;
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      return sig === expected;
    },

    parseWebhookEvent(rawBody: string): NormalizedWebhookEvent {
      const data = JSON.parse(rawBody) as {
        eventId: string;
        providerRef: string;
        status: string;
        paymentId?: string;
        utr?: string;
        amountMinor?: number;
      };
      return {
        providerEventId: data.eventId,
        providerRef: data.providerRef,
        internalPaymentId: data.paymentId,
        status: data.status === "SUCCEEDED" ? "SUCCEEDED" : data.status === "FAILED" ? "FAILED" : "PROCESSING",
        utr: data.utr,
        amountMinor: data.amountMinor,
      };
    },

    mapError(error: unknown) {
      const message = error instanceof Error ? error.message : "Mock provider error";
      return { category: "PROVIDER", code: "MOCK_ERROR", message, retryable: true };
    },
  };
}

/** Test helper to reset mock store */
export function resetMockPaymentStore() {
  store.clear();
}
