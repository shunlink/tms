import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { canAutoConfirmMatch, suggestBankMatches, type InternalBankCandidate } from "./bank-matching";

export class BankReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankReconciliationError";
  }
}

const BANK_GL_CODES = new Set(["1010", "1015"]);

async function loadInternalCandidates(
  glAccountCode: string,
  from: Date,
  to: Date
): Promise<InternalBankCandidate[]> {
  const account = await prisma.chartOfAccount.findUnique({ where: { code: glAccountCode } });
  if (!account) return [];

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: account.id,
      journalEntry: {
        status: "POSTED",
        accountingDate: { gte: from, lte: to },
      },
    },
    include: {
      journalEntry: { select: { id: true, accountingDate: true, journalNumber: true, description: true } },
      outboundPayment: {
        select: {
          id: true,
          providerTransferRef: true,
          paymentNumber: true,
          amountMinor: true,
          currency: true,
          completedAt: true,
        },
      },
    },
    take: 5000,
  });

  const matchedLineIds = await prisma.bankReconciliationMatch.findMany({
    where: { status: "CONFIRMED", journalLineId: { not: null } },
    select: { journalLineId: true },
  });
  const matchedPaymentIds = await prisma.bankReconciliationMatch.findMany({
    where: { status: "CONFIRMED", outboundPaymentId: { not: null } },
    select: { outboundPaymentId: true },
  });
  const usedJournalLines = new Set(matchedLineIds.map((m) => m.journalLineId!));
  const usedPayments = new Set(matchedPaymentIds.map((m) => m.outboundPaymentId!));

  const out: InternalBankCandidate[] = [];
  for (const line of lines) {
    if (usedJournalLines.has(line.id)) continue;
    const debit = line.debitMinor > 0;
    const amountMinor = debit ? line.debitMinor : line.creditMinor;
    if (amountMinor <= 0) continue;
    const ref =
      line.outboundPayment?.providerTransferRef ??
      line.outboundPayment?.paymentNumber ??
      line.journalEntry.journalNumber;
    out.push({
      id: `jl:${line.id}`,
      kind: "JOURNAL_LINE",
      amountMinor,
      currency: line.currency,
      direction: debit ? "DEBIT" : "CREDIT",
      transactionDate: line.journalEntry.accountingDate,
      reference: ref,
      description: line.description ?? line.journalEntry.description,
      journalEntryId: line.journalEntry.id,
      journalLineId: line.id,
      outboundPaymentId: line.outboundPaymentId ?? undefined,
    });
  }

  const payments = await prisma.outboundPayment.findMany({
    where: {
      status: "SUCCEEDED",
      completedAt: { gte: from, lte: to },
    },
    take: 500,
  });
  for (const p of payments) {
    if (usedPayments.has(p.id)) continue;
    out.push({
      id: `op:${p.id}`,
      kind: "OUTBOUND_PAYMENT",
      amountMinor: p.amountMinor,
      currency: p.currency,
      direction: "CREDIT",
      transactionDate: p.completedAt ?? p.updatedAt,
      reference: p.providerTransferRef ?? p.paymentNumber,
      description: `Outbound payment ${p.paymentNumber}`,
      outboundPaymentId: p.id,
    });
  }

  return out;
}

export async function runBankReconciliationSuggestions(input: {
  glAccountCode: string;
  from: Date;
  to: Date;
  actorId?: string;
  autoConfirmExact?: boolean;
}) {
  if (!BANK_GL_CODES.has(input.glAccountCode) && input.glAccountCode !== "1010") {
    // allow any asset bank/clearing account configured in COA
    const acct = await prisma.chartOfAccount.findUnique({ where: { code: input.glAccountCode } });
    if (!acct || acct.accountType !== "ASSET") {
      throw new BankReconciliationError("GL account must be an asset bank/clearing account");
    }
  }

  const lines = await prisma.bankStatementLine.findMany({
    where: {
      glAccountCode: input.glAccountCode,
      transactionDate: { gte: input.from, lte: input.to },
      reconStatus: { in: ["UNMATCHED", "SUGGESTED"] },
    },
    take: 500,
  });

  const internals = await loadInternalCandidates(input.glAccountCode, input.from, input.to);
  const suggestions = suggestBankMatches(
    lines.map((l) => ({
      stableRowKey: l.stableRowKey,
      amountMinor: l.amountMinor,
      currency: l.currency,
      direction: l.direction as "DEBIT" | "CREDIT",
      transactionDate: l.transactionDate,
      externalReference: l.externalReference,
      description: l.description,
    })),
    internals
  );

  const created: string[] = [];
  for (const s of suggestions) {
    const line = lines.find((l) => l.stableRowKey === s.statementStableKey);
    if (!line) continue;

    const existingConfirmed = await prisma.bankReconciliationMatch.findFirst({
      where: { statementLineId: line.id, status: "CONFIRMED" },
    });
    if (existingConfirmed) continue;

    const match = await prisma.bankReconciliationMatch.create({
      data: {
        statementLineId: line.id,
        status: input.autoConfirmExact && canAutoConfirmMatch(s) ? "CONFIRMED" : "SUGGESTED",
        matchingMethod: s.matchingMethod,
        evidenceJson: {
          rationale: s.rationale,
          confidence: s.confidence,
          ambiguous: s.ambiguous,
        } as Prisma.InputJsonValue,
        rationale: s.rationale,
        journalEntryId: s.candidate.journalEntryId,
        journalLineId: s.candidate.journalLineId,
        outboundPaymentId: s.candidate.outboundPaymentId,
        createdById: input.actorId,
        confirmedAt: input.autoConfirmExact && canAutoConfirmMatch(s) ? new Date() : null,
        confirmedById: input.autoConfirmExact && canAutoConfirmMatch(s) ? input.actorId : null,
      },
    });
    created.push(match.id);

    await prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        reconStatus: input.autoConfirmExact && canAutoConfirmMatch(s) ? "MATCHED" : "SUGGESTED",
      },
    });
  }

  if (input.actorId) {
    await prisma.auditLog.create({
      data: {
        userId: input.actorId,
        action: "BANK_RECONCILIATION_SUGGESTIONS_RUN",
        entity: "BankStatementLine",
        meta: JSON.stringify({ glAccountCode: input.glAccountCode, suggestions: created.length }),
      },
    });
  }

  return { suggestionCount: created.length, matchIds: created };
}

