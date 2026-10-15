import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import {
  parseBankStatementCsv,
  sha256Hex,
} from "./bank-statement-csv";
import {
  BANK_STATEMENT_ALLOWED_MIME,
  BANK_STATEMENT_MAX_BYTES,
  DEFAULT_BANK_CSV_MAPPING,
  type BankStatementColumnMapping,
} from "./bank-statement-types";

export class BankStatementImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankStatementImportError";
  }
}

export function validateUploadMeta(file: { size: number; mimeType?: string | null; name?: string }) {
  if (file.size <= 0) throw new BankStatementImportError("Empty file");
  if (file.size > BANK_STATEMENT_MAX_BYTES) {
    throw new BankStatementImportError(`File exceeds ${BANK_STATEMENT_MAX_BYTES} bytes`);
  }
  const ext = (file.name ?? "").toLowerCase();
  if (file.mimeType && !BANK_STATEMENT_ALLOWED_MIME.has(file.mimeType) && !ext.endsWith(".csv")) {
    throw new BankStatementImportError("Only CSV uploads are supported");
  }
}

export async function previewBankStatementImport(input: {
  glAccountCode: string;
  bankLabel?: string;
  csvText: string;
  columnMapping?: BankStatementColumnMapping;
  defaultCurrency?: string;
  fileName?: string;
  fileSha256?: string;
  fileSizeBytes?: number;
  actorId?: string;
}) {
  const mapping = input.columnMapping ?? DEFAULT_BANK_CSV_MAPPING;
  const defaultCurrency = input.defaultCurrency ?? "INR";
  const account = await prisma.chartOfAccount.findUnique({ where: { code: input.glAccountCode } });
  if (!account) throw new BankStatementImportError(`Unknown GL account code: ${input.glAccountCode}`);

  const fileSha256 = input.fileSha256 ?? sha256Hex(input.csvText);
  const duplicateImport = await prisma.bankStatementImport.findFirst({
    where: {
      glAccountCode: input.glAccountCode,
      fileSha256,
      status: "COMMITTED",
    },
  });

  const parsed = parseBankStatementCsv(input.csvText, mapping, {
    defaultCurrency,
    glAccountCode: input.glAccountCode,
  });

  const existingKeys = new Set<string>();
  if (parsed.rows.length > 0) {
    const keys = parsed.rows.map((r) => r.stableRowKey);
    const existing = await prisma.bankStatementLine.findMany({
      where: { stableRowKey: { in: keys } },
      select: { stableRowKey: true },
    });
    for (const e of existing) existingKeys.add(e.stableRowKey);
  }

  const duplicateRowKeys = parsed.rows
    .filter((r) => existingKeys.has(r.stableRowKey))
    .map((r) => r.stableRowKey);

  const preview = await prisma.bankStatementImport.create({
    data: {
      glAccountCode: input.glAccountCode,
      bankLabel: input.bankLabel,
      fileName: input.fileName,
      fileSha256,
      fileSizeBytes: input.fileSizeBytes ?? Buffer.byteLength(input.csvText, "utf8"),
      mimeType: "text/csv",
      columnMapping: mapping as Prisma.InputJsonValue,
      status: "PREVIEW",
      rowCount: parsed.rows.length,
      duplicateOfId: duplicateImport?.id,
      importedById: input.actorId,
      validationReport: {
        errors: parsed.errors,
        warnings: parsed.warnings,
        duplicateFile: Boolean(duplicateImport),
        duplicateRowKeys,
        headerRow: parsed.headerRow,
        dataSource: "MANUAL_CSV_NOT_VERIFIED_BANK_FEED",
      } as Prisma.InputJsonValue,
    },
  });

  return {
    importId: preview.id,
    duplicateFile: Boolean(duplicateImport),
    duplicateImportId: duplicateImport?.id ?? null,
    parsed,
    duplicateRowKeys,
  };
}

