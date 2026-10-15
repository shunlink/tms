export type InternalBankCandidate = {
  id: string;
  kind: "OUTBOUND_PAYMENT" | "JOURNAL_LINE";
  amountMinor: number;
  currency: string;
  direction: "DEBIT" | "CREDIT";
  transactionDate: Date;
  reference: string | null;
  description: string | null;
  outboundPaymentId?: string;
  journalEntryId?: string;
  journalLineId?: string;
};

export type MatchSuggestion = {
  statementStableKey: string;
  candidate: InternalBankCandidate;
  matchingMethod: "EXACT_REFERENCE" | "CANDIDATE_AMOUNT_DATE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  ambiguous: boolean;
  rationale: string;
};

function normRef(s: string | null | undefined) {
  return (s ?? "").replace(/\s+/g, "").toUpperCase();
}

function sameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export function suggestBankMatches(
  statementRows: {
    stableRowKey: string;
    amountMinor: number;
    currency: string;
    direction: "DEBIT" | "CREDIT";
    transactionDate: Date;
    externalReference: string | null;
    description: string | null;
  }[],
  internals: InternalBankCandidate[]
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  const usedInternal = new Set<string>();

  for (const row of statementRows) {
    const ref = normRef(row.externalReference);
    if (ref) {
      const exact = internals.filter(
        (c) =>
          !usedInternal.has(c.id) &&
          c.currency === row.currency &&
          c.direction === row.direction &&
          c.amountMinor === row.amountMinor &&
          normRef(c.reference) === ref
      );
      if (exact.length === 1) {
        usedInternal.add(exact[0].id);
        suggestions.push({
          statementStableKey: row.stableRowKey,
          candidate: exact[0],
          matchingMethod: "EXACT_REFERENCE",
          confidence: "HIGH",
          ambiguous: false,
          rationale: "Exact reference, amount, currency, and direction match",
        });
        continue;
      }
      if (exact.length > 1) {
        suggestions.push({
          statementStableKey: row.stableRowKey,
          candidate: exact[0],
          matchingMethod: "EXACT_REFERENCE",
          confidence: "LOW",
          ambiguous: true,
          rationale: "Multiple internal rows share the same reference — review required",
        });
        continue;
      }
    }

    const candidates = internals.filter(
      (c) =>
        !usedInternal.has(c.id) &&
        c.currency === row.currency &&
        c.direction === row.direction &&
        c.amountMinor === row.amountMinor &&
        sameDay(c.transactionDate, row.transactionDate)
    );
    if (candidates.length === 1) {
      usedInternal.add(candidates[0].id);
      suggestions.push({
        statementStableKey: row.stableRowKey,
        candidate: candidates[0],
        matchingMethod: "CANDIDATE_AMOUNT_DATE",
        confidence: "MEDIUM",
        ambiguous: false,
        rationale:
          "Amount, currency, direction, and date match — reference not verified; confirm manually",
      });
    } else if (candidates.length > 1) {
      suggestions.push({
        statementStableKey: row.stableRowKey,
        candidate: candidates[0],
        matchingMethod: "CANDIDATE_AMOUNT_DATE",
        confidence: "LOW",
        ambiguous: true,
        rationale: "Multiple candidates with same amount and date — review required",
      });
    }
  }

  return suggestions;
}

export function canAutoConfirmMatch(s: MatchSuggestion): boolean {
  return s.matchingMethod === "EXACT_REFERENCE" && s.confidence === "HIGH" && !s.ambiguous;
}
