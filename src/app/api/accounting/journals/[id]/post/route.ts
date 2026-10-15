import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { getJournalById, postJournal } from "@/lib/accounting/posting.service";
import { PostingValidationError } from "@/lib/accounting/posting-validation";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.journal.post");
  if (denied) return denied;

  try {
    const existing = await getJournalById(params.id);
    if (!existing) return notFound("Journal not found");
    const journal = await postJournal(params.id, auth.user.id);
    return ok(journal);
  } catch (e) {
    if (e instanceof PostingValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
