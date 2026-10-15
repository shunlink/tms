import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { nextNumber } from "../sequence";
import { resolveOpenPeriodForDate } from "./accounting-period.service";
import { ensureChartOfAccounts } from "./chart-of-accounts.service";
import {
  buildResolvedLines,
  PostingValidationError,
  reversalLinesFromPosted,
} from "./posting-validation";
import {
  buildOutboundPaymentSettlementLines,
  type OutboundPaymentPostingContext,
} from "./posting-rules";
import { LEGACY_LEDGER_ACCOUNT_MAP } from "./starter-chart";
import type { CreateDraftJournalInput } from "./types";

const journalInclude = {
  lines: { include: { account: { select: { code: true, name: true, accountType: true } } } },
  accountingPeriod: true,
};

export async function isSourcePosted(sourceType: string, sourceId: string) {
  const row = await prisma.journalEntry.findFirst({
    where: { sourceType, sourceId, status: "POSTED" },
    select: { id: true, journalNumber: true },
  });
  return row;
}

export async function getJournalBySource(sourceType: string, sourceId: string) {
  return prisma.journalEntry.findFirst({
    where: { sourceType, sourceId },
    include: journalInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getJournalById(id: string) {
  return prisma.journalEntry.findUnique({ where: { id }, include: journalInclude });
}

export async function listJournals(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(opts?.limit ?? 50, 200);
  const offset = opts?.offset ?? 0;
  const [items, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where: opts?.status ? { status: opts.status } : undefined,
      include: journalInclude,
      orderBy: [{ accountingDate: "desc" }, { journalNumber: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.journalEntry.count({
      where: opts?.status ? { status: opts.status } : undefined,
    }),
  ]);
  return { items, total, limit, offset };
}

async function loadAccountsByCode(
  codes: string[],
  tx: Prisma.TransactionClient
) {
  const accounts = await tx.chartOfAccount.findMany({
    where: { code: { in: codes } },
  });
  const map = new Map(accounts.map((a) => [a.code, a]));
  return map;
}

export async function validateDraftJournal(
  input: CreateDraftJournalInput,
  opts?: { manualJournal?: boolean }
) {
  const currency = input.currency ?? "INR";
  const codes = Array.from(new Set(input.lines.map((l) => l.accountCode)));
  const accountByCode = await loadAccountsByCode(codes, prisma);
  const resolved = buildResolvedLines(input.lines, accountByCode, currency, {
    manualJournal: opts?.manualJournal,
  });
  await resolveOpenPeriodForDate(input.accountingDate);
  return { resolved, currency };
}

export async function createDraftJournal(
  input: CreateDraftJournalInput,
  opts?: { manualJournal?: boolean; tx?: Prisma.TransactionClient }
) {
  const db = opts?.tx ?? prisma;
  const existing = await db.journalEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: journalInclude,
  });
  if (existing) return existing;

  const currency = input.currency ?? "INR";
  const codes = Array.from(new Set(input.lines.map((l) => l.accountCode)));
  const accountByCode = await loadAccountsByCode(codes, db);
  const resolved = buildResolvedLines(input.lines, accountByCode, currency, {
    manualJournal: opts?.manualJournal,
  });
  const period = await resolveOpenPeriodForDate(input.accountingDate, db);
  const journalNumber = await nextNumber("JRN");

  try {
    return await db.journalEntry.create({
      data: {
        journalNumber,
        accountingDate: input.accountingDate,
        status: "DRAFT",
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        currency,
        accountingPeriodId: period.id,
        outboundPaymentId: input.outboundPaymentId,
        createdById: input.createdById,
        approvedById: input.approvedById,
        lines: {
          create: resolved.map((l) => ({
            accountId: l.accountId,
            debitMinor: l.debitMinor,
            creditMinor: l.creditMinor,
            currency: l.currency,
            description: l.description,
            vendorId: l.vendorId,
            clientId: l.clientId,
            indentId: l.indentId,
            tripId: l.tripId,
            outboundPaymentId: l.outboundPaymentId,
          })),
        },
      },
      include: journalInclude,
    });
  } catch (e) {
    const dup = await db.journalEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: journalInclude,
    });
    if (dup) return dup;
    throw e;
  }
}

