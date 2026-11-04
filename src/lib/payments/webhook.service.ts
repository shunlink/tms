import { prisma } from "../prisma";
import { paymentProviderId } from "./config";
import { getPaymentGateway } from "./gateway/registry";
import { createJuspayPayoutGateway } from "./gateway/providers/juspay-payout";
import { juspayConfigured } from "./juspay/config";
import { dispatchPaymentOutboxJob } from "./queue";
import { dispatchInboundOutboxJob } from "./inbound/inbound-queue";

function webhookGateway() {
  if (paymentProviderId() === "juspay" || juspayConfigured()) {
    return createJuspayPayoutGateway();
  }
  return getPaymentGateway();
}

export async function ingestPaymentWebhook(req: Request) {
  const providerId = paymentProviderId() === "juspay" ? "juspay" : paymentProviderId();
  const rawBody = await req.text();
  const gateway = webhookGateway();

  const signatureValid = gateway.verifyWebhookSignature(req.headers, rawBody);
  if (!signatureValid) {
    return { ok: false as const, status: 401, message: "Invalid signature" };
  }

  let parsed;
  try {
    parsed = gateway.parseWebhookEvent(rawBody);
  } catch {
    return { ok: false as const, status: 400, message: "Invalid payload" };
  }

  const effectiveProvider = parsed.channel === "inbound" || parsed.channel === "outbound" ? "juspay" : providerId;

  try {
    let paymentId = parsed.internalPaymentId ?? null;
    let inboundOrderId = parsed.inboundOrderId ?? null;

    if (parsed.channel === "outbound") {
      if (!paymentId && parsed.providerRef) {
        const payment = await prisma.outboundPayment.findFirst({
          where: {
            OR: [{ providerTransferRef: parsed.providerRef }, { juspayOrderId: parsed.providerRef }],
          },
          select: { id: true },
        });
        paymentId = payment?.id ?? null;
      }
    } else {
      if (!inboundOrderId && parsed.providerRef) {
        const order = await prisma.inboundPaymentOrder.findFirst({
          where: { juspayOrderId: parsed.providerRef },
          select: { id: true },
        });
        inboundOrderId = order?.id ?? null;
      }
    }

    const event = await prisma.paymentWebhookEvent.create({
      data: {
        providerId: effectiveProvider,
        providerEventId: parsed.providerEventId,
        signatureValid: true,
        payload: JSON.parse(rawBody) as object,
        paymentId,
        inboundOrderId,
        processingStatus: "PENDING",
      },
    });

    if (parsed.channel === "outbound" && paymentId) {
      const outbox = await prisma.paymentOutbox.create({
        data: {
          paymentId,
          jobType: "APPLY_WEBHOOK",
          payload: { webhookEventId: event.id },
          status: "PENDING",
          nextAttemptAt: new Date(),
        },
      });
      await dispatchPaymentOutboxJob(outbox.id);
    } else if (parsed.channel === "inbound" && inboundOrderId) {
      const outbox = await prisma.inboundPaymentOutbox.create({
        data: {
          inboundOrderId,
          jobType: "APPLY_WEBHOOK",
          payload: { webhookEventId: event.id },
          status: "PENDING",
          nextAttemptAt: new Date(),
        },
      });
      await dispatchInboundOutboxJob(outbox.id);
    }

    return { ok: true as const, status: 202, eventId: event.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { ok: true as const, status: 200, duplicate: true };
    }
    throw err;
  }
}
