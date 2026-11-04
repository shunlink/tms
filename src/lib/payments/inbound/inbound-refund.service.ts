import { randomUUID } from "crypto";
import { prisma } from "../../prisma";
import type { SessionUser } from "../../auth";
import { refundHypercheckoutOrder } from "./hypercheckout.service";
import { computeInvoicePaymentRevert } from "../../invoice-payment";

function n(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export async function initiateInboundRefund(
  inboundOrderId: string,
  input: { amountRupees: number; reason?: string },
  actor?: SessionUser | null
) {
  const order = await prisma.inboundPaymentOrder.findUnique({
    where: { id: inboundOrderId },
    include: { clientPayment: true },
  });
  if (!order || order.status !== "SUCCEEDED" || !order.financeSettledAt) {
    throw new Error("Only succeeded online payments can be refunded");
  }
  if (input.amountRupees <= 0) throw new Error("Refund amount must be positive");
  if (input.amountRupees - order.amountMinor / 100 > 0.005) {
    throw new Error("Refund exceeds original payment amount");
  }

  const uniqueRequestId = randomUUID().replace(/-/g, "").slice(0, 20);

  const refund = await prisma.inboundPaymentRefund.create({
    data: {
      inboundOrderId: order.id,
      uniqueRequestId,
      amountMinor: Math.round(input.amountRupees * 100),
      status: "PENDING",
      notes: input.reason ?? null,
      initiatedById: actor?.id ?? null,
    },
  });

  await refundHypercheckoutOrder({
    orderId: order.juspayOrderId,
    routingId: order.clientId,
    uniqueRequestId,
    amountRupees: input.amountRupees,
    description: input.reason,
  });

  if (order.clientPayment && order.invoiceId) {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.clientInvoice.findFirst({ where: { id: order.invoiceId! } });
      if (!invoice) return;
      const total = n(invoice.totalAmount);
      const { paidAmount, status } = computeInvoicePaymentRevert(
        total,
        n(invoice.paidAmount),
        input.amountRupees,
        invoice.status
      );
      await tx.clientInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount, status, ...(paidAmount <= 0 ? { paidAt: null } : {}) },
      });
    });
  }

  await prisma.inboundPaymentRefund.update({
    where: { id: refund.id },
    data: { status: "SUCCESS" },
  });

  return refund;
}
