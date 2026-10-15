export const NOTE_TYPES = ["DEBIT_NOTE", "CREDIT_NOTE"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const COUNTERPARTY_TYPES = ["VENDOR", "CLIENT"] as const;
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number];

export const NOTE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ISSUED",
  "REJECTED",
  "VOIDED",
  "REVERSED",
] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const BUSINESS_PURPOSES = [
  "VENDOR_FREIGHT_INCREASE",
  "VENDOR_FREIGHT_REDUCTION",
  "CLIENT_BILLING_INCREASE",
  "CLIENT_BILLING_REDUCTION",
  "OTHER",
] as const;
export type BusinessPurpose = (typeof BUSINESS_PURPOSES)[number];

export const PAYABLE_EFFECTS = [
  "APPLY_TO_SUBLEDGER",
  "SUBLEDGER_ALREADY_REFLECTED",
  "NONE",
] as const;
export type PayableEffect = (typeof PAYABLE_EFFECTS)[number];

export type NoteLineInput = {
  lineNumber?: number;
  description?: string | null;
  quantity?: number;
  unitAmount?: number;
  amount: number;
  taxRate?: number | null;
  taxAmount?: number;
};
