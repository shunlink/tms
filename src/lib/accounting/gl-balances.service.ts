import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { AccountType, NormalBalance } from "./types";
import { normalBalanceForAccountType } from "./types";
import type { AccountBalanceRow } from "./report-types";

export type PostedGlFilter = {
  fromDate?: Date;
  toDate?: Date;
  asOfDate?: Date;
  accountCodes?: string[];
  accountTypes?: AccountType[];
  vendorId?: string;
  clientId?: string;
  currency?: string;
};

const POSTED_JOURNAL_WHERE = { status: "POSTED" as const };

function journalDateWhere(filter: PostedGlFilter): Prisma.JournalEntryWhereInput {
  const date: Prisma.DateTimeFilter = {};
  if (filter.asOfDate) {
    date.lte = filter.asOfDate;
  } else {
    if (filter.fromDate) date.gte = filter.fromDate;
    if (filter.toDate) date.lte = filter.toDate;
  }
  return Object.keys(date).length ? { accountingDate: date } : {};
}

function lineWhere(filter: PostedGlFilter): Prisma.JournalLineWhereInput {
  const journalEntry: Prisma.JournalEntryWhereInput = {
    ...POSTED_JOURNAL_WHERE,
    ...journalDateWhere(filter),
  };
  if (filter.currency) journalEntry.currency = filter.currency;

  const where: Prisma.JournalLineWhereInput = { journalEntry };
  if (filter.vendorId) where.vendorId = filter.vendorId;
  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.accountCodes?.length || filter.accountTypes?.length) {
    where.account = {
      ...(filter.accountCodes?.length ? { code: { in: filter.accountCodes } } : {}),
      ...(filter.accountTypes?.length ? { accountType: { in: filter.accountTypes } } : {}),
    };
  }
  return where;
}

export function presentBalanceMinor(
  debitMinor: number,
  creditMinor: number,
  normalBalance: NormalBalance
): Pick<AccountBalanceRow, "netDebitMinor" | "netCreditMinor" | "signedBalanceMinor"> {
  const net = debitMinor - creditMinor;
  const signed =
    normalBalance === "DEBIT" ? net : -net;
  if (net >= 0) {
    return { netDebitMinor: net, netCreditMinor: 0, signedBalanceMinor: signed };
  }
  return { netDebitMinor: 0, netCreditMinor: -net, signedBalanceMinor: signed };
}

export function rowsFromAggregates(
  aggregates: {
    accountId: string;
    code: string;
    name: string;
    accountType: AccountType;
    normalBalance: NormalBalance;
    parentId: string | null;
    parentCode: string | null;
    debitMinor: number;
    creditMinor: number;
  }[],
  opts?: { includeZero?: boolean }
): AccountBalanceRow[] {
  const rows = aggregates.map((a) => {
    const presentation = presentBalanceMinor(a.debitMinor, a.creditMinor, a.normalBalance);
    return {
      accountId: a.accountId,
      accountCode: a.code,
      accountName: a.name,
      accountType: a.accountType,
      normalBalance: a.normalBalance,
      parentId: a.parentId,
      parentCode: a.parentCode,
      totalDebitMinor: a.debitMinor,
      totalCreditMinor: a.creditMinor,
      ...presentation,
    };
  });
  if (opts?.includeZero) return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  return rows
    .filter((r) => r.totalDebitMinor !== 0 || r.totalCreditMinor !== 0)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/** Aggregate posted journal lines by account (database groupBy). */
export async function aggregatePostedBalancesByAccount(filter: PostedGlFilter) {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: lineWhere(filter),
    _sum: { debitMinor: true, creditMinor: true },
  });
  if (grouped.length === 0) return [];

  const accountIds = grouped.map((g) => g.accountId);
  const accounts = await prisma.chartOfAccount.findMany({
    where: { id: { in: accountIds } },
    include: { parent: { select: { code: true } } },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return grouped
    .map((g) => {
      const account = accountById.get(g.accountId);
      if (!account) return null;
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType as AccountType,
        normalBalance: account.normalBalance as NormalBalance,
        parentId: account.parentId,
        parentCode: account.parent?.code ?? null,
        debitMinor: g._sum.debitMinor ?? 0,
        creditMinor: g._sum.creditMinor ?? 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);
}

/** Net signed balance on one account (minor units) for credit-normal liabilities / revenue. */
export function netSignedMinorForType(
  debitMinor: number,
  creditMinor: number,
  accountType: AccountType
): number {
  const normal = normalBalanceForAccountType(accountType);
  const presentation = presentBalanceMinor(debitMinor, creditMinor, normal);
  return presentation.signedBalanceMinor;
}

export async function sumPostedOnAccount(
  accountCode: string,
  filter: PostedGlFilter
): Promise<{ debitMinor: number; creditMinor: number; signedMinor: number }> {
  const rows = await aggregatePostedBalancesByAccount({
    ...filter,
    accountCodes: [accountCode],
  });
  const row = rows.find((r) => r.code === accountCode);
  const debitMinor = row?.debitMinor ?? 0;
  const creditMinor = row?.creditMinor ?? 0;
  const account = await prisma.chartOfAccount.findUnique({ where: { code: accountCode } });
  const accountType = (account?.accountType ?? "ASSET") as AccountType;
  return {
    debitMinor,
    creditMinor,
    signedMinor: netSignedMinorForType(debitMinor, creditMinor, accountType),
  };
}

export type AccountActivityRow = {
  id: string;
  journalEntryId: string;
  journalNumber: string;
  accountingDate: Date;
  sourceType: string;
  sourceId: string | null;
  description: string | null;
  debitMinor: number;
  creditMinor: number;
};

export async function listPostedAccountActivity(input: {
  accountCode: string;
  fromDate?: Date;
  toDate?: Date;
  vendorId?: string;
  clientId?: string;
  limit: number;
  offset: number;
}) {
  const limit = Math.min(input.limit, 200);
  const where = lineWhere({
    accountCodes: [input.accountCode],
    fromDate: input.fromDate,
    toDate: input.toDate,
    vendorId: input.vendorId,
    clientId: input.clientId,
  });

  const [items, total] = await Promise.all([
    prisma.journalLine.findMany({
      where,
      include: {
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            accountingDate: true,
            sourceType: true,
            sourceId: true,
            description: true,
          },
        },
      },
      orderBy: [{ journalEntry: { accountingDate: "desc" } }, { createdAt: "desc" }],
      take: limit,
      skip: input.offset,
    }),
    prisma.journalLine.count({ where }),
  ]);

  const rows: AccountActivityRow[] = items.map((l) => ({
    id: l.id,
    journalEntryId: l.journalEntry.id,
    journalNumber: l.journalEntry.journalNumber,
    accountingDate: l.journalEntry.accountingDate,
    sourceType: l.journalEntry.sourceType,
    sourceId: l.journalEntry.sourceId,
    description: l.description ?? l.journalEntry.description,
    debitMinor: l.debitMinor,
    creditMinor: l.creditMinor,
  }));

  return { items: rows, total, limit, offset: input.offset };
}
