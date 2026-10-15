import { createHash } from "crypto";
import type {
  BankStatementColumnMapping,
  BankStatementParseResult,
  ParsedBankStatementRow,
} from "./bank-statement-types";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function findColumnIndex(headers: string[], mappedName: string | undefined): number {
  if (!mappedName) return -1;
  const target = normalizeHeader(mappedName);
  return headers.findIndex((h) => normalizeHeader(h) === target);
}

function parseDateCell(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (iso) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseAmountToMinor(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function sha256Hex(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function buildStableRowKey(input: {
  glAccountCode: string;
  externalLineId: string | null;
  externalReference: string | null;
  transactionDate: Date;
  direction: string;
  amountMinor: number;
  currency: string;
  importIdForFallback?: string;
  lineNumber: number;
}): string {
  if (input.externalLineId?.trim()) {
    return `${input.glAccountCode}|ext:${input.externalLineId.trim()}`;
  }
  if (input.externalReference?.trim()) {
    return `${input.glAccountCode}|ref:${input.externalReference.trim()}|${input.transactionDate.toISOString().slice(0, 10)}|${input.direction}|${input.amountMinor}|${input.currency}`;
  }
  const fallback = input.importIdForFallback ?? "preview";
  return `${input.glAccountCode}|row:${fallback}:${input.lineNumber}`;
}

export function parseBankStatementCsv(
  csvText: string,
  mapping: BankStatementColumnMapping,
  opts: { defaultCurrency: string; glAccountCode: string; importIdForFallback?: string }
): BankStatementParseResult {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  const errors: BankStatementParseResult["errors"] = [];
  const warnings: string[] = [];
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ lineNumber: 0, message: "File must include a header row and at least one data row" }],
      warnings,
      headerRow: [],
    };
  }

  const headerRow = parseCsvLine(lines[0]);
  const idxDate = findColumnIndex(headerRow, mapping.transactionDate);
  if (idxDate < 0) {
    return {
      rows: [],
      errors: [{ lineNumber: 1, message: `Required column not found: ${mapping.transactionDate}` }],
      warnings,
      headerRow,
    };
  }
  const idxValue = findColumnIndex(headerRow, mapping.valueDate);
  const idxDesc = findColumnIndex(headerRow, mapping.description);
  const idxRef = findColumnIndex(headerRow, mapping.externalReference);
  const idxExtId = findColumnIndex(headerRow, mapping.externalLineId);
  const idxDebit = findColumnIndex(headerRow, mapping.debit);
  const idxCredit = findColumnIndex(headerRow, mapping.credit);
  const idxAmount = findColumnIndex(headerRow, mapping.amount);
  const idxDir = findColumnIndex(headerRow, mapping.direction);
  const idxBal = findColumnIndex(headerRow, mapping.runningBalance);
  const idxCur = findColumnIndex(headerRow, mapping.currency);

  const rows: ParsedBankStatementRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;

    const rawRow: Record<string, string> = {};
    headerRow.forEach((h, j) => {
      rawRow[h] = cells[j] ?? "";
    });

    const txDate = parseDateCell(cells[idxDate] ?? "");
    if (!txDate) {
      errors.push({ lineNumber, message: "Invalid or missing transaction date" });
      continue;
    }

    let direction: "DEBIT" | "CREDIT" | null = null;
    let amountMinor: number | null = null;

    if (idxDebit >= 0 || idxCredit >= 0) {
      const debitMinor = idxDebit >= 0 ? parseAmountToMinor(cells[idxDebit] ?? "") : null;
      const creditMinor = idxCredit >= 0 ? parseAmountToMinor(cells[idxCredit] ?? "") : null;
      const hasDebit = debitMinor != null && debitMinor > 0;
      const hasCredit = creditMinor != null && creditMinor > 0;
      if (hasDebit && hasCredit) {
        errors.push({ lineNumber, message: "Row has both debit and credit amounts" });
        continue;
      }
      if (hasDebit) {
        direction = "DEBIT";
        amountMinor = debitMinor!;
      } else if (hasCredit) {
        direction = "CREDIT";
        amountMinor = creditMinor!;
      }
    }

    if (amountMinor == null && idxAmount >= 0) {
      const amt = parseAmountToMinor(cells[idxAmount] ?? "");
      if (amt != null && amt > 0) {
        amountMinor = amt;
        if (idxDir >= 0) {
          const d = (cells[idxDir] ?? "").trim().toUpperCase();
          if (d.startsWith("D")) direction = "DEBIT";
          else if (d.startsWith("C")) direction = "CREDIT";
        }
        if (!direction) {
          errors.push({ lineNumber, message: "Amount column present but direction is ambiguous" });
          continue;
        }
      }
    }

    if (amountMinor == null || amountMinor <= 0 || !direction) {
      errors.push({ lineNumber, message: "Missing or invalid amount" });
      continue;
    }

    const currency =
      idxCur >= 0 && (cells[idxCur] ?? "").trim()
        ? (cells[idxCur] ?? "").trim().toUpperCase()
        : opts.defaultCurrency;

    if (currency !== opts.defaultCurrency) {
      warnings.push(`Line ${lineNumber}: currency ${currency} differs from default ${opts.defaultCurrency}`);
    }

    const valueDate =
      idxValue >= 0 ? parseDateCell(cells[idxValue] ?? "") : null;
    const externalReference = idxRef >= 0 ? (cells[idxRef] ?? "").trim() || null : null;
    const externalLineId = idxExtId >= 0 ? (cells[idxExtId] ?? "").trim() || null : null;
    const description = idxDesc >= 0 ? (cells[idxDesc] ?? "").trim() || null : null;
    const runningBalanceMinor =
      idxBal >= 0 ? parseAmountToMinor(cells[idxBal] ?? "") : null;

    const stableRowKey = buildStableRowKey({
      glAccountCode: opts.glAccountCode,
      externalLineId,
      externalReference,
      transactionDate: txDate,
      direction,
      amountMinor,
      currency,
      importIdForFallback: opts.importIdForFallback,
      lineNumber,
    });

    rows.push({
      lineNumber,
      transactionDate: txDate,
      valueDate,
      description,
      externalReference,
      externalLineId,
      direction,
      amountMinor,
      currency,
      runningBalanceMinor,
      rawRow,
      stableRowKey,
    });
  }

  return { rows, errors, warnings, headerRow };
}
