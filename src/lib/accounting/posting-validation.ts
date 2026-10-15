import type { DraftJournalLineInput } from "./types";

export type ResolvedJournalLine = DraftJournalLineInput & {
  accountId: string;
  debitMinor: number;
  creditMinor: number;
  currency: string;
};

export type AccountForValidation = {
  id: string;
  code: string;
  isActive: boolean;
  manualPostingAllowed: boolean;
  isSystem: boolean;
};

export class PostingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingValidationError";
  }
}

export function validateLineAmounts(line: { debitMinor: number; creditMinor: number }) {
  const { debitMinor, creditMinor } = line;
  if (debitMinor < 0 || creditMinor < 0) {
    throw new PostingValidationError("Line amounts must be non-negative");
  }
  const hasDebit = debitMinor > 0;
  const hasCredit = creditMinor > 0;
  if (hasDebit === hasCredit) {
    throw new PostingValidationError("Each line must have either a debit or a credit, not both or neither");
  }
}

export function sumJournalSides(lines: { debitMinor: number; creditMinor: number }[]) {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += l.debitMinor;
    credit += l.creditMinor;
  }
  return { debitMinor: debit, creditMinor: credit };
}

export function assertBalancedJournal(lines: { debitMinor: number; creditMinor: number }[]) {
  if (lines.length < 2) {
    throw new PostingValidationError("A journal must contain at least two lines");
  }
  for (const line of lines) validateLineAmounts(line);
  const { debitMinor, creditMinor } = sumJournalSides(lines);
  if (debitMinor !== creditMinor) {
    throw new PostingValidationError(
      `Journal is not balanced: debits ${debitMinor} ≠ credits ${creditMinor}`
    );
  }
  if (debitMinor === 0) {
    throw new PostingValidationError("Journal total must be greater than zero");
  }
}

export function validateAccountForPosting(
  account: AccountForValidation,
  opts: { manualJournal?: boolean }
) {
  if (!account.isActive) {
    throw new PostingValidationError(`Account ${account.code} is inactive`);
  }
  if (opts.manualJournal && !account.manualPostingAllowed) {
    throw new PostingValidationError(`Account ${account.code} does not allow manual posting`);
  }
}

export function buildResolvedLines(
  drafts: DraftJournalLineInput[],
  accountByCode: Map<string, AccountForValidation>,
  currency: string,
  opts: { manualJournal?: boolean }
): ResolvedJournalLine[] {
  if (drafts.length === 0) {
    throw new PostingValidationError("Journal must include at least one line");
  }
  const resolved: ResolvedJournalLine[] = [];
  for (const d of drafts) {
    const account = accountByCode.get(d.accountCode);
    if (!account) {
      throw new PostingValidationError(`Unknown account code: ${d.accountCode}`);
    }
    validateAccountForPosting(account, opts);
    const debitMinor = d.debitMinor ?? 0;
    const creditMinor = d.creditMinor ?? 0;
    validateLineAmounts({ debitMinor, creditMinor });
    resolved.push({
      ...d,
      accountId: account.id,
      debitMinor,
      creditMinor,
      currency,
    });
  }
  assertBalancedJournal(resolved);
  return resolved;
}

/** Build reversal lines (swap debits and credits). */
export function reversalLinesFromPosted(
  lines: { accountCode: string; debitMinor: number; creditMinor: number; description?: string }[]
): DraftJournalLineInput[] {
  return lines.map((l) => ({
    accountCode: l.accountCode,
    debitMinor: l.creditMinor,
    creditMinor: l.debitMinor,
    description: l.description ? `Reversal: ${l.description}` : "Reversal",
  }));
}
