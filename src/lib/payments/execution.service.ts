import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { gatewayExecutionEnabled } from "./config";
import { getPaymentGateway } from "./gateway/registry";
import { postPaymentLedger } from "./ledger.service";
import { settleOutboundPaymentSuccess } from "./settlement.service";
import { assertPaymentTransition } from "./state-machine";
import { logPaymentAudit } from "./audit";

const MAX_OUTBOX_ATTEMPTS = 8;

export async function processPaymentOutboxJob(outboxId: string) {
  const job = await prisma.paymentOutbox.findUnique({ where: { id: outboxId } });
  if (!job || job.status === "COMPLETED" || job.status === "DEAD_LETTER") return;

  const claimed = await prisma.paymentOutbox.updateMany({
    where: { id: outboxId, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;

  try {
    if (job.jobType === "EXECUTE_TRANSFER") {
      await executeTransferForPayment(job.paymentId);
    } else if (job.jobType === "POLL_STATUS") {
      await pollTransferStatus(job.paymentId);
    } else if (job.jobType === "APPLY_WEBHOOK") {
      const payload = job.payload as { webhookEventId?: string } | null;
      if (payload?.webhookEventId) {
        await applyWebhookEvent(payload.webhookEventId);
      }
    }

    await prisma.paymentOutbox.update({
      where: { id: outboxId },
      data: { status: "COMPLETED", lastError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outbox job failed";
    const attempts = job.attempts + 1;
    const dead = attempts >= MAX_OUTBOX_ATTEMPTS;
    await prisma.paymentOutbox.update({
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

async function loadPaymentForExecution(paymentId: string) {
  return prisma.outboundPayment.findUnique({
    where: { id: paymentId },
    include: {
      beneficiary: true,
      attempts: { orderBy: { attemptNumber: "desc" }, take: 1 },
    },
  });
}

export async function executeTransferForPayment(paymentId: string) {
  if (!gatewayExecutionEnabled()) {
    throw new Error("Gateway execution is disabled in this environment");
  }

  const payment = await loadPaymentForExecution(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.settlementChannel !== "GATEWAY") {
    throw new Error("Payment is not a gateway transfer");
  }
  if (!["APPROVED", "REQUIRES_REVIEW"].includes(payment.status)) {
    throw new Error(`Cannot execute payment in status ${payment.status}`);
  }

  const gateway = getPaymentGateway();
  const attemptNumber = (payment.attempts[0]?.attemptNumber ?? 0) + 1;
  const attemptKey = `${payment.idempotencyKey}:${attemptNumber}`;

  const ambiguousAttempt = payment.attempts.find((a) => a.status === "AMBIGUOUS" && a.providerRef);
  if (ambiguousAttempt?.providerRef) {
    await pollTransferStatus(paymentId);
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (payment.status === "APPROVED") {
      assertPaymentTransition(payment.status, "PROCESSING");
      await tx.outboundPayment.update({
        where: { id: paymentId },
        data: {
          status: "PROCESSING",
          providerId: gateway.id,
          submittedAt: new Date(),
        },
      });
    }
    await tx.paymentAttempt.create({
      data: {
        paymentId,
        attemptNumber,
        status: "PENDING",
        idempotencyKey: attemptKey,
        correlationId: randomUUID(),
      },
    });
    await logPaymentAudit(tx, { paymentId, action: "EXECUTION_STARTED", metadata: { attemptNumber } });
  });

  const beneficiary = payment.beneficiary;
  if (!beneficiary || beneficiary.verificationStatus !== "VERIFIED") {
    await markPaymentFailed(paymentId, "BENEFICIARY", "Verified beneficiary is required");
    return;
  }

  let result;
  try {
    result = await gateway.initiateTransfer({
      internalPaymentId: paymentId,
      idempotencyKey: attemptKey,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      beneficiary: {
        method: beneficiary.method,
        accountHolder: beneficiary.accountHolder,
        bankName: beneficiary.bankName,
        accountNumber: beneficiary.accountNumber,
        ifsc: beneficiary.ifsc,
        upiId: beneficiary.upiId,
      },
      metadata: { purpose: payment.purpose },
    });
  } catch (err) {
    const mapped = gateway.mapError(err);
    if (mapped.retryable) {
      await prisma.paymentAttempt.updateMany({
        where: { paymentId, attemptNumber },
        data: {
          status: "AMBIGUOUS",
          failureCode: mapped.code,
          failureMessage: mapped.message,
        },
      });
      await prisma.outboundPayment.update({
        where: { id: paymentId },
        data: { status: "REQUIRES_REVIEW", failureCode: mapped.code, failureMessage: mapped.message },
      });
      return;
    }
    await markPaymentFailed(paymentId, mapped.code, mapped.message);
    return;
  }

  await prisma.paymentAttempt.updateMany({
    where: { paymentId, attemptNumber },
    data: {
      status: result.status === "SUCCEEDED" ? "SUCCEEDED" : "SUBMITTED",
      providerRef: result.providerRef,
      submittedAt: new Date(),
      providerMeta: result.raw ?? undefined,
    },
  });

  await prisma.outboundPayment.update({
    where: { id: paymentId },
    data: { providerTransferRef: result.providerRef },
  });

  if (result.status === "SUCCEEDED") {
    await finalizeSuccessfulTransfer(paymentId, result.providerRef);
  } else {
    await prisma.paymentOutbox.create({
      data: {
        paymentId,
        jobType: "POLL_STATUS",
        status: "PENDING",
        nextAttemptAt: new Date(Date.now() + 5000),
      },
    });
  }
}

export async function pollTransferStatus(paymentId: string) {
  const payment = await prisma.outboundPayment.findUnique({
    where: { id: paymentId },
    include: { attempts: { orderBy: { attemptNumber: "desc" }, take: 1 } },
  });
  if (!payment?.providerTransferRef) return;

  const gateway = getPaymentGateway();
  const query = await gateway.queryTransfer(payment.providerTransferRef);

  if (query.status === "AMBIGUOUS") {
    await prisma.outboundPayment.update({
      where: { id: paymentId },
      data: { status: "REQUIRES_REVIEW", failureMessage: "Unable to verify transfer status" },
    });
    return;
  }

  if (query.status === "SUCCEEDED") {
    await finalizeSuccessfulTransfer(paymentId, payment.providerTransferRef, query.utr);
    return;
  }

  if (query.status === "FAILED") {
    await markPaymentFailed(paymentId, query.failureCode ?? "FAILED", query.failureMessage ?? "Transfer failed");
  }
}

async function finalizeSuccessfulTransfer(paymentId: string, providerRef: string, utr?: string | null) {
  let shouldSettle = false;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.outboundPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === "SUCCEEDED" || payment.status === "CANCELLED") return;

    assertPaymentTransition(payment.status, "SUCCEEDED");
    const updated = await tx.outboundPayment.updateMany({
      where: { id: paymentId, status: payment.status },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        providerTransferRef: utr ?? providerRef,
        failureCode: null,
        failureMessage: null,
      },
    });
    if (updated.count === 0) return;

    await postPaymentLedger(tx, {
      paymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      purpose: payment.purpose,
      providerRef: utr ?? providerRef,
    });
    await logPaymentAudit(tx, { paymentId, action: "TRANSFER_SUCCEEDED", metadata: { providerRef } });
    shouldSettle = true;
  });

  if (shouldSettle) await settleOutboundPaymentSuccess(paymentId);
}

async function markPaymentFailed(paymentId: string, code: string, message: string) {
  const payment = await prisma.outboundPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === "SUCCEEDED") return;

  await prisma.$transaction(async (tx) => {
    if (payment.status === "PROCESSING") {
      assertPaymentTransition(payment.status, "FAILED");
    }
    await tx.outboundPayment.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        failureCode: code,
        failureMessage: message,
        completedAt: new Date(),
      },
    });
    await logPaymentAudit(tx, { paymentId, action: "TRANSFER_FAILED", metadata: { code, message } });
  });
}

export async function applyWebhookEvent(webhookEventId: string) {
  const event = await prisma.paymentWebhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!event || !event.signatureValid || event.processingStatus === "PROCESSED") return;

  const payload = event.payload as {
    providerRef?: string;
    internalPaymentId?: string;
    status?: string;
    utr?: string;
  } | null;

  const paymentId = event.paymentId ?? payload?.internalPaymentId;
  if (!paymentId) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "FAILED", errorMessage: "Missing payment correlation", processedAt: new Date() },
    });
    return;
  }

  const payment = await prisma.outboundPayment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "FAILED", errorMessage: "Payment not found", processedAt: new Date() },
    });
    return;
  }

  if (payment.status === "SUCCEEDED" || payment.status === "CANCELLED") {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "IGNORED", processedAt: new Date() },
    });
    return;
  }

  const status = payload?.status ?? "PROCESSING";
  if (status === "SUCCEEDED") {
    const ref = payload?.providerRef ?? payment.providerTransferRef ?? "";
    await finalizeSuccessfulTransfer(paymentId, ref, payload?.utr);
  } else if (status === "FAILED") {
    await markPaymentFailed(paymentId, "WEBHOOK_FAILED", "Provider reported failure");
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: webhookEventId },
    data: { processingStatus: "PROCESSED", processedAt: new Date(), paymentId },
  });
}
