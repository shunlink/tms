import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { paymentProviderId } from "@/lib/payments/config";
import {
  listReconciliationDiscrepancies,
  runPaymentReconciliation,
} from "@/lib/payments/reconciliation.service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const rows = await listReconciliationDiscrepancies();
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const records = await runPaymentReconciliation(paymentProviderId(), auth.user);
    return ok({ count: records.length, records });
  } catch (e) {
    return serverError(e);
  }
}
