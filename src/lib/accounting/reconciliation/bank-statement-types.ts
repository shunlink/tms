export type BankStatementColumnMapping = {
  transactionDate: string;
  valueDate?: string;
  description?: string;
  externalReference?: string;
  externalLineId?: string;
  debit?: string;
  credit?: string;
  amount?: string;
  direction?: string;
  runningBalance?: string;
  currency?: string;
};

export const DEFAULT_BANK_CSV_MAPPING: BankStatementColumnMapping = {
  transactionDate: "Date",
  valueDate: "Value Date",
  description: "Narration",
  externalReference: "Reference",
  externalLineId: "Txn Id",
  debit: "Debit",
  credit: "Credit",
  runningBalance: "Balance",
  currency: "Currency",
};

export const BANK_STATEMENT_MAX_BYTES = 5 * 1024 * 1024;
export const BANK_STATEMENT_ALLOWED_MIME = new Set([
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
]);

export type ParsedBankStatementRow = {
  lineNumber: number;
  transactionDate: Date;
  valueDate: Date | null;
  description: string | null;
  externalReference: string | null;
  externalLineId: string | null;
  direction: "DEBIT" | "CREDIT";
  amountMinor: number;
  currency: string;
  runningBalanceMinor: number | null;
  rawRow: Record<string, string>;
  stableRowKey: string;
};

export type BankStatementParseResult = {
  rows: ParsedBankStatementRow[];
  errors: { lineNumber: number; message: string }[];
  warnings: string[];
  headerRow: string[];
};
