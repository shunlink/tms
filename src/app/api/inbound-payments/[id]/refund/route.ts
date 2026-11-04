import { requireAuth, ok, badRequest, authorize, unauthorized, serverError } from "@/lib/api";
import { initiateInboundRefund } from "@/lib/payments/inbound/inbound-refund.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.payment.manage");
  if (denied) return denied;
  if (!auth) return unauthorized();

  try {
    const body = (await req.json()) as { amount?: number; reason?: string };
    if (body.amount == null || body.amount <= 0) return badRequest("amount is required");

    const refund = await initiateInboundRefund(params.id, { amountRupees: body.amount, reason: body.reason }, auth.user);
    return ok(refund);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refund failed";
    return badRequest(message);
  }
}