export async function commitBankStatementImport(
  importId: string,
  actorId: string,
  opts?: { allowDuplicateFile?: boolean }
) {
  return prisma.$transaction(async (tx) => {
    const imp = await tx.bankStatementImport.findUnique({ where: { id: importId } });
    if (!imp) throw new BankStatementImportError("Import not found");
    if (imp.status !== "PREVIEW") throw new BankStatementImportError("Import is not in preview state");

    const report = imp.validationReport as {
      errors?: { lineNumber: number; message: string }[];
      duplicateFile?: boolean;
    } | null;
    if (report?.errors?.length) {
      throw new BankStatementImportError("Cannot commit import with validation errors");
    }
    if (report?.duplicateFile && !opts?.allowDuplicateFile) {
      throw new BankStatementImportError(
        "Identical file was already committed for this account — set allowDuplicateFile to override"
      );
    }

    const csvMapping = imp.columnMapping as BankStatementColumnMapping;
    const stored = await tx.bankStatementImport.findUnique({ where: { id: importId } });
    if (!stored) throw new BankStatementImportError("Import not found");

    const validation = stored.validationReport as { headerRow?: string[] } | null;
    if (!validation) throw new BankStatementImportError("Missing validation report — re-upload for preview");

    const rows = await tx.bankStatementLine.findMany({ where: { importId } });
    if (rows.length > 0) {
      throw new BankStatementImportError("Import already has lines");
    }

    const previewRows = (stored.validationReport as { previewRows?: unknown }).previewRows;
    if (!Array.isArray(previewRows)) {
      throw new BankStatementImportError(
        "Preview rows not stored — call preview with storeRows or re-parse on commit"
      );
    }

    let lineCount = 0;
    for (const r of previewRows as {
      lineNumber: number;
      transactionDate: string;
      valueDate: string | null;
      description: string | null;
      externalReference: string | null;
      externalLineId: string | null;
      direction: string;
      amountMinor: number;
      currency: string;
      runningBalanceMinor: number | null;
      rawRow: Record<string, string>;
      stableRowKey: string;
    }[]) {
      const existing = await tx.bankStatementLine.findUnique({
        where: { glAccountCode_stableRowKey: { glAccountCode: imp.glAccountCode, stableRowKey: r.stableRowKey } },
      });
      if (existing) {
        await tx.bankStatementLine.create({
          data: {
            importId,
            glAccountCode: imp.glAccountCode,
            lineNumber: r.lineNumber,
            externalLineId: r.externalLineId,
            stableRowKey: `${r.stableRowKey}|dup:${importId}:${r.lineNumber}`,
            transactionDate: new Date(r.transactionDate),
            valueDate: r.valueDate ? new Date(r.valueDate) : null,
            description: r.description,
            externalReference: r.externalReference,
            direction: r.direction,
            amountMinor: r.amountMinor,
            currency: r.currency,
            runningBalanceMinor: r.runningBalanceMinor,
            rawRow: r.rawRow,
            reconStatus: "DUPLICATE_ROW",
          },
        });
        continue;
      }

      await tx.bankStatementLine.create({
        data: {
          importId,
          glAccountCode: imp.glAccountCode,
          lineNumber: r.lineNumber,
          externalLineId: r.externalLineId,
          stableRowKey: r.stableRowKey,
          transactionDate: new Date(r.transactionDate),
          valueDate: r.valueDate ? new Date(r.valueDate) : null,
          description: r.description,
          externalReference: r.externalReference,
          direction: r.direction,
          amountMinor: r.amountMinor,
          currency: r.currency,
          runningBalanceMinor: r.runningBalanceMinor,
          rawRow: r.rawRow,
          reconStatus: "UNMATCHED",
        },
      });
      lineCount++;
    }

    const updated = await tx.bankStatementImport.update({
      where: { id: importId },
      data: {
        status: "COMMITTED",
        committedAt: new Date(),
        rowCount: lineCount,
        importedById: actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "BANK_STATEMENT_IMPORT_COMMITTED",
        entity: "BankStatementImport",
        entityId: importId,
        meta: JSON.stringify({ glAccountCode: imp.glAccountCode, rowCount: lineCount, columnMapping: csvMapping }),
      },
    });

    return updated;
  });
}

/** Preview and persist parsed rows on the import record for commit. */
export async function previewAndStoreBankStatementImport(
  input: Parameters<typeof previewBankStatementImport>[0]
) {
  const preview = await previewBankStatementImport(input);
  await prisma.bankStatementImport.update({
    where: { id: preview.importId },
    data: {
      validationReport: {
        ...(preview.parsed as unknown as Record<string, unknown>),
        errors: preview.parsed.errors,
        warnings: preview.parsed.warnings,
        duplicateFile: preview.duplicateFile,
        duplicateRowKeys: preview.duplicateRowKeys,
        headerRow: preview.parsed.headerRow,
        dataSource: "MANUAL_CSV_NOT_VERIFIED_BANK_FEED",
        previewRows: preview.parsed.rows.map((r) => ({
          ...r,
          transactionDate: r.transactionDate.toISOString(),
          valueDate: r.valueDate?.toISOString() ?? null,
        })),
      },
    },
  });
  return preview;
}

export async function listBankStatementImports(opts?: { glAccountCode?: string; limit?: number }) {
  return prisma.bankStatementImport.findMany({
    where: opts?.glAccountCode ? { glAccountCode: opts.glAccountCode } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit ?? 50, 200),
    include: { importedBy: { select: { name: true, email: true } } },
  });
}
