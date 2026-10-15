import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { BankReconciliationError, voidBankMatch } from "@/lib/accounting/reconciliation/bank-reconciliation.service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.match");
  if (denied) return denied;

  try {
    const body = await req.json();
    const reason = String(body.reason ?? "");
    const match = await voidBankMatch(params.id, auth.user.id!, reason);
    return ok(match);
  } catch (e) {
    if (e instanceof BankReconciliationError) return badRequest(e.message);
    return serverError(e);
  }
}
