import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { listBankStatementImports } from "@/lib/accounting/reconciliation/bank-statement-import.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const glAccountCode = url.searchParams.get("glAccountCode") ?? undefined;
    const items = await listBankStatementImports({ glAccountCode });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}
