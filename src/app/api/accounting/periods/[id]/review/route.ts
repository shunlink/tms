import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { markAccountingPeriodUnderReview } from "@/lib/accounting/accounting-period.service";
import { PostingValidationError } from "@/lib/accounting/posting-validation";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.period.close");
  if (denied) return denied;

  try {
    const period = await markAccountingPeriodUnderReview(params.id, auth.user.id!);
    return ok(period);
  } catch (e) {
    if (e instanceof PostingValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
