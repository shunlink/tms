import { requireAuth, ok, badRequest, forbidden, unauthorized, serverError } from "@/lib/api";
import { denyUnapprovedClientMutation } from "@/lib/client-portal-mutation-guard";
import {
  cancelInboundPaymentOrder,
  createInboundPaymentOrder,
  getInboundOrderForClient,
  listInboundOrdersForClient,
  pollInboundOrderStatus,
} from "@/lib/payments/inbound/inbound-order.service";
import { hypercheckoutEnabled } from "@/lib/payments/inbound/hypercheckout.service";
import { formatJuspayErrorForUser } from "@/lib/payments/juspay/errors";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "CLIENT" || !auth.user.clientId) return forbidden();

  try {
    const orders = await listInboundOrdersForClient(auth.user.clientId);
    return ok({ orders, enabled: hypercheckoutEnabled() });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "CLIENT" || !auth.user.clientId) return forbidden();
  const denied = await denyUnapprovedClientMutation(auth);
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      purpose?: string;
      invoiceId?: string;
      tripId?: string;
      amount?: number;
      idempotencyKey?: string;
    };

    if (!body.purpose || !["INVOICE", "TRIP_ADVANCE"].includes(body.purpose)) {
      return badRequest("purpose must be INVOICE or TRIP_ADVANCE");
    }
    if (body.amount == null || body.amount <= 0) return badRequest("amount is required");

    const order = await createInboundPaymentOrder({
      clientId: auth.user.clientId,
      purpose: body.purpose as "INVOICE" | "TRIP_ADVANCE",
      invoiceId: body.invoiceId ?? null,
      tripId: body.tripId ?? null,
      amountRupees: body.amount,
      idempotencyKey: body.idempotencyKey,
    });

    return ok(order);
  } catch (e) {
    console.error("[portal] create payment order failed:", e);
    const message = formatJuspayErrorForUser(e);
    return badRequest(message, { code: "VALIDATION_ERROR" });
  }
}
