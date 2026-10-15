import type { AccountType, NormalBalance } from "./types";

export type ReportMeta = {
  currency: string;
  generatedAt: string;
  basis: "POSTED_GL";
  disclaimer: string;
  accountingDateFrom?: string;
  accountingDateTo?: string;
  asOfDate?: string;
};

export type AccountBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  parentCode: string | null;
  totalDebitMinor: number;
  totalCreditMinor: number;
  netDebitMinor: number;
  netCreditMinor: number;
  signedBalanceMinor: number;
};

export type TrialBalanceReport = {
  meta: ReportMeta;
  includeZeroBalances: boolean;
  rows: AccountBalanceRow[];
  grandTotalDebitMinor: number;
  grandTotalCreditMinor: number;
  isBalanced: boolean;
  imbalanceMinor: number;
};

export type ProfitLossSection = {
  accountType: "REVENUE" | "EXPENSE";
  label: string;
  rows: AccountBalanceRow[];
  subtotalMinor: number;
};

export type ProfitLossReport = {
  meta: ReportMeta;
  revenue: ProfitLossSection;
  expenses: ProfitLossSection;
  netProfitMinor: number;
};

export type BalanceSheetSection = {
  accountType: "ASSET" | "LIABILITY" | "EQUITY";
  label: string;
  rows: AccountBalanceRow[];
  subtotalMinor: number;
};

export type BalanceSheetReport = {
  meta: ReportMeta;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  currentPeriodEarningsMinor: number;
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  totalEquityMinor: number;
  equationHolds: boolean;
  equationDifferenceMinor: number;
};
