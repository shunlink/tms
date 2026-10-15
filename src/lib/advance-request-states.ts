// Trip advance request state machine — server-side validation only.

export const ADVANCE_REQUEST_STATUSES = [
  "PENDING_REVIEW",
  "NEGOTIATED",
  "VENDOR_ACCEPTED",
  "APPROVED",
  "PROCESSING",
  "PROCESSED",
  "SLA_BREACHED",
  "REJECTED",
  "CANCELLED",
  "EXTERNAL",
] as const;

export type AdvanceRequestStatus = (typeof ADVANCE_REQUEST_STATUSES)[number];

export const ACTIVE_ADVANCE_REQUEST_STATUSES: AdvanceRequestStatus[] = [
  "PENDING_REVIEW",
  "NEGOTIATED",
  "VENDOR_ACCEPTED",
  "APPROVED",
  "PROCESSING",
  "SLA_BREACHED",
];

export const ADVANCE_REQUEST_TRANSITIONS: Record<string, AdvanceRequestStatus[]> = {
  PENDING_REVIEW: ["APPROVED", "NEGOTIATED", "REJECTED", "SLA_BREACHED"],
  NEGOTIATED: ["VENDOR_ACCEPTED", "REJECTED", "SLA_BREACHED"],
  VENDOR_ACCEPTED: ["PROCESSING", "SLA_BREACHED"],
  APPROVED: ["PROCESSING", "SLA_BREACHED"],
  SLA_BREACHED: ["PROCESSING", "APPROVED", "NEGOTIATED", "REJECTED"],
  PROCESSING: ["PROCESSED"],
  PROCESSED: [],
  REJECTED: [],
  CANCELLED: [],
  EXTERNAL: [],
};

export function canAdvanceRequestTransition(from: string, to: string): boolean {
  return (ADVANCE_REQUEST_TRANSITIONS[from] ?? []).includes(to as AdvanceRequestStatus);
}

export function assertAdvanceRequestTransition(from: string, to: string) {
  if (!canAdvanceRequestTransition(from, to)) {
    throw new Error(`Invalid advance request transition: ${from} → ${to}`);
  }
}
