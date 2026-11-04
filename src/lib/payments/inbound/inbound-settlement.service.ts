import { prisma } from "../../prisma";
import { createClientPaymentFromGateway } from "../../services/client-payment.service";

export async function settleInboundPaymentSuccess(
  inboundOrderId: string,
  input: {
    providerAmountMinor?: number;
    referenceNo?: string | null;
  }
) {
  const order = await prisma.inboundPaymentOrder.findUnique({ where: { id: inboundOrderId } });
  if (!order) return;
  if (order.financeSettledAt) return;

  if (input.providerAmountMinor != null && input.providerAmountMinor !== order.amountMinor) {
    await prisma.inboundPaymentOrder.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        failureCode: "AMOUNT_MISMATCH",
        failureMessage: `Provider amount ${input.providerAmountMinor} != expected ${order.amountMinor}`,
      },
    });
    return;
  }

  const claimed = await prisma.inboundPaymentOrder.updateMany({
    where: { id: inboundOrderId, financeSettledAt: null },
    data: { financeSettledAt: new Date(), status: "SUCCEEDED" },
  });
  if (claimed.count === 0) return;

  const paymentType = order.purpose === "TRIP_ADVANCE" ? "ADVANCE" : "PAYMENT";

  await createClientPaymentFromGateway({
    clientId: order.clientId,
    inboundOrderId: order.id,
    paymentType,
    amountMinor: order.amountMinor,
    invoiceId: order.invoiceId,
    tripId: order.tripId,
    referenceNo: input.referenceNo ?? order.juspayOrderId,
  });
}
