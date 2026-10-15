import { requireAuth, authorize, badRequest, ok } from "@/lib/api";
import { approveFinancialNote } from "@/lib/services/financial-note.service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.approve");
  if (denied) return denied;
  try {
    const note = await approveFinancialNote(params.id, auth!.user);
    return ok(note);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Approve failed");
  }
}
