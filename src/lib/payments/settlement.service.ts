import { prisma } from "../prisma";
import { assertAdvanceRequestTransition } from "../advance-request-states";
import { minorToRupees } from "./money";
import type { SessionUser } from "../auth";

/**
 * Apply confirmed gateway transfer to existing TMS finance records.
 * Called only after provider-verified SUCCEEDED status.
 */
export async function settleOutboundPaymentSuccess(paymentId: string, actor?: SessionUser | null) {
  const payment = await prisma.outboundPayment.findUnique({
    where: { id: paymentId },
    include: {
      advanceRequest: { include: { trip: { select: { indentId: true } } } },
      balancePaymentTask: true,
    },
  });
  if (!payment || payment.status !== "SUCCEEDED") return;
  if (payment.financeSettledAt) return;

  const claimed = await prisma.outboundPayment.updateMany({
    where: { id: paymentId, status: "SUCCEEDED", financeSettledAt: null },
    data: { financeSettledAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    await applyFinanceSettlement(paymentId, actor);
  } catch (err) {
    await prisma.outboundPayment.update({
      where: { id: paymentId },
      data: { financeSettledAt: null },
    });
    throw err;
  }
}

/** Apply TMS finance records for a gateway payment that already reached SUCCEEDED. */
async function applyFinanceSettlement(paymentId: string, actor?: SessionUser | null) {
  const payment = await prisma.outboundPayment.findUnique({
    where: { id: paymentId },
    include: {
      advanceRequest: { include: { trip: { select: { indentId: true } } } },
      balancePaymentTask: true,
    },
  });
  if (!payment || payment.status !== "SUCCEEDED") return;

  const amountRupees = minorToRupees(payment.amountMinor);
  const utr = payment.providerTransferRef ?? undefined;
  const paidAt = payment.completedAt ?? new Date();

  if (payment.purpose === "ADVANCE" && payment.advanceRequestId && payment.advanceRequest) {
    const req = payment.advanceRequest;
    if (req.status !== "PROCESSED") {
      await prisma.$transaction(async (tx) => {
        if (req.status !== "PROCESSING") {
          assertAdvanceRequestTransition(req.status, "PROCESSING");
          await tx.advanceRequest.update({
            where: { id: req.id },
            data: { status: "PROCESSING", paidAmount: amountRupees },
          });
        }
        assertAdvanceRequestTransition("PROCESSING", "PROCESSED");
        await tx.advanceRequest.update({
          where: { id: req.id },
          data: {
            status: "PROCESSED",
            processedAt: paidAt,
            processedById: actor?.id ?? payment.createdById,
            paidAmount: amountRupees,
            paymentMethod: "Bank Transfer",
            paymentDate: paidAt,
            utrReference: utr ?? null,
            processingRemarks: "Settled via payment gateway",
          },
        });
        await tx.advanceRequestEvent.create({
          data: {
            advanceRequestId: req.id,
            action: "PROCESSED",
            actorId: actor?.id ?? payment.createdById,
            fromStatus: "PROCESSING",
            toStatus: "PROCESSED",
            amount: amountRupees,
            remarks: "Gateway transfer confirmed",
          },
        });
      });

      const { generateAndStoreAdvanceVoucher } = await import("../services/advance-voucher.service");
      await generateAndStoreAdvanceVoucher(req.id, actor?.name ?? null);

      const { recordAdvanceInVendorLedger } = await import("../services/vendor-payment.service");
      await recordAdvanceInVendorLedger(req.id, actor, { skipCashJournal: true });
    }
    return;
  }

  if (payment.purpose === "BALANCE" && payment.balancePaymentTaskId && payment.balancePaymentTask) {
    const task = payment.balancePaymentTask;
    const outstanding = Math.max(0, Number(task.balanceAmount) - Number(task.paidAmount));
    if (amountRupees > outstanding + 0.01) {
      throw new Error("Gateway settlement amount exceeds outstanding balance");
    }

    const { formatGatewayBalancePaymentRemarks } = await import(
      "../accounting/operational-posting-recovery"
    );
    const { recordBalancePayment } = await import("../services/vendor-balance-payment.service");
    await recordBalancePayment(
      task.id,
      {
        amount: amountRupees,
        paidAt,
        paymentMode: "Bank Transfer",
        utrReference: utr ?? null,
        remarks: formatGatewayBalancePaymentRemarks(paymentId),
      },
      actor,
      null,
      { gatewaySettlement: true }
    );
  }
}

/** Retry TMS settlement for succeeded payments where finance settlement did not complete. */
export async function retryPendingFinanceSettlements(limit = 20) {
  const pending = await prisma.outboundPayment.findMany({
    where: { status: "SUCCEEDED", financeSettledAt: null },
    orderBy: { completedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const row of pending) {
    await settleOutboundPaymentSuccess(row.id);
  }
  return pending.length;
}
