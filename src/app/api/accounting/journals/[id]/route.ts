import { requireAuth, authorize, ok, notFound, serverError, unauthorized } from "@/lib/api";
import { getJournalById } from "@/lib/accounting/posting.service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.journal.view");
  if (denied) return denied;

  try {
    const journal = await getJournalById(params.id);
    if (!journal) return notFound("Journal not found");
    return ok(journal);
  } catch (e) {
    return serverError(e);
  }
}
