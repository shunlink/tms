import { requireAuth, ok, badRequest, forbidden, unauthorized, notFound, serverError } from "@/lib/api";
import { denyUnapprovedClientMutation } from "@/lib/client-portal-mutation-guard";
import { cancelInboundPaymentOrder } from "@/lib/payments/inbound/inbound-order.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "CLIENT" || !auth.user.clientId) return forbidden();
  const denied = await denyUnapprovedClientMutation(auth);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const result = await cancelInboundPaymentOrder(
      params.id,
      auth.user.clientId,
      body.reason ?? "Cancelled by client"
    );
    if (!result) return notFound("Order not found");
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cancel failed";
    return badRequest(message);
  }
}
