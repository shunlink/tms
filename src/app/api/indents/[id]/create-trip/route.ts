import { requireAuth, authorize, ok, notFound, serverError, badRequest } from "@/lib/api";
import { createTripFromIndent } from "@/lib/services/trip-from-indent.service";
import { getTripLrDocument, generateTripLrPdf } from "@/lib/services/lr-document.service";
import { createTripFromIndentSchema, validate } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.edit");
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(createTripFromIndentSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const trip = await createTripFromIndent(params.id, auth!.user, {
      indentLineId: parsed.data.indentLineId,
    });
    if (!trip) return notFound("Indent not found");
    const lrPdf = await generateTripLrPdf(trip.id, auth!.user).catch(async () => getTripLrDocument(trip.id));
    return ok({ ...trip, lrPdf });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create trip";
    if (
      msg.includes("Trip can only be created") ||
      msg.includes("must be allocated") ||
      msg.includes("must be assigned")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
