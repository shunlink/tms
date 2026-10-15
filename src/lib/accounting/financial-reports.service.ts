import type { AccountType } from "./types";
import { aggregatePostedBalancesByAccount, rowsFromAggregates } from "./gl-balances.service";
import type {
  BalanceSheetReport,
  ProfitLossReport,
  ReportMeta,
  TrialBalanceReport,
} from "./report-types";
import { prisma } from "../prisma";
import { CONTROL_ACCOUNT_CODES } from "./control-accounts";

const REPORT_DISCLAIMER =
  "Generated from posted journal entries only. Not statutory or audited financial statements. " +
  "Includes accruals and cash postings where the system has automated journal rules; " +
  "GST split, opening balances, and legacy unmigrated cash may still differ from operational subledgers.";

function buildMeta(input: {
  currency: string;
  fromDate?: Date;
  toDate?: Date;
  asOfDate?: Date;
}): ReportMeta {
  return {
    currency: input.currency,
    generatedAt: new Date().toISOString(),
    basis: "POSTED_GL",
    disclaimer: REPORT_DISCLAIMER,
    accountingDateFrom: input.fromDate?.toISOString().slice(0, 10),
    accountingDateTo: input.toDate?.toISOString().slice(0, 10),
    asOfDate: input.asOfDate?.toISOString().slice(0, 10),
  };
}

function sectionLabel(type: AccountType): string {
  switch (type) {
    case "REVENUE":
      return "Revenue";
    case "EXPENSE":
      return "Expenses";
    case "ASSET":
      return "Assets";
    case "LIABILITY":
      return "Liabilities";
    case "EQUITY":
      return "Equity";
    default:
      return type;
  }
}

export async function buildTrialBalanceReport(input: {
  asOfDate: Date;
  currency?: string;
  includeZeroBalances?: boolean;
}): Promise<TrialBalanceReport> {
  const currency = input.currency ?? "INR";
  const aggregates = await aggregatePostedBalancesByAccount({
    asOfDate: input.asOfDate,
    currency,
  });

  let rows = rowsFromAggregates(aggregates, { includeZero: false });

  if (input.includeZeroBalances) {
    const activeAccounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
      include: { parent: { select: { code: true } } },
      orderBy: { code: "asc" },
    });
    const byCode = new Map(rows.map((r) => [r.accountCode, r]));
    rows = activeAccounts.map((a) => {
      const existing = byCode.get(a.code);
      if (existing) return existing;
      return {
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        accountType: a.accountType as AccountType,
        normalBalance: a.normalBalance as "DEBIT" | "CREDIT",
        parentId: a.parentId,
        parentCode: a.parent?.code ?? null,
        totalDebitMinor: 0,
        totalCreditMinor: 0,
        netDebitMinor: 0,
        netCreditMinor: 0,
        signedBalanceMinor: 0,
      };
    });
  }

  const grandTotalDebitMinor = rows.reduce((s, r) => s + r.totalDebitMinor, 0);
  const grandTotalCreditMinor = rows.reduce((s, r) => s + r.totalCreditMinor, 0);
  const imbalanceMinor = grandTotalDebitMinor - grandTotalCreditMinor;

  return {
    meta: buildMeta({ currency, asOfDate: input.asOfDate }),
    includeZeroBalances: Boolean(input.includeZeroBalances),
    rows,
    grandTotalDebitMinor,
    grandTotalCreditMinor,
    isBalanced: imbalanceMinor === 0,
    imbalanceMinor,
  };
}

