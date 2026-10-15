import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { STARTER_CHART_OF_ACCOUNTS, starterAccountRow } from "./starter-chart";

export async function ensureChartOfAccounts(tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const idByCode = new Map<string, string>();

  for (const def of STARTER_CHART_OF_ACCOUNTS) {
    const row = starterAccountRow(def);
    const account = await db.chartOfAccount.upsert({
      where: { code: def.code },
      create: {
        ...row,
        parentId: null,
      },
      update: {
        name: row.name,
        accountType: row.accountType,
        normalBalance: row.normalBalance,
        isSystem: row.isSystem,
        manualPostingAllowed: row.manualPostingAllowed,
        description: row.description,
        // do not auto-reactivate accounts finance disabled
      },
    });
    idByCode.set(def.code, account.id);
  }

  for (const def of STARTER_CHART_OF_ACCOUNTS) {
    if (!def.parentCode) continue;
    const parentId = idByCode.get(def.parentCode);
    const selfId = idByCode.get(def.code);
    if (!parentId || !selfId) continue;
    await db.chartOfAccount.update({
      where: { id: selfId },
      data: { parentId },
    });
  }

  return db.chartOfAccount.findMany({ orderBy: { code: "asc" } });
}

export async function listChartOfAccounts(filters?: { activeOnly?: boolean }) {
  return prisma.chartOfAccount.findMany({
    where: filters?.activeOnly ? { isActive: true } : undefined,
    orderBy: { code: "asc" },
    include: { parent: { select: { code: true, name: true } } },
  });
}

export async function getChartOfAccountByCode(code: string) {
  return prisma.chartOfAccount.findUnique({ where: { code } });
}

export async function getChartOfAccountById(id: string) {
  return prisma.chartOfAccount.findUnique({ where: { id } });
}
