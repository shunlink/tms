import { prisma } from "../prisma";
import { paymentProviderId } from "./config";
import { getPaymentGateway } from "./gateway/registry";
import { dispatchPaymentOutboxJob } from "./queue";

export async function ingestPaymentWebhook(req: Request) {
  const providerId = paymentProviderId();
  const rawBody = await req.text();
  const gateway = getPaymentGateway();

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

  try {
    let paymentId = parsed.internalPaymentId ?? null;
    if (!paymentId && parsed.providerRef) {
      const payment = await prisma.outboundPayment.findFirst({
        where: { providerTransferRef: parsed.providerRef },
        select: { id: true },
      });
      paymentId = payment?.id ?? null;
    }

    const event = await prisma.paymentWebhookEvent.create({
      data: {
        providerId,
        providerEventId: parsed.providerEventId,
        signatureValid: true,
        payload: JSON.parse(rawBody) as object,
        paymentId,
        processingStatus: "PENDING",
      },
    });

    if (paymentId) {
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
    }

    return { ok: true as const, status: 202, eventId: event.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { ok: true as const, status: 200, duplicate: true };
    }
    throw err;
  }
}
