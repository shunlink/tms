import { requireAuth, authorize, ok, created, badRequest, unauthorized, notFound, serverError } from "@/lib/api";
import { vendorQuoteSchema, validate } from "@/lib/validation";
import { listQuotesForIndent, submitVendorQuote } from "@/lib/services/quote.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "quote.view");
  if (denied) return denied;
  try {
    const quotes = await listQuotesForIndent(params.id);
    if (quotes === null) return notFound("Indent not found");
    return ok(quotes);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "quote.submit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(vendorQuoteSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    if (parsed.data.quotedRate == null) return badRequest("quotedRate is required");

    const vendorId = auth!.user.role === "VENDOR" ? auth!.user.vendorId : body.vendorId;
    if (!vendorId) return badRequest("vendorId is required");

    const quote = await submitVendorQuote(params.id, vendorId, {
      quotedRate: parsed.data.quotedRate,
      vehicleId: parsed.data.vehicleId,
      remarks: parsed.data.remarks,
      channel: "PORTAL",
    });
    return created(quote);
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("already submitted") ||
        e.message.includes("already recorded") ||
        e.message.includes("first submission wins"))
    ) {
      return badRequest(e.message);
    }
    return serverError(e);
  }
}
