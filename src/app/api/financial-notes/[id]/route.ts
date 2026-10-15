import { requireAuth, authorize, badRequest, serverError, ok } from "@/lib/api";
import {
  getFinancialNote,
  updateFinancialNoteDraft,
} from "@/lib/services/financial-note.service";
import { z } from "zod";

const lineSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  description: z.string().optional().nullable(),
  quantity: z.number().positive().optional(),
  unitAmount: z.number().optional(),
  amount: z.number().positive(),
  taxRate: z.number().min(0).max(1).optional().nullable(),
  taxAmount: z.number().min(0).optional(),
});

const patchSchema = z.object({
  reason: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  businessPurpose: z.string().optional(),
  accountingDate: z.string().datetime().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.view");
  if (denied) return denied;
  const note = await getFinancialNote(params.id);
  if (!note) return badRequest("Note not found");
  return ok(note);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);
    const data = parsed.data;
    const note = await updateFinancialNoteDraft(
      params.id,
      {
        ...data,
        accountingDate: data.accountingDate ? new Date(data.accountingDate) : undefined,
      },
      auth!.user
    );
    return ok(note);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Update failed");
  }
}
