import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { validateAccountingPeriodClose } from "@/lib/accounting/period-close-validation.service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.period.validate");
  if (denied) return denied;

  try {
    const report = await validateAccountingPeriodClose(params.id);
    return ok(report);
  } catch (e) {
    return serverError(e);
  }
}
