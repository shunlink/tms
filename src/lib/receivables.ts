import { ageBucket } from "./logic";
import { invoiceOutstanding } from "./invoice-payment";

export type ReceivableDisplayStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export type DetailedAgeingBuckets = {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
};

export type AgeingBucketFilter = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus" | "overdue";

/** Finalized invoice statuses that contribute to accounts receivable. */
export const OUTSTANDING_INVOICE_STATUSES = [
  "SENT",
  "UNPAID",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const;

export type OutstandingInvoiceStatus = (typeof OUTSTANDING_INVOICE_STATUSES)[number];

export type AgeingInvoiceInput = {
  clientName: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  dueDate: Date | null;
  issueDate: Date;
  finalizedAt?: Date | null;
};

/** Days since invoice was issued to the client (finalize date when available). */
export function invoiceBalanceAgeDays(
  issueDate: Date,
  finalizedAt: Date | null | undefined,
  nowMs = Date.now()
): number {
  const anchorMs = (finalizedAt ?? issueDate).getTime();
  return Math.max(0, Math.floor((nowMs - anchorMs) / (24 * 60 * 60 * 1000)));
}

export type ReportAgeingBuckets = {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
};

export type ReceivableBalanceAgeingBucket = keyof ReportAgeingBuckets;

export function balanceAgeBucketForDays(days: number): ReceivableBalanceAgeingBucket {
  if (days <= 30) return "d0_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90plus";
}

export type AgeingRow = {
  client: string;
  invoiceNumber: string;
  balance: number;
  days: number;
};

export type AgeingBuckets = {
  current: number;
  d30: number;
  d60: number;
  d90: number;
};

export function isOutstandingInvoiceStatus(status: string): boolean {
  return (OUTSTANDING_INVOICE_STATUSES as readonly string[]).includes(status);
}

/** Days past due; not-yet-due invoices return <= 0 (current bucket). */
export function invoiceAgeingDays(
  dueDate: Date | null | undefined,
  issueDate: Date,
  nowMs = Date.now()
): number {
  const dueMs = (dueDate ?? issueDate).getTime();
  return Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
}

export function buildOutstandingAgeing(
  invoices: AgeingInvoiceInput[],
  nowMs = Date.now()
): { buckets: AgeingBuckets; rows: AgeingRow[]; total: number } {
  const buckets: AgeingBuckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  const rows: AgeingRow[] = [];

  for (const inv of invoices) {
    if (!isOutstandingInvoiceStatus(inv.status)) continue;

    const balance = invoiceOutstanding(inv.totalAmount, inv.paidAmount);
    if (balance <= 0) continue;

    const days = invoiceAgeingDays(inv.dueDate, inv.issueDate, nowMs);
    buckets[ageBucket(days)] += balance;
    rows.push({
      client: inv.clientName,
      invoiceNumber: inv.invoiceNumber,
      balance,
      days,
    });
  }

  rows.sort((a, b) => b.days - a.days);
  const total = buckets.current + buckets.d30 + buckets.d60 + buckets.d90;
  return { buckets, rows, total };
}

/**
 * Reports ageing: bucket outstanding by days since invoice issue/finalize
 * (0–30, 31–60, 61–90, 90+). Unpaid invoices always land in a bucket by age.
 */
export function buildReportOutstandingAgeing(
  invoices: AgeingInvoiceInput[],
  nowMs = Date.now()
): { buckets: ReportAgeingBuckets; rows: AgeingRow[]; total: number } {
  const buckets: ReportAgeingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  const rows: AgeingRow[] = [];

  for (const inv of invoices) {
    if (!isOutstandingInvoiceStatus(inv.status)) continue;

    const balance = invoiceOutstanding(inv.totalAmount, inv.paidAmount);
    if (balance <= 0) continue;

    const days = invoiceBalanceAgeDays(inv.issueDate, inv.finalizedAt, nowMs);
    if (days <= 30) buckets.d0_30 += balance;
    else if (days <= 60) buckets.d31_60 += balance;
    else if (days <= 90) buckets.d61_90 += balance;
    else buckets.d90plus += balance;

    rows.push({
      client: inv.clientName,
      invoiceNumber: inv.invoiceNumber,
      balance,
      days,
    });
  }

  rows.sort((a, b) => b.days - a.days);
  for (const key of Object.keys(buckets) as (keyof ReportAgeingBuckets)[]) {
    buckets[key] = Math.round(buckets[key] * 100) / 100;
  }
  const total = Math.round(rows.reduce((s, r) => s + r.balance, 0) * 100) / 100;
  return { buckets, rows, total };
}

/** Map coarse ageing rows into five finance dashboard buckets (incl. 90+). */
export function splitDetailedAgeingBuckets(rows: AgeingRow[]): DetailedAgeingBuckets {
  const buckets: DetailedAgeingBuckets = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
  };
  for (const row of rows) {
    if (row.days <= 0) buckets.current += row.balance;
    else if (row.days <= 30) buckets.d1_30 += row.balance;
    else if (row.days <= 60) buckets.d31_60 += row.balance;
    else if (row.days <= 90) buckets.d61_90 += row.balance;
    else buckets.d90plus += row.balance;
  }
  for (const key of Object.keys(buckets) as (keyof DetailedAgeingBuckets)[]) {
    buckets[key] = Math.round(buckets[key] * 100) / 100;
  }
  return buckets;
}

export function detailedAgeingBucketForDays(days: number): AgeingBucketFilter {
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90plus";
}

/** Display status from amounts and due date — not stored invoice status alone. */
export function deriveReceivableDisplayStatus(
  totalAmount: number,
  paidAmount: number,
  dueDate: Date | null | undefined,
  issueDate: Date,
  nowMs = Date.now()
): ReceivableDisplayStatus {
  const outstanding = invoiceOutstanding(totalAmount, paidAmount);
  if (outstanding <= 0) return "PAID";
  const days = invoiceAgeingDays(dueDate, issueDate, nowMs);
  if (days > 0) return "OVERDUE";
  if (paidAmount > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}

export function buildReceivablesSummary(
  invoices: AgeingInvoiceInput[],
  nowMs = Date.now()
): {
  total: number;
  totalOverdue: number;
  buckets: ReportAgeingBuckets;
} {
  const report = buildReportOutstandingAgeing(invoices, nowMs);
  let totalOverdue = 0;
  for (const inv of invoices) {
    if (!isOutstandingInvoiceStatus(inv.status)) continue;
    const outstanding = invoiceOutstanding(inv.totalAmount, inv.paidAmount);
    if (outstanding <= 0) continue;
    if (invoiceAgeingDays(inv.dueDate, inv.issueDate, nowMs) > 0) {
      totalOverdue += outstanding;
    }
  }
  return {
    total: report.total,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    buckets: report.buckets,
  };
}
