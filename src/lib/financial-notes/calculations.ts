import { round2 } from "../finance-reconciliation";
import type { NoteLineInput } from "./types";

export type { NoteLineInput };

export type NoteTotals = {
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export function computeLineAmount(line: NoteLineInput): number {
  const qty = line.quantity ?? 1;
  const unit = line.unitAmount ?? line.amount;
  if (line.unitAmount != null && line.quantity != null) {
    return round2(qty * unit);
  }
  return round2(line.amount);
}

export function computeNoteTotals(lines: NoteLineInput[]): NoteTotals {
  let taxableAmount = 0;
  let taxAmount = 0;
  for (const line of lines) {
    const amount = computeLineAmount(line);
    const lineTax = line.taxAmount ?? (line.taxRate != null ? round2(amount * line.taxRate) : 0);
    taxableAmount += amount;
    taxAmount += lineTax;
  }
  taxableAmount = round2(taxableAmount);
  taxAmount = round2(taxAmount);
  return {
    taxableAmount,
    taxAmount,
    totalAmount: round2(taxableAmount + taxAmount),
  };
}

export function totalsMatchClient(
  submitted: NoteTotals,
  computed: NoteTotals
): boolean {
  return (
    Math.abs(submitted.taxableAmount - computed.taxableAmount) < 0.01 &&
    Math.abs(submitted.taxAmount - computed.taxAmount) < 0.01 &&
    Math.abs(submitted.totalAmount - computed.totalAmount) < 0.01
  );
}
