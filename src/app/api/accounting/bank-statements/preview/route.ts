import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import {
  BankStatementImportError,
  previewAndStoreBankStatementImport,
  validateUploadMeta,
} from "@/lib/accounting/reconciliation/bank-statement-import.service";
import type { BankStatementColumnMapping } from "@/lib/accounting/reconciliation/bank-statement-types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.import");
  if (denied) return denied;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const glAccountCode = String(form.get("glAccountCode") ?? "1010");
    const bankLabel = form.get("bankLabel") ? String(form.get("bankLabel")) : undefined;
    const mappingRaw = form.get("columnMapping");
    let columnMapping: BankStatementColumnMapping | undefined;
    if (mappingRaw) columnMapping = JSON.parse(String(mappingRaw)) as BankStatementColumnMapping;

    if (!(file instanceof File)) return badRequest("file is required");
    validateUploadMeta({ size: file.size, mimeType: file.type, name: file.name });
    const csvText = await file.text();

    const preview = await previewAndStoreBankStatementImport({
      glAccountCode,
      bankLabel,
      csvText,
      columnMapping,
      fileName: file.name,
      fileSizeBytes: file.size,
      actorId: auth.user.id,
    });

    return ok({
      importId: preview.importId,
      duplicateFile: preview.duplicateFile,
      rowCount: preview.parsed.rows.length,
      errors: preview.parsed.errors,
      warnings: preview.parsed.warnings,
      duplicateRowKeys: preview.duplicateRowKeys,
      sampleRows: preview.parsed.rows.slice(0, 20),
      dataSourceNotice: "Manually uploaded CSV — not a verified live bank feed.",
    });
  } catch (e) {
    if (e instanceof BankStatementImportError) return badRequest(e.message);
    return serverError(e);
  }
}
