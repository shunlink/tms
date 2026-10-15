import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { reopenAccountingPeriod } from "@/lib/accounting/accounting-period.service";
import { PostingValidationError } from "@/lib/accounting/posting-validation";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.period.reopen");
  if (denied) return denied;

  try {
    const body = bodySchema.parse(await req.json());
    const period = await reopenAccountingPeriod(params.id, auth.user.id!, body.reason);
    return ok(period);
  } catch (e) {
    if (e instanceof PostingValidationError) return badRequest(e.message);
    if (e instanceof z.ZodError) return badRequest("Reopen reason is required");
    return serverError(e);
  }
}
