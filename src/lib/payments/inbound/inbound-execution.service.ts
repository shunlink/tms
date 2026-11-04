import { prisma } from "../../prisma";
import { pollInboundOrderStatus } from "./inbound-order.service";
import { settleInboundPaymentSuccess } from "./inbound-settlement.service";

const MAX_ATTEMPTS = 8;

export async function processInboundOutboxJob(outboxId: string) {
  const job = await prisma.inboundPaymentOutbox.findUnique({ where: { id: outboxId } });
  if (!job || job.status === "COMPLETED" || job.status === "DEAD_LETTER") return;

  const claimed = await prisma.inboundPaymentOutbox.updateMany({
    where: { id: outboxId, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;

  try {
    if (job.jobType === "POLL_STATUS") {
      await pollInboundOrderStatus(job.inboundOrderId);
    } else if (job.jobType === "APPLY_WEBHOOK") {
      const payload = job.payload as { webhookEventId?: string } | null;
      if (payload?.webhookEventId) {
        await applyInboundWebhookEvent(payload.webhookEventId);
      }
    }

    await prisma.inboundPaymentOutbox.update({
      where: { id: outboxId },
      data: { status: "COMPLETED", lastError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inbound outbox failed";
    const attempts = job.attempts + 1;
    const dead = attempts >= MAX_ATTEMPTS;
    await prisma.inboundPaymentOutbox.update({
      where: { id: outboxId },
      data: {
        status: dead ? "DEAD_LETTER" : "PENDING",
        lastError: message,
        nextAttemptAt: new Date(Date.now() + Math.min(60_000, 1000 * 2 ** attempts)),
      },
    });
    if (!dead) throw err;
  }
}

export async function applyInboundWebhookEvent(webhookEventId: string) {
  const event = await prisma.paymentWebhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!event || !event.signatureValid || event.processingStatus === "PROCESSED") return;

  const payload = event.payload as {
    status?: string;
    order_id?: string;
    udf1?: string;
    amount?: number;
    payment_gateway_response?: { rrn?: string };
    txn_id?: string;
  } | null;

  let inboundOrderId = event.inboundOrderId;
  if (!inboundOrderId && payload?.udf1) {
    inboundOrderId = payload.udf1;
  }
  if (!inboundOrderId && payload?.order_id) {
    const order = await prisma.inboundPaymentOrder.findFirst({
      where: { juspayOrderId: payload.order_id },
      select: { id: true },
    });
    inboundOrderId = order?.id ?? null;
  }

  if (!inboundOrderId) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "FAILED", errorMessage: "Missing inbound order", processedAt: new Date() },
    });
    return;
  }

  const order = await prisma.inboundPaymentOrder.findUnique({ where: { id: inboundOrderId } });
  if (!order || order.status === "SUCCEEDED" || order.status === "CANCELLED") {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "IGNORED", processedAt: new Date(), inboundOrderId },
    });
    return;
  }

  const status = payload?.status ?? "";
  if (status === "CHARGED") {
    const amountMinor =
      payload?.amount != null
        ? payload.amount >= 1000
          ? Math.round(payload.amount)
          : Math.round(payload.amount * 100)
        : undefined;
    await settleInboundPaymentSuccess(inboundOrderId, {
      providerAmountMinor: amountMinor,
      referenceNo: payload?.payment_gateway_response?.rrn ?? payload?.txn_id ?? order.juspayOrderId,
    });
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: webhookEventId },
    data: { processingStatus: "PROCESSED", processedAt: new Date(), inboundOrderId },
  });
}
