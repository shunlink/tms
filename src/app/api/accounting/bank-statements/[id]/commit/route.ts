import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import {
  BankStatementImportError,
  commitBankStatementImport,
} from "@/lib/accounting/reconciliation/bank-statement-import.service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.import");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const allowDuplicateFile = Boolean(body.allowDuplicateFile);
    const result = await commitBankStatementImport(params.id, auth.user.id!, { allowDuplicateFile });
    return ok(result);
  } catch (e) {
    if (e instanceof BankStatementImportError) return badRequest(e.message);
    return serverError(e);
  }
}
