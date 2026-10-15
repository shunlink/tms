import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { approveOutboundPayment } from "@/lib/payments/payment.service";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;

  try {
    const body = await req.json();
    const decision = body.decision === "REJECTED" ? "REJECTED" : "APPROVED";
    const payment = await approveOutboundPayment(
      params.id,
      { decision, reason: body.reason ?? null },
      auth.user
    );
    if (!payment) return notFound();
    return ok(payment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Approval failed";
    if (msg.includes("Approver") || msg.includes("pending")) return badRequest(msg);
    return serverError(e);
  }
}
