import type { Prisma } from "@prisma/client";
import { postOutboundPaymentJournal } from "../accounting/posting.service";
import { logPaymentAudit } from "./audit";

/** Post balanced journal + legacy ledger mirror exactly once per successful gateway payment. */
export async function postPaymentLedger(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    amountMinor: number;
    currency: string;
    purpose: string;
    providerRef?: string | null;
    actorId?: string | null;
    vendorId?: string;
    indentId?: string | null;
    tripId?: string | null;
  }
) {
  const payment = await tx.outboundPayment.findUnique({
    where: { id: input.paymentId },
    select: {
      ledgerPostedAt: true,
      vendorId: true,
      indentId: true,
      tripId: true,
    },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.ledgerPostedAt) return;

  const ref = input.providerRef ?? input.paymentId;

  await postOutboundPaymentJournal(tx, {
    paymentId: input.paymentId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    purpose: input.purpose,
    vendorId: input.vendorId ?? payment.vendorId,
    indentId: input.indentId ?? payment.indentId,
    tripId: input.tripId ?? payment.tripId,
    providerRef: ref,
    actorId: input.actorId,
  });

  await tx.outboundPayment.update({
    where: { id: input.paymentId },
    data: { ledgerPostedAt: new Date() },
  });

  await logPaymentAudit(tx, {
    paymentId: input.paymentId,
    action: "LEDGER_POSTED",
    actorId: input.actorId,
    metadata: { amountMinor: input.amountMinor, reference: ref },
  });
}
