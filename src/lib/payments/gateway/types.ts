export type NormalizedTransferStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "AMBIGUOUS";

export type NormalizedErrorCategory =
  | "VALIDATION"
  | "INSUFFICIENT_FUNDS"
  | "BENEFICIARY"
  | "PROVIDER"
  | "NETWORK"
  | "RATE_LIMIT"
  | "UNKNOWN";

export type InitiateTransferRequest = {
  internalPaymentId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  beneficiary: {
    method: string;
    accountHolder?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    upiId?: string | null;
  };
  metadata?: Record<string, string>;
};

export type InitiateTransferResult = {
  providerRef: string;
  status: NormalizedTransferStatus;
  raw?: unknown;
};

export type QueryTransferResult = {
  providerRef: string;
  status: NormalizedTransferStatus;
  utr?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  raw?: unknown;
};

export type NormalizedWebhookEvent = {
  providerEventId: string;
  providerRef?: string;
  internalPaymentId?: string;
  status: NormalizedTransferStatus;
  utr?: string | null;
  amountMinor?: number;
};

export type ProviderCapabilities = {
  supportsWebhooks: boolean;
  supportsStatusPolling: boolean;
  supportsIdempotentInitiate: boolean;
};