export async function buildProfitAndLossReport(input: {
  fromDate: Date;
  toDate: Date;
  currency?: string;
}): Promise<ProfitLossReport> {
  const currency = input.currency ?? "INR";
  const aggregates = await aggregatePostedBalancesByAccount({
    fromDate: input.fromDate,
    toDate: input.toDate,
    currency,
    accountTypes: ["REVENUE", "EXPENSE"],
  });

  const rows = rowsFromAggregates(aggregates);
  const revenueRows = rows.filter((r) => r.accountType === "REVENUE");
  const expenseRows = rows.filter((r) => r.accountType === "EXPENSE");

  const revenueSubtotal = revenueRows.reduce((s, r) => s + r.signedBalanceMinor, 0);
  const expenseSubtotal = expenseRows.reduce((s, r) => s + r.signedBalanceMinor, 0);

  return {
    meta: buildMeta({ currency, fromDate: input.fromDate, toDate: input.toDate }),
    revenue: {
      accountType: "REVENUE",
      label: sectionLabel("REVENUE"),
      rows: revenueRows,
      subtotalMinor: revenueSubtotal,
    },
    expenses: {
      accountType: "EXPENSE",
      label: sectionLabel("EXPENSE"),
      rows: expenseRows,
      subtotalMinor: expenseSubtotal,
    },
    netProfitMinor: revenueSubtotal - expenseSubtotal,
  };
}

export async function buildBalanceSheetReport(input: {
  asOfDate: Date;
  currency?: string;
  periodStartForEarnings?: Date;
}): Promise<BalanceSheetReport> {
  const currency = input.currency ?? "INR";
  const aggregates = await aggregatePostedBalancesByAccount({
    asOfDate: input.asOfDate,
    currency,
    accountTypes: ["ASSET", "LIABILITY", "EQUITY"],
  });

  const rows = rowsFromAggregates(aggregates);
  const assets = rows.filter((r) => r.accountType === "ASSET");
  const liabilities = rows.filter((r) => r.accountType === "LIABILITY");
  const equity = rows.filter((r) => r.accountType === "EQUITY");

  const totalAssetsMinor = assets.reduce((s, r) => s + r.signedBalanceMinor, 0);
  const totalLiabilitiesMinor = liabilities.reduce((s, r) => s + r.signedBalanceMinor, 0);
  const equityFromAccountsMinor = equity.reduce((s, r) => s + r.signedBalanceMinor, 0);

  let currentPeriodEarningsMinor = 0;
  if (input.periodStartForEarnings) {
    const pl = await buildProfitAndLossReport({
      fromDate: input.periodStartForEarnings,
      toDate: input.asOfDate,
      currency,
    });
    currentPeriodEarningsMinor = pl.netProfitMinor;
  }

  const totalEquityMinor = equityFromAccountsMinor + currentPeriodEarningsMinor;
  const equationDifferenceMinor =
    totalAssetsMinor - (totalLiabilitiesMinor + totalEquityMinor);

  return {
    meta: buildMeta({ currency, asOfDate: input.asOfDate }),
    assets: {
      accountType: "ASSET",
      label: sectionLabel("ASSET"),
      rows: assets,
      subtotalMinor: totalAssetsMinor,
    },
    liabilities: {
      accountType: "LIABILITY",
      label: sectionLabel("LIABILITY"),
      rows: liabilities,
      subtotalMinor: totalLiabilitiesMinor,
    },
    equity: {
      accountType: "EQUITY",
      label: sectionLabel("EQUITY"),
      rows: equity,
      subtotalMinor: equityFromAccountsMinor,
    },
    currentPeriodEarningsMinor,
    totalAssetsMinor,
    totalLiabilitiesMinor,
    totalEquityMinor,
    equationHolds: equationDifferenceMinor === 0,
    equationDifferenceMinor,
  };
}

/** Cash-flow is deferred — insufficient activity classification in historical data. */
export const CASH_FLOW_REPORTING_NOTE =
  "Cash-flow statement not generated: posted journals do not consistently classify operating/investing/financing " +
  "cash flows. Use bank/clearing account activity in the general ledger for cash movement review until Phase 6.";

export function retainedEarningsControlCode(): string {
  return CONTROL_ACCOUNT_CODES.RETAINED_EARNINGS;
}