export async function postJournal(
  journalId: string,
  actorId?: string | null,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    const journal = await client.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: { include: { account: true } } },
    });
    if (!journal) throw new PostingValidationError("Journal not found");
    if (journal.status === "POSTED") return journal;
    if (journal.status === "REVERSED") {
      throw new PostingValidationError("Cannot post a reversed journal");
    }
    if (journal.status !== "DRAFT") {
      throw new PostingValidationError(`Cannot post journal in status ${journal.status}`);
    }

    await resolveOpenPeriodForDate(journal.accountingDate, client);

    const manual = journal.sourceType === "MANUAL";
    const resolved = buildResolvedLines(
      journal.lines.map((l) => ({
        accountCode: l.account.code,
        debitMinor: l.debitMinor,
        creditMinor: l.creditMinor,
        description: l.description ?? undefined,
        vendorId: l.vendorId ?? undefined,
        clientId: l.clientId ?? undefined,
        indentId: l.indentId ?? undefined,
        tripId: l.tripId ?? undefined,
        outboundPaymentId: l.outboundPaymentId ?? undefined,
      })),
      new Map(journal.lines.map((l) => [l.account.code, l.account])),
      journal.currency,
      { manualJournal: manual }
    );
    void resolved;

    const updated = await client.journalEntry.updateMany({
      where: { id: journalId, status: "DRAFT" },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById: actorId ?? undefined,
      },
    });
    if (updated.count === 0) {
      const again = await client.journalEntry.findUnique({ where: { id: journalId } });
      if (again?.status === "POSTED") return again;
      throw new PostingValidationError("Journal could not be posted");
    }

    return client.journalEntry.findUnique({
      where: { id: journalId },
      include: journalInclude,
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

export async function reversePostedJournal(
  journalId: string,
  actorId: string,
  opts?: { accountingDate?: Date; reason?: string }
) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: { include: { account: true } }, reversedByJournal: true },
    });
    if (!original) throw new PostingValidationError("Journal not found");
    if (original.status !== "POSTED") {
      throw new PostingValidationError("Only posted journals can be reversed");
    }
    if (original.reversedByJournal) {
      return original.reversedByJournal;
    }

    const accountingDate = opts?.accountingDate ?? new Date();
    const reversalDrafts = reversalLinesFromPosted(
      original.lines.map((l) => ({
        accountCode: l.account.code,
        debitMinor: l.debitMinor,
        creditMinor: l.creditMinor,
        description: l.description ?? undefined,
      }))
    );

    const idempotencyKey = `reversal:${original.id}`;
    const reversal = await createDraftJournal(
      {
        accountingDate,
        description: opts?.reason ?? `Reversal of ${original.journalNumber}`,
        sourceType: "REVERSAL",
        sourceId: original.id,
        idempotencyKey,
        currency: original.currency,
        lines: reversalDrafts,
        createdById: actorId,
      },
      { manualJournal: false, tx }
    );
    if (!reversal) throw new PostingValidationError("Reversal draft failed");

    const posted = await postJournal(reversal.id, actorId, tx);
    if (!posted) throw new PostingValidationError("Reversal posting failed");

    await tx.journalEntry.update({
      where: { id: reversal.id },
      data: { reversesJournalId: original.id },
    });

    await tx.journalEntry.update({
      where: { id: original.id },
      data: { status: "REVERSED", reversedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "JOURNAL_REVERSED",
        entity: "JournalEntry",
        entityId: original.id,
        meta: JSON.stringify({ reversalJournalId: reversal.id }),
      },
    });

    return tx.journalEntry.findUnique({
      where: { id: reversal.id },
      include: journalInclude,
    });
  });
}

