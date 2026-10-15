import { requireAuth, authorize, badRequest, ok } from "@/lib/api";
import { reverseIssuedFinancialNote } from "@/lib/services/financial-note.service";
import { z } from "zod";

const bodySchema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.reverse");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Reversal reason is required");
    const note = await reverseIssuedFinancialNote(params.id, parsed.data.reason, auth!.user);
    return ok(note);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Reverse failed");
  }
}
