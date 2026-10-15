import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { PostingValidationError } from "./posting-validation";

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

export async function ensureDefaultAccountingPeriods(tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const year = new Date().getFullYear();
  const name = `FY ${year}`;
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 11, 31));

  const existing = await db.accountingPeriod.findFirst({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (existing) return existing;

  return db.accountingPeriod.create({
    data: { name, startDate, endDate, status: "OPEN" },
  });
}

export async function listAccountingPeriods() {
  return prisma.accountingPeriod.findMany({ orderBy: { startDate: "desc" } });
}

export async function resolveOpenPeriodForDate(
  accountingDate: Date,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; status: string }> {
  const db = tx ?? prisma;
  const day = startOfDay(accountingDate);
  const period = await db.accountingPeriod.findFirst({
    where: {
      startDate: { lte: day },
      endDate: { gte: day },
    },
    orderBy: { startDate: "desc" },
  });
  if (!period) {
    throw new PostingValidationError("No accounting period covers this date");
  }
  if (period.status !== "OPEN") {
    throw new PostingValidationError(
      period.status === "UNDER_REVIEW"
        ? "Accounting period is under review — posting is blocked"
        : "Accounting period is closed for this date"
    );
  }
  return period;
}

export async function markAccountingPeriodUnderReview(periodId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new PostingValidationError("Accounting period not found");
    if (period.status !== "OPEN") throw new PostingValidationError("Only open periods can enter review");
    const updated = await tx.accountingPeriod.update({
      where: { id: periodId },
      data: { status: "UNDER_REVIEW" },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "ACCOUNTING_PERIOD_UNDER_REVIEW",
        entity: "AccountingPeriod",
        entityId: periodId,
      },
    });
    return updated;
  });
}

export async function closeAccountingPeriod(
  periodId: string,
  actorId: string,
  opts?: {
    reason?: string;
    closeNotes?: string;
    validationReport?: unknown;
    permittedExceptions?: unknown;
    allowWarnings?: boolean;
  }
) {
  const { validateAccountingPeriodClose } = await import("./period-close-validation.service");
  const validation = await validateAccountingPeriodClose(periodId);
  if (!validation.canClose) {
    throw new PostingValidationError(
      `Period close blocked: ${validation.errorCount} error(s). Run validation report for details.`
    );
  }
  if (validation.warningCount > 0 && !opts?.allowWarnings) {
    throw new PostingValidationError(
      `Period has ${validation.warningCount} unresolved warning(s). Close with allowWarnings and documented permittedExceptions.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new PostingValidationError("Accounting period not found");
    if (period.status === "CLOSED") return period;

    const others = await tx.accountingPeriod.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] }, id: { not: periodId } },
    });
    for (const o of others) {
      if (datesOverlap(period.startDate, period.endDate, o.startDate, o.endDate)) {
        throw new PostingValidationError("Cannot close period while overlapping open periods exist");
      }
    }

    const updated = await tx.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: actorId,
        reopenedAt: null,
        reopenedById: null,
        reopenReason: null,
        closeNotes: opts?.closeNotes ?? null,
        closeValidationReport: (opts?.validationReport ?? validation) as Prisma.InputJsonValue,
        permittedExceptions:
          opts?.permittedExceptions != null
            ? (opts.permittedExceptions as Prisma.InputJsonValue)
            : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "ACCOUNTING_PERIOD_CLOSED",
        entity: "AccountingPeriod",
        entityId: periodId,
        meta: JSON.stringify({
          reason: opts?.reason ?? null,
          warningCount: validation.warningCount,
          allowWarnings: opts?.allowWarnings ?? false,
        }),
      },
    });

    return updated;
  });
}

export async function reopenAccountingPeriod(
  periodId: string,
  actorId: string,
  reason: string
) {
  if (!reason.trim()) {
    throw new PostingValidationError("Reopen reason is required");
  }
  return prisma.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new PostingValidationError("Accounting period not found");
    if (period.status !== "CLOSED" && period.status !== "UNDER_REVIEW") {
      throw new PostingValidationError("Only closed or under-review periods can be reopened to OPEN");
    }

    const updated = await tx.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: "OPEN",
        reopenedAt: new Date(),
        reopenedById: actorId,
        reopenReason: reason.trim(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "ACCOUNTING_PERIOD_REOPENED",
        entity: "AccountingPeriod",
        entityId: periodId,
        meta: JSON.stringify({ reason: reason.trim() }),
      },
    });

    return updated;
  });
}
