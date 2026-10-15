import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  serverError,
  unauthorized,
} from "@/lib/api";
import { createOutboundPaymentDraft, listOutboundPayments } from "@/lib/payments/payment.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const payments = await listOutboundPayments({
      vendorId: url.searchParams.get("vendorId") ?? undefined,
      indentId: url.searchParams.get("indentId") ?? undefined,
      tripId: url.searchParams.get("tripId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      purpose: url.searchParams.get("purpose") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
    return ok(payments);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.create");
  if (denied) return denied;

  try {
    const body = await req.json();
    const idempotencyKey = req.headers.get("idempotency-key") ?? body.idempotencyKey;
    const payment = await createOutboundPaymentDraft(
      {
        purpose: body.purpose,
        amountRupees: Number(body.amountRupees ?? body.amount),
        vendorId: body.vendorId,
        indentId: body.indentId,
        tripId: body.tripId,
        advanceRequestId: body.advanceRequestId,
        balancePaymentTaskId: body.balancePaymentTaskId,
        beneficiaryId: body.beneficiaryId,
        idempotencyKey: idempotencyKey ?? undefined,
      },
      auth.user
    );
    return created(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create payment";
    if (msg.includes("exceeds") || msg.includes("cannot") || msg.includes("required")) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}
