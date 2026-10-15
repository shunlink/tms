import { requireAuth, authorize, ok, notFound, serverError, unauthorized } from "@/lib/api";
import {
  getOutboundPayment,
  submitOutboundPaymentForApproval,
} from "@/lib/payments/payment.service";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  try {
    const payment = await getOutboundPayment(params.id);
    if (!payment) return notFound();
    return ok(payment);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.create");
  if (denied) return denied;

  try {
    const body = await req.json();
    if (body.action === "submit_for_approval") {
      const payment = await submitOutboundPaymentForApproval(params.id, auth.user);
      if (!payment) return notFound();
      return ok(payment);
    }
    return notFound();
  } catch (e) {
    return serverError(e);
  }
}
