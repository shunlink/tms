import { prisma } from "../prisma";
import { LEGACY_LEDGER_ACCOUNT_MAP } from "./starter-chart";

export type LegacyLedgerIssue = {
  paymentId: string;
  issue: string;
  detail?: string;
};

/**
 * Identifies gateway-era LedgerEntry rows that are not bridged to journals or appear unbalanced.
 * Does not mutate data or fabricate offsetting entries.
 */
export async function auditLegacyPaymentLedger(limit = 500): Promise<{
  issues: LegacyLedgerIssue[];
  scannedPayments: number;
}> {
  const payments = await prisma.outboundPayment.findMany({
    where: { ledgerPostedAt: { not: null } },
    take: limit,
    orderBy: { ledgerPostedAt: "desc" },
    include: {
      ledgerEntries: true,
      journalEntry: { select: { id: true, status: true } },
    },
  });

  const issues: LegacyLedgerIssue[] = [];

  for (const p of payments) {
    if (!p.journalEntry) {
      issues.push({
        paymentId: p.id,
        issue: "MISSING_JOURNAL_BRIDGE",
        detail: "ledgerPostedAt set but no JournalEntry linked",
      });
    }

    const entries = p.ledgerEntries;
    if (entries.length === 0) {
      issues.push({ paymentId: p.id, issue: "NO_LEDGER_ENTRIES" });
      continue;
    }

    let debit = 0;
    let credit = 0;
    for (const e of entries) {
      if (e.entryType === "DEBIT") debit += e.amountMinor;
      else if (e.entryType === "CREDIT") credit += e.amountMinor;
      else {
        issues.push({ paymentId: p.id, issue: "INVALID_ENTRY_TYPE", detail: e.id });
      }
      if (!LEGACY_LEDGER_ACCOUNT_MAP[e.account] && !e.journalLineId) {
        issues.push({
          paymentId: p.id,
          issue: "UNKNOWN_LEGACY_ACCOUNT",
          detail: e.account,
        });
      }
    }
    if (debit !== credit) {
      issues.push({
        paymentId: p.id,
        issue: "UNBALANCED_LEGACY_ENTRIES",
        detail: `debit=${debit} credit=${credit}`,
      });
    }
    if (debit !== p.amountMinor && entries.length === 2) {
      issues.push({
        paymentId: p.id,
        issue: "AMOUNT_MISMATCH",
        detail: `payment ${p.amountMinor} vs ledger ${debit}`,
      });
    }
  }

  return { issues, scannedPayments: payments.length };
}
