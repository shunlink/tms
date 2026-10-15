import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, notFound, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;
  try {
    const existing = await prisma.vendorPayment.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Payment not found");

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.status === "PAID") data.paidAt = new Date();
    if (body.paymentMode !== undefined) data.paymentMode = body.paymentMode;
    if (body.referenceNo !== undefined) data.referenceNo = body.referenceNo;

    const payment = await prisma.vendorPayment.update({ where: { id: params.id }, data });
    const isProcessed = payment.status === "PAID";
    await logAudit({
      user: auth!.user,
      action: isProcessed ? AUDIT_ACTIONS.PROCESSED_BALANCE_PAYMENT : "payment.update",
      entity: "VendorPayment",
      entityId: payment.id,
      tripId: existing.tripId,
      meta: { netPayable: existing.netPayable?.toString(), referenceNo: payment.referenceNo },
      before: { status: existing.status },
      after: { status: payment.status },
    });
    return ok(payment);
  } catch (e) {
    return serverError(e);
  }
}
