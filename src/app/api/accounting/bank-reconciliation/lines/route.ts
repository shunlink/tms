import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { listBankReconciliationItems } from "@/lib/accounting/reconciliation/bank-reconciliation.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const glAccountCode = url.searchParams.get("glAccountCode") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const lines = await listBankReconciliationItems({
      glAccountCode,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return ok(lines);
  } catch (e) {
    return serverError(e);
  }
}