export async function confirmBankMatch(
  matchId: string,
  actorId: string,
  input: { rationale?: string; varianceExplanation?: string; varianceMinor?: number }
) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.bankReconciliationMatch.findUnique({ where: { id: matchId } });
    if (!match) throw new BankReconciliationError("Match not found");
    if (match.status === "CONFIRMED") return match;
    if (match.status === "VOIDED") throw new BankReconciliationError("Cannot confirm a voided match");

    const lineConflict = await tx.bankReconciliationMatch.findFirst({
      where: { statementLineId: match.statementLineId, status: "CONFIRMED", id: { not: matchId } },
    });
    if (lineConflict) throw new BankReconciliationError("Statement line already has a confirmed match");

    if (match.outboundPaymentId) {
      const payConflict = await tx.bankReconciliationMatch.findFirst({
        where: { outboundPaymentId: match.outboundPaymentId, status: "CONFIRMED", id: { not: matchId } },
      });
      if (payConflict) throw new BankReconciliationError("Payment already reconciled to another statement line");
    }

    const updated = await tx.bankReconciliationMatch.update({
      where: { id: matchId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmedById: actorId,
        rationale: input.rationale ?? match.rationale,
        varianceMinor: input.varianceMinor ?? match.varianceMinor,
        varianceExplanation: input.varianceExplanation,
      },
    });

    await tx.bankStatementLine.update({
      where: { id: match.statementLineId },
      data: { reconStatus: "MATCHED" },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "BANK_RECONCILIATION_MATCH_CONFIRMED",
        entity: "BankReconciliationMatch",
        entityId: matchId,
        meta: JSON.stringify({ statementLineId: match.statementLineId }),
      },
    });

    return updated;
  });
}

export async function voidBankMatch(matchId: string, actorId: string, reason: string) {
  if (!reason.trim()) throw new BankReconciliationError("Reason is required");
  return prisma.$transaction(async (tx) => {
    const match = await tx.bankReconciliationMatch.findUnique({ where: { id: matchId } });
    if (!match) throw new BankReconciliationError("Match not found");
    if (match.status !== "CONFIRMED" && match.status !== "SUGGESTED") {
      throw new BankReconciliationError("Match cannot be voided");
    }

    const updated = await tx.bankReconciliationMatch.update({
      where: { id: matchId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidedById: actorId,
        rationale: `${match.rationale ?? ""} | Voided: ${reason.trim()}`.trim(),
      },
    });

    await tx.bankStatementLine.update({
      where: { id: match.statementLineId },
      data: { reconStatus: "UNMATCHED" },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "BANK_RECONCILIATION_MATCH_VOIDED",
        entity: "BankReconciliationMatch",
        entityId: matchId,
        meta: JSON.stringify({ reason: reason.trim() }),
      },
    });

    return updated;
  });
}

export async function listBankReconciliationItems(opts: {
  glAccountCode?: string;
  status?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const limit = Math.min(opts.limit ?? 100, 500);
  const lines = await prisma.bankStatementLine.findMany({
    where: {
      glAccountCode: opts.glAccountCode,
      reconStatus: opts.status,
      transactionDate:
        opts.from || opts.to
          ? { gte: opts.from, lte: opts.to }
          : undefined,
    },
    include: {
      matches: { where: { status: { in: ["SUGGESTED", "CONFIRMED"] } } },
      import: { select: { fileName: true, committedAt: true, importSource: true } },
    },
    orderBy: { transactionDate: "desc" },
    take: limit,
  });
  return lines;
}
