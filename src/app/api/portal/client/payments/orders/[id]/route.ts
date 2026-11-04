import { requireAuth, ok, forbidden, unauthorized, notFound, serverError } from "@/lib/api";
import { getInboundOrderForClient, pollInboundOrderStatus, refreshInboundCheckoutSessionIfNeeded } from "@/lib/payments/inbound/inbound-order.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "CLIENT" || !auth.user.clientId) return forbidden();

  try {
    try {
      await refreshInboundCheckoutSessionIfNeeded(params.id, auth.user.clientId);
    } catch (e) {
      console.error("[inbound] checkout refresh on GET failed:", e);
    }
    await pollInboundOrderStatus(params.id);
    const order = await getInboundOrderForClient(params.id, auth.user.clientId);
    if (!order) return notFound("Order not found");
    return ok(order);
  } catch (e) {
    return serverError(e);
  }
}
