import { prisma } from "../prisma";
import { buildSubledgerReconciliationReport } from "./subledger-reconciliation.service";
import { sumJournalSides } from "./posting-validation";

export type PeriodCloseCheck = {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  details?: unknown;
};

export type PeriodCloseValidationReport = {
  periodId: string;
  periodName: string;
  validatedAt: string;
  checks: PeriodCloseCheck[];
  canClose: boolean;
  errorCount: number;
  warningCount: number;
};

export async function validateAccountingPeriodClose(periodId: string): Promise<PeriodCloseValidationReport> {
  const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    return {
      periodId,
      periodName: "Unknown",
      validatedAt: new Date().toISOString(),
      checks: [{ code: "PERIOD_NOT_FOUND", severity: "ERROR", message: "Accounting period not found" }],
      canClose: false,
      errorCount: 1,
      warningCount: 0,
    };
  }

  const checks: PeriodCloseCheck[] = [];

  if (period.status === "CLOSED") {
    checks.push({ code: "ALREADY_CLOSED", severity: "ERROR", message: "Period is already closed" });
  }

  const draftJournals = await prisma.journalEntry.count({
    where: {
      accountingPeriodId: period.id,
      status: "DRAFT",
    },
  });
  if (draftJournals > 0) {
    checks.push({
      code: "DRAFT_JOURNALS",
      severity: "ERROR",
      message: `${draftJournals} draft journal(s) remain in this period`,
      details: { count: draftJournals },
    });
  }

  const posted = await prisma.journalEntry.findMany({
    where: { accountingPeriodId: period.id, status: "POSTED" },
    include: { lines: { select: { debitMinor: true, creditMinor: true } } },
  });
  for (const j of posted) {
    const sides = sumJournalSides(j.lines);
    if (sides.debitMinor !== sides.creditMinor) {
      checks.push({
        code: "UNBALANCED_JOURNAL",
        severity: "ERROR",
        message: `Posted journal ${j.journalNumber} is unbalanced`,
        details: { journalId: j.id, ...sides },
      });
    }
  }

  const subledger = await buildSubledgerReconciliationReport({ asOfDate: period.endDate });
  for (const row of subledger.rows) {
    if (row.differenceMinor !== 0) {
      checks.push({
        code: "SUBLEDGER_GL_DIFF",
        severity: "WARNING",
        message: `Subledger vs GL difference on ${row.controlAccountCode}: ${row.differenceMinor} minor units`,
        details: { account: row.controlAccountCode, differenceMinor: row.differenceMinor },
      });
    }
  }

  const unmatchedBank = await prisma.bankStatementLine.count({
    where: {
      reconStatus: { in: ["UNMATCHED", "SUGGESTED"] },
      transactionDate: { gte: period.startDate, lte: period.endDate },
    },
  });
  if (unmatchedBank > 0) {
    checks.push({
      code: "BANK_RECON_EXCEPTIONS",
      severity: "WARNING",
      message: `${unmatchedBank} bank statement line(s) unmatched or awaiting confirmation`,
      details: { count: unmatchedBank },
    });
  }

  const gatewayOpen = await prisma.reconciliationRecord.count({
    where: {
      status: { in: ["OPEN", "MISMATCH", "UNMATCHED"] },
      createdAt: { gte: period.startDate, lte: period.endDate },
    },
  });
  if (gatewayOpen > 0) {
    checks.push({
      code: "GATEWAY_RECON_EXCEPTIONS",
      severity: "WARNING",
      message: `${gatewayOpen} gateway reconciliation item(s) unresolved`,
      details: { count: gatewayOpen },
    });
  }

  const pendingOutbox = await prisma.paymentOutbox.count({
    where: { status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
  });
  if (pendingOutbox > 0) {
    checks.push({
      code: "PAYMENT_OUTBOX_PENDING",
      severity: "WARNING",
      message: `${pendingOutbox} payment outbox job(s) not completed`,
      details: { count: pendingOutbox },
    });
  }

  const insufficientEvidence = await prisma.reconciliationRecord.count({
    where: { insufficientEvidence: true, status: "MATCHED" },
  });
  if (insufficientEvidence > 0) {
    checks.push({
      code: "LEGACY_MATCHED_WITHOUT_EVIDENCE",
      severity: "WARNING",
      message: `${insufficientEvidence} gateway MATCHED record(s) flagged for evidence review`,
      details: { count: insufficientEvidence },
    });
  }

  const { findOperationalPostingGaps, findStaleVendorPayableAccruals } = await import(
    "./operational-posting-recovery.service"
  );
  const postingGaps = await findOperationalPostingGaps(200);
  if (postingGaps.length > 0) {
    checks.push({
      code: "OPERATIONAL_JOURNAL_GAPS",
      severity: "ERROR",
      message: `${postingGaps.length} operational record(s) missing required POSTED journals`,
      details: { count: postingGaps.length, sample: postingGaps.slice(0, 10) },
    });
  }

  const staleAccruals = await findStaleVendorPayableAccruals(200);
  if (staleAccruals.length > 0) {
    checks.push({
      code: "STALE_VENDOR_PAYABLE_ACCRUAL",
      severity: "WARNING",
      message: `${staleAccruals.length} vendor payable accrual(s) no longer match approved amounts`,
      details: { items: staleAccruals.slice(0, 10) },
    });
  }

  const errorCount = checks.filter((c) => c.severity === "ERROR").length;
  const warningCount = checks.filter((c) => c.severity === "WARNING").length;

  return {
    periodId: period.id,
    periodName: period.name,
    validatedAt: new Date().toISOString(),
    checks,
    canClose: errorCount === 0,
    errorCount,
    warningCount,
  };
}
