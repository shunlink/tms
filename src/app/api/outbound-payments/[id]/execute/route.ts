import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { executeOutboundPayment } from "@/lib/payments/payment.service";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const payment = await executeOutboundPayment(params.id, auth.user);
    if (!payment) return notFound();
    return ok(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Execution failed";
    if (msg.includes("not enabled") || msg.includes("approved")) return badRequest(msg);
    return serverError(e);
  }
}
