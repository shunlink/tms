import { requireAuth, authorize, ok, notFound, serverError, unauthorized } from "@/lib/api";
import { refreshGatewayPaymentStatus } from "@/lib/payments/workflow.service";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const payment = await refreshGatewayPaymentStatus(params.id);
    if (!payment) return notFound();
    return ok(payment);
  } catch (e) {
    return serverError(e);
  }
}
