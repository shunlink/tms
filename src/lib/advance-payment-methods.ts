export const ADVANCE_PAYMENT_METHODS = [
  "NEFT",
  "RTGS",
  "IMPS",
  "UPI",
  "Bank Transfer",
  "Other",
] as const;

export type AdvancePaymentMethod = (typeof ADVANCE_PAYMENT_METHODS)[number];
