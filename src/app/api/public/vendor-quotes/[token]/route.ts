import { vendorQuoteSchema, validate } from "@/lib/validation";
import { badRequest, created, notFound, ok, serverError } from "@/lib/api";
import {
  getPublicVendorQuoteView,
  resolveVendorQuoteAccessToken,
} from "@/lib/services/vendor-quote-access.service";
import { submitVendorQuote } from "@/lib/services/quote.service";
import { sendQuoteAcknowledgement } from "@/lib/adapters/whatsapp";
import { resolveWhatsAppRecipient } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const view = await getPublicVendorQuoteView(params.token);
    if (!view.ok) {
      return notFound(view.reason === "expired" ? "This quote link has expired." : "Quote link not found.");
    }
    return ok(view);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const session = await resolveVendorQuoteAccessToken(params.token);
    if (!session) {
      return notFound("This quote link is invalid or has expired.");
    }

    const view = await getPublicVendorQuoteView(params.token);
    if (!view.ok) {
      return notFound(view.reason === "expired" ? "This quote link has expired." : "Quote link not found.");
    }
    if (!view.canSubmit) {
      return badRequest(view.closedReason ?? view.existingQuote ? "Quote already submitted." : "Cannot submit a quote.");
    }

    const body = await req.json();
    const parsed = validate(vendorQuoteSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    if (parsed.data.quotedRate == null) return badRequest("quotedRate is required");

    const quote = await submitVendorQuote(session.indentId, session.vendorId, {
      quotedRate: parsed.data.quotedRate,
      remarks: parsed.data.remarks,
      channel: "WHATSAPP",
    });

    const to = resolveWhatsAppRecipient(session.vendor);
    if (to) {
      await sendQuoteAcknowledgement(to, {
        indentNumber: session.indent.indentNumber,
        quotedRate: quote.quotedRate,
        vendorName: session.vendor.name,
        entityId: session.indentId,
      }).catch(() => null);
    }

    return created(quote);
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("already submitted") ||
        e.message.includes("already recorded") ||
        e.message.includes("first submission wins") ||
        e.message.includes("no longer open"))
    ) {
      return badRequest(e.message);
    }
    return serverError(e);
  }
}
