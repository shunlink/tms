import type {
  InitiateTransferRequest,
  InitiateTransferResult,
  NormalizedWebhookEvent,
  ProviderCapabilities,
  QueryTransferResult,
} from "./types";

export interface PaymentGateway {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  initiateTransfer(req: InitiateTransferRequest): Promise<InitiateTransferResult>;
  queryTransfer(providerRef: string): Promise<QueryTransferResult>;

  verifyWebhookSignature(headers: Headers, rawBody: string): boolean;
  parseWebhookEvent(rawBody: string): NormalizedWebhookEvent;

  mapError(error: unknown): { category: string; code: string; message: string; retryable: boolean };
}
