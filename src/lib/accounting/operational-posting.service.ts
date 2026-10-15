import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { rupeesToMinor } from "../payments/money";
import { ensureChartOfAccounts } from "./chart-of-accounts.service";
import {
  buildClientInvoiceAccrualLines,
  buildClientReceiptLines,
  buildVendorCashPaymentLines,
  buildVendorPayableAccrualLines,
} from "./posting-rules";
import {
  createDraftJournal,
  getJournalBySource,
  isSourcePosted,
  postJournal,
} from "./posting.service";
import { PostingValidationError } from "./posting-validation";
import { parseGatewayOutboundIdFromRemarks } from "./operational-posting-recovery";
import { logAudit } from "../audit";

function n(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

async function postIdempotentJournal(
  tx: Prisma.TransactionClient,
  input: {
    idempotencyKey: string;
    sourceType: string;
    sourceId: string;
    accountingDate: Date;
    description: string;
    currency: string;
    lines: ReturnType<typeof buildVendorCashPaymentLines>;
    actorId?: string | null;
  }
) {
  const existing = await tx.journalEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, status: true },
  });
  if (existing?.status === "POSTED") return existing;
  if (existing?.status === "DRAFT") {
    return postJournal(existing.id, input.actorId, tx);
  }

  const posted = await isSourcePosted(input.sourceType, input.sourceId);
  if (posted) return posted;

  await ensureChartOfAccounts(tx);
  const draft = await createDraftJournal(
    {
      accountingDate: input.accountingDate,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      currency: input.currency,
      lines: input.lines,
      createdById: input.actorId ?? undefined,
    },
    { tx }
  );
  if (!draft) throw new PostingValidationError("Failed to create journal draft");
  if (draft.status === "POSTED") return draft;
  return postJournal(draft.id, input.actorId, tx);
}

/** True when a succeeded outbound payment already posted the cash leg for this balance row. */
export async function gatewayJournalExistsForBalancePayment(
  balancePaymentId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const db = tx ?? prisma;
  const payment = await db.vendorBalancePayment.findUnique({
    where: { id: balancePaymentId },
    select: {
      amount: true,
      taskId: true,
      utrReference: true,
      remarks: true,
    },
  });
  if (!payment) return false;

  const linkedOutboundId = parseGatewayOutboundIdFromRemarks(payment.remarks);
  if (linkedOutboundId) {
    const linked = await db.outboundPayment.findFirst({
      where: {
        id: linkedOutboundId,
        status: "SUCCEEDED",
        ledgerPostedAt: { not: null },
      },
      select: { id: true },
    });
    return Boolean(linked);
  }

  if (payment.utrReference) {
    const byUtr = await db.outboundPayment.findFirst({
      where: {
        balancePaymentTaskId: payment.taskId,
        status: "SUCCEEDED",
        ledgerPostedAt: { not: null },
        providerTransferRef: payment.utrReference,
      },
      select: { id: true },
    });
    return Boolean(byUtr);
  }

  const amountMinor = rupeesToMinor(n(payment.amount));
  const candidates = await db.outboundPayment.findMany({
    where: {
      balancePaymentTaskId: payment.taskId,
      status: "SUCCEEDED",
      ledgerPostedAt: { not: null },
      amountMinor,
    },
    select: { id: true },
  });
  return candidates.length === 1;
}

export async function gatewayJournalExistsForAdvance(
  advanceRequestId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const db = tx ?? prisma;
  const outbound = await db.outboundPayment.findFirst({
    where: {
      advanceRequestId,
      status: "SUCCEEDED",
      ledgerPostedAt: { not: null },
    },
    select: { id: true },
  });
  return Boolean(outbound);
}

/** Post bank settlement for a confirmed VendorPayment row (manual / workflow cash). */
export async function postVendorPaymentCashJournal(
  vendorPaymentId: string,
  actorId?: string | null,
  opts?: { skipIfGatewayPosted?: boolean }
) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.vendorPayment.findUnique({ where: { id: vendorPaymentId } });
    if (!row || row.status !== "PAID") return null;

    if (opts?.skipIfGatewayPosted) {
      if (row.paymentType === "ADVANCE" && row.sourceType === "ADVANCE_REQUEST" && row.sourceId) {
        const advanceId = row.sourceId.replace(/^advance:/, "");
        if (await gatewayJournalExistsForAdvance(advanceId, tx)) return null;
      }
      if (row.paymentType === "BALANCE" && row.sourceType === "BALANCE_PAYMENT" && row.sourceId) {
        const balancePaymentId = row.sourceId.replace(/^balance:/, "");
        if (await gatewayJournalExistsForBalancePayment(balancePaymentId, tx)) return null;
      }
    }

    const amountMinor = rupeesToMinor(n(row.netPayable));
    if (amountMinor <= 0) return null;

    const paymentType =
      row.paymentType === "ADVANCE" || row.paymentType === "BALANCE"
        ? row.paymentType
        : "BALANCE";

    const lines = buildVendorCashPaymentLines({
      vendorPaymentId,
      amountMinor,
      paymentType,
      vendorId: row.vendorId,
      tripId: row.tripId,
      indentId: row.indentId,
      reference: row.referenceNo,
    });

    const accountingDate = row.paidAt ?? new Date();
    return postIdempotentJournal(tx, {
      idempotencyKey: `vendor_payment:${vendorPaymentId}`,
      sourceType: "VENDOR_PAYMENT",
      sourceId: vendorPaymentId,
      accountingDate,
      description: lines[0]?.description ?? "Vendor payment",
      currency: row.currency,
      lines,
      actorId,
    });
  });
}

