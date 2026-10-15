import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import {
  BankReconciliationError,
  confirmBankMatch,
} from "@/lib/accounting/reconciliation/bank-reconciliation.service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.bank.match");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const match = await confirmBankMatch(params.id, auth.user.id!, {
      rationale: body.rationale,
      varianceExplanation: body.varianceExplanation,
      varianceMinor: body.varianceMinor,
    });
    return ok(match);
  } catch (e) {
    if (e instanceof BankReconciliationError) return badRequest(e.message);
    return serverError(e);
  }
}
