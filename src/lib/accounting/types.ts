export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const NORMAL_BALANCES = ["DEBIT", "CREDIT"] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

export const JOURNAL_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const PERIOD_STATUSES = ["OPEN", "UNDER_REVIEW", "CLOSED"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const JOURNAL_SOURCE_TYPES = [
  "OUTBOUND_PAYMENT",
  "MANUAL",
  "OPENING_BALANCE",
  "REVERSAL",
  "FINANCIAL_NOTE",
] as const;
export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPES)[number];

export function normalBalanceForAccountType(accountType: AccountType): NormalBalance {
  if (accountType === "ASSET" || accountType === "EXPENSE") return "DEBIT";
  return "CREDIT";
}

export type DraftJournalLineInput = {
  accountCode: string;
  debitMinor?: number;
  creditMinor?: number;
  description?: string;
  vendorId?: string;
  clientId?: string;
  indentId?: string;
  tripId?: string;
  outboundPaymentId?: string;
};

export type CreateDraftJournalInput = {
  accountingDate: Date;
  description?: string;
  sourceType: string;
  sourceId?: string;
  idempotencyKey: string;
  currency?: string;
  lines: DraftJournalLineInput[];
  outboundPaymentId?: string;
  createdById?: string;
  approvedById?: string;
};
