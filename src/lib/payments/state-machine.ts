export const OUTBOUND_PAYMENT_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REQUIRES_REVIEW",
  "REVERSED",
  "PARTIALLY_PAID",
] as const;

export type OutboundPaymentStatus = (typeof OUTBOUND_PAYMENT_STATUSES)[number];

const TRANSITIONS: Record<OutboundPaymentStatus, OutboundPaymentStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "REQUIRES_REVIEW", "PARTIALLY_PAID"],
  SUCCEEDED: ["REVERSED"],
  FAILED: ["APPROVED", "CANCELLED", "REQUIRES_REVIEW"],
  CANCELLED: [],
  REQUIRES_REVIEW: ["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"],
  REVERSED: [],
  PARTIALLY_PAID: ["PROCESSING", "SUCCEEDED"],
};

export function canTransitionPayment(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as OutboundPaymentStatus];
  if (!allowed) return false;
  return allowed.includes(to as OutboundPaymentStatus);
}

export function assertPaymentTransition(from: string, to: string): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} → ${to}`);
  }
}

export const TERMINAL_PAYMENT_STATUSES = new Set<OutboundPaymentStatus>([
  "SUCCEEDED",
  "CANCELLED",
  "REVERSED",
]);
