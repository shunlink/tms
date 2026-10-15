import type { DraftJournalLineInput } from "../accounting/types";
import { rupeesToMinor } from "../payments/money";
import { resolveMappingForPurpose } from "./account-mappings";
import type { BusinessPurpose, CounterpartyType } from "./types";

export type FinancialNotePostingContext = {
  noteId: string;
  noteNumber: string;
  businessPurpose: BusinessPurpose | string;
  counterpartyType: CounterpartyType;
  vendorId?: string | null;
  clientId?: string | null;
  indentId?: string | null;
  tripId?: string | null;
  taxableAmountInr: number;
  taxAmountInr: number;
  totalAmountInr: number;
  currency: string;
  /** When false, journal still posts but subledger was already updated (e.g. trip charge). */
  includeSubledgerAmount: boolean;
};

/**
 * Build balanced journal lines from explicit business purpose — not from note type alone.
 */
export function buildFinancialNoteJournalLines(
  ctx: FinancialNotePostingContext
): DraftJournalLineInput[] {
  const mapping = resolveMappingForPurpose(ctx.businessPurpose);
  const baseMinor = rupeesToMinor(ctx.taxableAmountInr);
  const taxMinor = rupeesToMinor(ctx.taxAmountInr);
  const totalMinor = rupeesToMinor(ctx.totalAmountInr);

  if (baseMinor + taxMinor !== totalMinor) {
    throw new Error("Note tax components do not sum to total amount");
  }
  if (totalMinor <= 0) {
    throw new Error("Issued note must have a positive total for journal posting");
  }

  const desc = `${ctx.noteNumber} — ${mapping.description}`;
  const dims = {
    vendorId: ctx.counterpartyType === "VENDOR" ? ctx.vendorId ?? undefined : undefined,
    clientId: ctx.counterpartyType === "CLIENT" ? ctx.clientId ?? undefined : undefined,
    indentId: ctx.indentId ?? undefined,
    tripId: ctx.tripId ?? undefined,
  };

  const lines: DraftJournalLineInput[] = [
    {
      accountCode: mapping.debitAccountCode,
      debitMinor: totalMinor,
      description: desc,
      ...dims,
    },
    {
      accountCode: mapping.creditAccountCode,
      creditMinor: totalMinor,
      description: desc,
      ...dims,
    },
  ];

  void ctx.includeSubledgerAmount;
  return lines;
}
