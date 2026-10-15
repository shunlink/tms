import { minorToRupees } from "../payments/money";
import type { AccountBalanceRow } from "./report-types";

export function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function trialBalanceToCsv(rows: AccountBalanceRow[]): string {
  const header = [
    "Account Code",
    "Account Name",
    "Type",
    "Debit (INR)",
    "Credit (INR)",
    "Net Debit (INR)",
    "Net Credit (INR)",
  ].join(",");
  const body = rows.map((r) =>
    [
      csvEscape(r.accountCode),
      csvEscape(r.accountName),
      csvEscape(r.accountType),
      minorToRupees(r.totalDebitMinor),
      minorToRupees(r.totalCreditMinor),
      minorToRupees(r.netDebitMinor),
      minorToRupees(r.netCreditMinor),
    ].join(",")
  );
  return [header, ...body].join("\n");
}

export function subledgerLinesToCsv(
  lines: {
    effectiveDate: Date;
    reference: string;
    description: string;
    debitMinor: number;
    creditMinor: number;
    runningBalanceMinor: number;
  }[]
): string {
  const header = ["Date", "Reference", "Description", "Debit (INR)", "Credit (INR)", "Balance (INR)"].join(
    ","
  );
  const body = lines.map((l) =>
    [
      csvEscape(l.effectiveDate.toISOString().slice(0, 10)),
      csvEscape(l.reference),
      csvEscape(l.description),
      minorToRupees(l.debitMinor),
      minorToRupees(l.creditMinor),
      minorToRupees(l.runningBalanceMinor),
    ].join(",")
  );
  return [header, ...body].join("\n");
}
