import { requireAuth, authorize, created, badRequest } from "@/lib/api";
import { createNoteFromTripCharge } from "@/lib/services/financial-note.service";
import { z } from "zod";

const bodySchema = z.object({
  tripChargeId: z.string().min(1),
  reason: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);
    const note = await createNoteFromTripCharge(
      parsed.data.tripChargeId,
      auth!.user,
      { reason: parsed.data.reason, description: parsed.data.description }
    );
    return created(note);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Failed to create note from charge");
  }
}
