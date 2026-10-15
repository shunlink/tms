import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { closeAccountingPeriod } from "@/lib/accounting/accounting-period.service";
import { PostingValidationError } from "@/lib/accounting/posting-validation";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.period.close");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const period = await closeAccountingPeriod(params.id, auth.user.id!, {
      closeNotes: body.closeNotes,
      allowWarnings: Boolean(body.allowWarnings),
      permittedExceptions: body.permittedExceptions,
      reason: body.reason,
    });
    return ok(period);
  } catch (e) {
    if (e instanceof PostingValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