async function mirrorLegacyLedgerEntries(
  tx: Prisma.TransactionClient,
  journalId: string,
  paymentId: string
) {
  const journal = await tx.journalEntry.findUnique({
    where: { id: journalId },
    include: { lines: { include: { account: true } } },
  });
  if (!journal) return;

  const existing = await tx.ledgerEntry.count({ where: { paymentId } });
  if (existing > 0) {
    await tx.ledgerEntry.updateMany({
      where: { paymentId, journalEntryId: null },
      data: { journalEntryId: journalId },
    });
    return;
  }

  for (const line of journal.lines) {
    const legacyAccount =
      Object.entries(LEGACY_LEDGER_ACCOUNT_MAP).find(([, code]) => code === line.account.code)?.[0] ??
      line.account.code;
    const entryType = line.debitMinor > 0 ? "DEBIT" : "CREDIT";
    const amountMinor = line.debitMinor > 0 ? line.debitMinor : line.creditMinor;
    await tx.ledgerEntry.create({
      data: {
        paymentId,
        entryType,
        account: legacyAccount,
        amountMinor,
        currency: line.currency,
        description: line.description,
        journalEntryId: journalId,
        journalLineId: line.id,
      },
    });
  }
}

/**
 * Idempotent posting for successful outbound gateway payments.
 * Single path: journal is authoritative; LedgerEntry rows are a compatibility mirror.
 */
export async function postOutboundPaymentJournal(
  tx: Prisma.TransactionClient,
  ctx: OutboundPaymentPostingContext & { actorId?: string | null }
) {
  await ensureChartOfAccounts(tx);

  const idempotencyKey = `outbound_payment:${ctx.paymentId}`;
  const existing = await tx.journalEntry.findUnique({
    where: { idempotencyKey },
    include: journalInclude,
  });
  if (existing?.status === "POSTED") {
    await mirrorLegacyLedgerEntries(tx, existing.id, ctx.paymentId);
    return existing;
  }

  const lines = buildOutboundPaymentSettlementLines(ctx);
  const accountingDate = new Date();

  let journal = existing;
  if (!journal) {
    const period = await resolveOpenPeriodForDate(accountingDate, tx);
    const journalNumber = await nextNumber("JRN");
    const codes = lines.map((l) => l.accountCode);
    const accountByCode = await loadAccountsByCode(codes, tx);
    const resolved = buildResolvedLines(lines, accountByCode, ctx.currency, {
      manualJournal: false,
    });

    try {
      journal = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate,
          status: "DRAFT",
          description: lines[0]?.description,
          sourceType: "OUTBOUND_PAYMENT",
          sourceId: ctx.paymentId,
          idempotencyKey,
          currency: ctx.currency,
          accountingPeriodId: period.id,
          outboundPaymentId: ctx.paymentId,
          createdById: ctx.actorId ?? undefined,
          lines: {
            create: resolved.map((l) => ({
              accountId: l.accountId,
              debitMinor: l.debitMinor,
              creditMinor: l.creditMinor,
              currency: l.currency,
              description: l.description,
              vendorId: l.vendorId,
              indentId: l.indentId,
              tripId: l.tripId,
              outboundPaymentId: l.outboundPaymentId,
            })),
          },
        },
        include: journalInclude,
      });
    } catch {
      journal = await tx.journalEntry.findUnique({
        where: { idempotencyKey },
        include: journalInclude,
      });
      if (!journal) throw new PostingValidationError("Concurrent posting conflict");
    }
  }

  if (journal.status === "DRAFT") {
    await postJournal(journal.id, ctx.actorId, tx);
    journal = await tx.journalEntry.findUnique({
      where: { id: journal.id },
      include: journalInclude,
    });
  }

  if (journal) {
    await mirrorLegacyLedgerEntries(tx, journal.id, ctx.paymentId);
  }

  return journal;
}
