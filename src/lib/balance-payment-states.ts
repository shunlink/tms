// Vendor balance payment state machine — server-side validation only.

export const BALANCE_PAYMENT_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "PROCESSING",
  "PARTIALLY_PAID",
  "PROCESSED",
  "SLA_BREACHED",
] as const;

export type BalancePaymentStatus = (typeof BALANCE_PAYMENT_STATUSES)[number];

/** Legacy alias kept for migration compatibility. */
export const LEGACY_PENDING_BALANCE_PAYMENT = "PENDING_BALANCE_PAYMENT";

/** Open balance tasks (work queues, SLA) — includes finance review. */
export const ACTIVE_BALANCE_PAYMENT_STATUSES: BalancePaymentStatus[] = [
  "PENDING_REVIEW",
  "APPROVED",
  "PROCESSING",
  "PARTIALLY_PAID",
  "SLA_BREACHED",
];

/**
 * Balance tasks that still owe cash (finance may still be reviewing commercial amounts).
 * Used for payables dashboards, vendor payment queues, and operational outstanding totals.
 */
export const OUTSTANDING_BALANCE_PAYMENT_STATUSES: BalancePaymentStatus[] = [
  "PENDING_REVIEW",
  "APPROVED",
  "PROCESSING",
  "PARTIALLY_PAID",
  "SLA_BREACHED",
];

export const BALANCE_PAYMENT_TRANSITIONS: Record<string, BalancePaymentStatus[]> = {
  PENDING_REVIEW: ["APPROVED", "SLA_BREACHED"],
  SLA_BREACHED: ["APPROVED", "PROCESSING"],
  APPROVED: ["PROCESSING", "SLA_BREACHED"],
  PROCESSING: ["PARTIALLY_PAID", "PROCESSED"],
  PARTIALLY_PAID: ["PROCESSING", "PROCESSED"],
  PROCESSED: [],
};

export function canBalancePaymentTransition(from: string, to: string): boolean {
  const normalized = from === LEGACY_PENDING_BALANCE_PAYMENT ? "PENDING_REVIEW" : from;
  return (BALANCE_PAYMENT_TRANSITIONS[normalized] ?? []).includes(to as BalancePaymentStatus);
}

export function assertBalancePaymentTransition(from: string, to: string) {
  if (!canBalancePaymentTransition(from, to)) {
    throw new Error(`Invalid balance payment transition: ${from} → ${to}`);
  }
}

export function isBalancePaymentOutstanding(status: string): boolean {
  return ACTIVE_BALANCE_PAYMENT_STATUSES.includes(status as BalancePaymentStatus);
}
