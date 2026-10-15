import type { TeamCode } from "./teams";

/** Unified SLA task types — one evaluator handles all four workflows. */
export const SLA_TYPES = {
  ADVANCE_REQUEST: "ADVANCE_REQUEST",
  BAD_POD: "BAD_POD",
  INVOICE: "INVOICE",
  BALANCE_PAYMENT: "BALANCE_PAYMENT",
} as const;

export type SlaType = (typeof SLA_TYPES)[keyof typeof SLA_TYPES];

export const SLA_STATUSES = ["ACTIVE", "BREACHED", "RESOLVED", "CANCELLED"] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

export const SLA_ENTITY_NAMES = {
  ADVANCE_REQUEST: "AdvanceRequest",
  BAD_POD: "IndentPod",
  INVOICE: "InvoiceTask",
  BALANCE_PAYMENT: "VendorBalancePaymentTask",
} as const satisfies Record<SlaType, string>;

export const SLA_TARGET_TEAMS: Record<SlaType, TeamCode> = {
  ADVANCE_REQUEST: "FINANCE",
  BAD_POD: "OPERATIONS",
  INVOICE: "FINANCE",
  BALANCE_PAYMENT: "FINANCE",
};
