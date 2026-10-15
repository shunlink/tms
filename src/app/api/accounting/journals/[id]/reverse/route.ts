import {
  requireAuth,
  authorize,
  ok,
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { getJournalById, reversePostedJournal } from "@/lib/accounting/posting.service";
import { PostingValidationError } from "@/lib/accounting/posting-validation";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  reason: z.string().min(1),
  accountingDate: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.journal.reverse");
  if (denied) return denied;

  try {
    const existing = await getJournalById(params.id);
    if (!existing) return notFound("Journal not found");
    const body = bodySchema.parse(await req.json());
    const reversal = await reversePostedJournal(params.id, auth.user.id!, {
      reason: body.reason,
      accountingDate: body.accountingDate ? new Date(body.accountingDate) : undefined,
    });
    return ok(reversal);
  } catch (e) {
    if (e instanceof PostingValidationError) return badRequest(e.message);
    if (e instanceof z.ZodError) return badRequest("Reversal reason is required");
    return serverError(e);
  }
}