export async function postClientPaymentReceiptJournal(clientPaymentId: string, actorId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.clientPayment.findUnique({ where: { id: clientPaymentId } });
    if (!row) return null;

    const amountMinor = rupeesToMinor(n(row.amount));
    if (amountMinor <= 0) return null;

    const lines = buildClientReceiptLines({
      clientPaymentId,
      amountMinor,
      clientId: row.clientId,
      invoiceId: row.invoiceId,
      tripId: row.tripId,
      indentId: row.indentId,
      reference: row.referenceNo,
    });

    return postIdempotentJournal(tx, {
      idempotencyKey: `client_payment:${clientPaymentId}`,
      sourceType: "CLIENT_PAYMENT",
      sourceId: clientPaymentId,
      accountingDate: row.paidAt,
      description: lines[0]?.description ?? "Client receipt",
      currency: row.currency,
      lines,
      actorId,
    });
  });
}

/** Commercial approval accrual — one posted journal per VendorTripPayable. */
export async function postVendorTripPayableAccrualJournal(tripId: string, actorId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const payable = await tx.vendorTripPayable.findUnique({ where: { tripId } });
    if (!payable || payable.commercialApprovalStatus !== "APPROVED") return null;

    const finalPayableMinor = rupeesToMinor(n(payable.finalPayableAmount));
    const advanceMinor = rupeesToMinor(n(payable.advanceAppliedAmount));
    if (finalPayableMinor <= 0) return null;

    const lines = buildVendorPayableAccrualLines({
      payableId: payable.id,
      finalPayableMinor,
      advanceAppliedMinor: advanceMinor,
      vendorId: payable.vendorId,
      tripId: payable.tripId,
      indentId: payable.indentId,
    });

    const accountingDate = payable.commercialApprovedAt ?? new Date();
    return postIdempotentJournal(tx, {
      idempotencyKey: `vendor_trip_payable_accrual:${payable.id}`,
      sourceType: "VENDOR_TRIP_PAYABLE_ACCRUAL",
      sourceId: payable.id,
      accountingDate,
      description: `Vendor payable approved — trip ${tripId}`,
      currency: payable.currency,
      lines,
      actorId,
    });
  });
}

export async function postClientInvoiceAccrualJournal(invoiceId: string, actorId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.clientInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { select: { tripId: true }, take: 1 } },
    });
    if (!invoice) return null;
    if (!invoice.finalizedAt) return null;
    if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return null;

    const totalMinor = rupeesToMinor(n(invoice.totalAmount));
    if (totalMinor <= 0) return null;

    const lines = buildClientInvoiceAccrualLines({
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      totalMinor,
      clientId: invoice.clientId,
      tripId: invoice.lines[0]?.tripId ?? null,
    });

    const accountingDate = invoice.finalizedAt ?? invoice.issueDate;
    return postIdempotentJournal(tx, {
      idempotencyKey: `client_invoice_accrual:${invoiceId}`,
      sourceType: "CLIENT_INVOICE_ACCRUAL",
      sourceId: invoiceId,
      accountingDate,
      description: `Invoice ${invoice.invoiceNumber} accrual`,
      currency: invoice.currency,
      lines,
      actorId,
    });
  });
}

export async function getPostedJournalForSource(sourceType: string, sourceId: string) {
  return getJournalBySource(sourceType, sourceId);
}

/** Log and swallow posting errors so operational records remain recoverable via retry helpers. */
export async function safePostVendorPaymentCashJournal(
  vendorPaymentId: string,
  actorId?: string | null,
  opts?: { skipIfGatewayPosted?: boolean }
) {
  try {
    return await postVendorPaymentCashJournal(vendorPaymentId, actorId, opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vendor payment journal failed";
    await logAudit({
      action: "VENDOR_PAYMENT_JOURNAL_FAILED",
      entity: "VendorPayment",
      entityId: vendorPaymentId,
      meta: { error: message },
    });
    return null;
  }
}

export async function safePostClientPaymentReceiptJournal(clientPaymentId: string, actorId?: string | null) {
  try {
    return await postClientPaymentReceiptJournal(clientPaymentId, actorId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Client receipt journal failed";
    await logAudit({
      action: "CLIENT_PAYMENT_JOURNAL_FAILED",
      entity: "ClientPayment",
      entityId: clientPaymentId,
      meta: { error: message },
    });
    return null;
  }
}

export async function safePostVendorTripPayableAccrualJournal(tripId: string, actorId?: string | null) {
  try {
    return await postVendorTripPayableAccrualJournal(tripId, actorId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payable accrual journal failed";
    await logAudit({
      action: "VENDOR_PAYABLE_ACCRUAL_JOURNAL_FAILED",
      entity: "VendorTripPayable",
      entityId: tripId,
      meta: { error: message },
    });
    return null;
  }
}

export async function safePostClientInvoiceAccrualJournal(invoiceId: string, actorId?: string | null) {
  try {
    return await postClientInvoiceAccrualJournal(invoiceId, actorId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invoice accrual journal failed";
    await logAudit({
      action: "CLIENT_INVOICE_ACCRUAL_JOURNAL_FAILED",
      entity: "ClientInvoice",
      entityId: invoiceId,
      meta: { error: message },
    });
    return null;
  }
}
