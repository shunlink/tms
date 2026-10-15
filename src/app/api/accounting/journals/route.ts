import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  serverError,
  unauthorized,
} from "@/lib/api";
import { createDraftJournal, listJournals } from "@/lib/accounting/posting.service";
import { PostingValidationError } from "@/lib/accounting/posting-validation";
import { z } from "zod";

export const runtime = "nodejs";

const lineSchema = z.object({
  accountCode: z.string().min(1),
  debitMinor: z.number().int().nonnegative().optional(),
  creditMinor: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  vendorId: z.string().optional(),
  clientId: z.string().optional(),
  indentId: z.string().optional(),
  tripId: z.string().optional(),
});

const createSchema = z.object({
  accountingDate: z.string(),
  description: z.string().optional(),
  sourceType: z.string().default("MANUAL"),
  sourceId: z.string().optional(),
  idempotencyKey: z.string().min(1),
  currency: z.string().optional(),
  lines: z.array(lineSchema).min(2),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.journal.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const result = await listJournals({
      status: url.searchParams.get("status") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.journal.draft");
  if (denied) return denied;

  try {
    const body = createSchema.parse(await req.json());
    const journal = await createDraftJournal(
      {
        accountingDate: new Date(body.accountingDate),
        description: body.description,
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        idempotencyKey: body.idempotencyKey,
        currency: body.currency,
        lines: body.lines,
        createdById: auth.user.id,
      },
      { manualJournal: body.sourceType === "MANUAL" }
    );
    return created(journal);
  } catch (e) {
    if (e instanceof PostingValidationError) return badRequest(e.message);
    if (e instanceof z.ZodError) return badRequest(e.errors[0]?.message ?? "Invalid input");
    return serverError(e);
  }
}
