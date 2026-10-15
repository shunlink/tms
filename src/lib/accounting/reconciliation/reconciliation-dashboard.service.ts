import { prisma } from "../../prisma";
import { paymentProviderId } from "../../payments/config";
import { buildSubledgerReconciliationReport } from "../subledger-reconciliation.service";

export type ReconciliationDashboard = {
  generatedAt: string;
  dataSourceNotice: string;
  bank: {
    importBatches: number;
    unmatchedLines: number;
    suggestedLines: number;
    matchedLines: number;
    lastCommittedImportAt: string | null;
  };
  gateway: {
    providerId: string;
    providerConfigured: boolean;
    settlementCapability: "BLOCKED" | "CSV_IMPORT" | "LIVE";
    openExceptions: number;
    insufficientEvidenceMatched: number;
  };
  subledger: {
    rowsWithDifference: number;
    asOfDate: string;
  };
  ambiguousMatches: number;
  failedImports: number;
};

export async function buildReconciliationDashboard(opts?: {
  glAccountCode?: string;
  from?: Date;
  to?: Date;
}): Promise<ReconciliationDashboard> {
  const from = opts?.from;
  const to = opts?.to;
  const lineDateFilter =
    from || to ? { transactionDate: { gte: from, lte: to } } : {};

  const [
    importBatches,
    unmatchedLines,
    suggestedLines,
    matchedLines,
    lastImport,
    ambiguousMatches,
    failedImports,
    gatewayOpen,
    insufficientEvidence,
    subledger,
  ] = await Promise.all([
    prisma.bankStatementImport.count({ where: { status: "COMMITTED" } }),
    prisma.bankStatementLine.count({
      where: { ...lineDateFilter, reconStatus: "UNMATCHED", glAccountCode: opts?.glAccountCode },
    }),
    prisma.bankStatementLine.count({
      where: { ...lineDateFilter, reconStatus: "SUGGESTED", glAccountCode: opts?.glAccountCode },
    }),
    prisma.bankStatementLine.count({
      where: { ...lineDateFilter, reconStatus: "MATCHED", glAccountCode: opts?.glAccountCode },
    }),
    prisma.bankStatementImport.findFirst({
      where: { status: "COMMITTED" },
      orderBy: { committedAt: "desc" },
      select: { committedAt: true },
    }),
    prisma.bankReconciliationMatch.count({ where: { status: "SUGGESTED" } }),
    prisma.bankStatementImport.count({ where: { status: "FAILED" } }),
    prisma.reconciliationRecord.count({
      where: { status: { in: ["OPEN", "MISMATCH", "UNMATCHED"] } },
    }),
    prisma.reconciliationRecord.count({
      where: { insufficientEvidence: true, status: "MATCHED" },
    }),
    buildSubledgerReconciliationReport({ asOfDate: to ?? new Date() }),
  ]);

  const provider = paymentProviderId();
  const providerConfigured = Boolean(provider && provider !== "none");

  return {
    generatedAt: new Date().toISOString(),
    dataSourceNotice:
      "Bank reconciliation uses manually uploaded CSV statements unless a verified bank feed is configured. None is active in this environment.",
    bank: {
      importBatches,
      unmatchedLines,
      suggestedLines,
      matchedLines,
      lastCommittedImportAt: lastImport?.committedAt?.toISOString() ?? null,
    },
    gateway: {
      providerId: provider ?? "none",
      providerConfigured,
      settlementCapability: providerConfigured ? "CSV_IMPORT" : "BLOCKED",
      openExceptions: gatewayOpen,
      insufficientEvidenceMatched: insufficientEvidence,
    },
    subledger: {
      rowsWithDifference: subledger.rows.filter((r) => r.differenceMinor !== 0).length,
      asOfDate: subledger.asOfDate,
    },
    ambiguousMatches,
    failedImports,
  };
}
