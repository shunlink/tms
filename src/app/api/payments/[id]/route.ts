import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";

const paymentPatchSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "PAID", "FAILED"]).optional(),
  paymentMode: z.string().max(100).optional(),
  referenceNo: z.string().max(200).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "payment.process");
  if (denied) return denied;
  try {
    const existing = await prisma.vendorPayment.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Payment not found");

    const body = await req.json();
    const parsed = paymentPatchSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const data: Record<string, unknown> = {};
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.status === "PAID") data.paidAt = new Date();
    if (parsed.data.paymentMode !== undefined) data.paymentMode = parsed.data.paymentMode;
    if (parsed.data.referenceNo !== undefined) data.referenceNo = parsed.data.referenceNo;

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
