import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import {
  BankReconciliationError,
  runBankReconciliationSuggestions,
} from "@/lib/accounting/reconciliation/bank-reconciliation.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.match");
  if (denied) return denied;

  try {
    const body = await req.json();
    const glAccountCode = String(body.glAccountCode ?? "1010");
    const from = new Date(body.from);
    const to = new Date(body.to);
    const result = await runBankReconciliationSuggestions({
      glAccountCode,
      from,
      to,
      actorId: auth.user.id,
      autoConfirmExact: Boolean(body.autoConfirmExact),
    });
    return ok(result);
  } catch (e) {
    if (e instanceof BankReconciliationError) return badRequest(e.message);
    return serverError(e);
  }
}
