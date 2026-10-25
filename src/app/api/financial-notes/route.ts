import { requireAuth, authorize, created, badRequest, serverError, safeOk } from "@/lib/api";
import {
  createFinancialNoteDraft,
  listFinancialNotes,
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

const createSchema = z.object({
  noteType: z.enum(["DEBIT_NOTE", "CREDIT_NOTE"]),
  counterpartyType: z.enum(["VENDOR", "CLIENT"]),
  vendorId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  indentId: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
  indentPodId: z.string().optional().nullable(),
  vendorDeductionReason: z.enum(["SHORTAGE", "DAMAGE", "OTHER"]).optional().nullable(),
  clientInvoiceId: z.string().optional().nullable(),
  tripChargeId: z.string().optional().nullable(),
  businessPurpose: z.string(),
  payableEffect: z.string().optional(),
  reason: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  accountingDate: z.string().datetime().optional(),
  taxJurisdiction: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.view");
  if (denied) return denied;
  const url = new URL(req.url);
  const filters = {
    status: url.searchParams.get("status") ?? undefined,
    noteType: url.searchParams.get("noteType") ?? undefined,
    counterpartyType: url.searchParams.get("counterpartyType") ?? undefined,
    vendorId: url.searchParams.get("vendorId") ?? undefined,
    clientId: url.searchParams.get("clientId") ?? undefined,
    tripId: url.searchParams.get("tripId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
  return safeOk("financial_notes.list", () => listFinancialNotes(filters), []);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "financial_note.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);
    const data = parsed.data;
    const note = await createFinancialNoteDraft(
      {
        ...data,
        accountingDate: data.accountingDate ? new Date(data.accountingDate) : undefined,
      },
      auth!.user
    );
    return created(note);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create note";
    return badRequest(message);
  }
}
