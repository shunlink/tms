import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { cancelOutboundPayment } from "@/lib/payments/payment.service";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.create");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const payment = await cancelOutboundPayment(params.id, auth.user, body.reason);
    if (!payment) return notFound();
    return ok(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cancel failed";
    if (msg.includes("Cannot cancel")) return badRequest(msg);
    return serverError(e);
  }
}
