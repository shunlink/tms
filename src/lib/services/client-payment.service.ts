import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import { putObject } from "../storage";
import { validatePaymentFields } from "../payment-validation";
import { syncTripsForInvoiceStatus } from "../client-trip-sync";
import {
  NON_PAYABLE_INVOICE_STATUSES,
  computeInvoicePaymentRevert,
  computeInvoicePaymentState,
  invoiceOutstanding,
  validateInvoicePaymentAmount,
} from "../invoice-payment";
import type { SessionUser } from "../auth";

const paymentInclude = {
  client: { select: { id: true, name: true } },
  invoice: { select: { id: true, invoiceNumber: true } },
  indent: { select: { id: true, indentNumber: true } },
  trip: { select: { id: true, lrNumber: true } },
  proofFile: { select: { id: true, fileName: true, url: true, mimeType: true } },
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.ClientPaymentInclude;

function n(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function mapPayment(row: Prisma.ClientPaymentGetPayload<{ include: typeof paymentInclude }>) {
  return {
    id: row.id,
    clientId: row.clientId,
    paymentType: row.paymentType,
    amount: n(row.amount),
    currency: row.currency,
    paidAt: row.paidAt,
    paymentMode: row.paymentMode,
    referenceNo: row.referenceNo,
    chequeNumber: row.chequeNumber,
    notes: row.notes,
    invoiceId: row.invoiceId,
    indentId: row.indentId,
    tripId: row.tripId,
    client: row.client,
    invoice: row.invoice,
    indent: row.indent,
    trip: row.trip,
    proof: row.proofFile
      ? {
          id: row.proofFile.id,
          fileName: row.proofFile.fileName,
          url: row.proofFile.url,
          mimeType: row.proofFile.mimeType,
        }
      : null,
    recordedBy: row.recordedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function storePaymentProof(
  paymentId: string,
  file: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer },
  uploadedById?: string | null
) {
  const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `client-payment/${paymentId}/${Date.now()}-${safeName}`;
  const { url } = await putObject(key, file.buffer);

  const stored = await prisma.storedFile.create({
    data: {
      fileName: file.fileName,
      mimeType: file.mimeType ?? null,
      sizeBytes: file.sizeBytes,
      storageKey: key,
      url,
      uploadedById: uploadedById ?? null,
    },
  });

  await prisma.documentAttachment.create({
    data: {
      fileId: stored.id,
      entityType: "CLIENT_PAYMENT",
      entityId: paymentId,
      documentType: "PAYMENT_PROOF",
      title: file.fileName,
    },
  });

  return stored.id;
}

async function applyInvoicePayment(tx: Prisma.TransactionClient, invoiceId: string, amount: number, paidAt: Date) {
  const invoice = await tx.clientInvoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  if (NON_PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
    throw new Error(`Cannot record payment against a ${invoice.status.toLowerCase()} invoice`);
  }

  const total = n(invoice.totalAmount);
  const outstanding = invoiceOutstanding(total, n(invoice.paidAmount));
  const paymentError = validateInvoicePaymentAmount(outstanding, amount);
  if (paymentError) {
    throw new Error(
      outstanding <= 0
        ? `Invoice ${invoice.invoiceNumber} is already fully paid`
        : `${paymentError} on invoice ${invoice.invoiceNumber}`
    );
  }

  const { paidAmount: newPaid, status } = computeInvoicePaymentState(
    total,
    n(invoice.paidAmount),
    amount,
    invoice.status
  );

  await tx.clientInvoice.update({
    where: { id: invoiceId },
    data: { paidAmount: newPaid, paidAt, status },
  });

  await syncTripsForInvoiceStatus(tx, invoiceId, status);
}

async function revertInvoicePayment(tx: Prisma.TransactionClient, invoiceId: string, amount: number) {
  const invoice = await tx.clientInvoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) return;

  const total = n(invoice.totalAmount);
  const { paidAmount: newPaid, status } = computeInvoicePaymentRevert(
    total,
    n(invoice.paidAmount),
    amount,
    invoice.status
  );

  await tx.clientInvoice.update({
    where: { id: invoiceId },
    data: { paidAmount: newPaid, status, ...(newPaid <= 0 ? { paidAt: null } : {}) },
  });

  await syncTripsForInvoiceStatus(tx, invoiceId, status);
}

export async function listClientPayments(filters?: {
  clientId?: string;
  invoiceId?: string;
  paymentType?: string;
  limit?: number;
}) {
  const rows = await prisma.clientPayment.findMany({
    where: {
      ...(filters?.clientId ? { clientId: filters.clientId } : {}),
      ...(filters?.invoiceId ? { invoiceId: filters.invoiceId } : {}),
      ...(filters?.paymentType ? { paymentType: filters.paymentType } : {}),
    },
    orderBy: { paidAt: "desc" },
    take: filters?.limit ?? 200,
    include: paymentInclude,
  });
  return rows.map(mapPayment);
}

export async function getClientPaymentById(id: string) {
  const row = await prisma.clientPayment.findFirst({
    where: { id },
    include: paymentInclude,
  });
  return row ? mapPayment(row) : null;
}

export async function createClientPayment(
  input: {
    clientId: string;
    paymentType?: string;
    amount: number;
    paidAt: string | Date;
    paymentMode?: string | null;
    referenceNo?: string | null;
    chequeNumber?: string | null;
    notes?: string | null;
    invoiceId?: string | null;
    indentId?: string | null;
    tripId?: string | null;
  },
  actor?: SessionUser | null,
  proof?: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null
) {
  if (input.amount <= 0) throw new Error("Amount must be greater than zero");

  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) throw new Error("Invalid payment date");

  const client = await prisma.client.findFirst({ where: { id: input.clientId } });
  if (!client) throw new Error("Client not found");

  if (input.invoiceId) {
    const invoice = await prisma.clientInvoice.findFirst({
      where: { id: input.invoiceId, clientId: input.clientId },
    });
    if (!invoice) throw new Error("Invoice not found for this client");
  }

  const validationError = validatePaymentFields(
    {
      paymentMode: input.paymentMode,
      referenceNo: input.referenceNo,
      chequeNumber: input.chequeNumber,
      hasProof: Boolean(proof),
    },
    { requireProof: true }
  );
  if (validationError) throw new Error(validationError);

  const row = await prisma.$transaction(async (tx) => {
    const payment = await tx.clientPayment.create({
      data: {
        clientId: input.clientId,
        paymentType: input.paymentType ?? "PAYMENT",
        amount: input.amount,
        paidAt,
        paymentMode: input.paymentMode ?? null,
        referenceNo: input.referenceNo ?? null,
        chequeNumber: input.chequeNumber ?? null,
        notes: input.notes ?? null,
        invoiceId: input.invoiceId ?? null,
        indentId: input.indentId ?? null,
        tripId: input.tripId ?? null,
        recordedById: actor?.id ?? null,
      },
      include: paymentInclude,
    });

    if (input.invoiceId) {
      await applyInvoicePayment(tx, input.invoiceId, input.amount, paidAt);
    }

    return payment;
  });

  let proofFileId: string | null = null;
  if (proof) {
    proofFileId = await storePaymentProof(row.id, proof, actor?.id);
    await prisma.clientPayment.update({
      where: { id: row.id },
      data: { proofFileId },
    });
  }

  const result = await getClientPaymentById(row.id);

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.RECORDED_CLIENT_PAYMENT,
    entity: "ClientPayment",
    entityId: row.id,
    meta: {
      clientId: input.clientId,
      amount: input.amount,
      paymentType: input.paymentType ?? "PAYMENT",
      referenceNo: input.referenceNo,
      invoiceId: input.invoiceId,
      hasProof: Boolean(proofFileId),
    },
  });

  const { safePostClientPaymentReceiptJournal } = await import("../accounting/operational-posting.service");
  await safePostClientPaymentReceiptJournal(row.id, actor?.id);

  return result;
}

export async function updateClientPayment(
  id: string,
  input: {
    paymentType?: string;
    amount?: number;
    paidAt?: string | Date;
    paymentMode?: string | null;
    referenceNo?: string | null;
    notes?: string | null;
    invoiceId?: string | null;
    indentId?: string | null;
    tripId?: string | null;
  },
  actor?: SessionUser | null,
  proof?: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null
) {
  const existing = await prisma.clientPayment.findFirst({ where: { id } });
  if (!existing) return null;

  const paidAt = input.paidAt != null ? new Date(input.paidAt) : existing.paidAt;
  if (Number.isNaN(paidAt.getTime())) throw new Error("Invalid payment date");

  const amount = input.amount ?? n(existing.amount);
  if (amount <= 0) throw new Error("Amount must be greater than zero");

  await prisma.$transaction(async (tx) => {
    if (existing.invoiceId) {
      await revertInvoicePayment(tx, existing.invoiceId, n(existing.amount));
    }

    await tx.clientPayment.update({
      where: { id },
      data: {
        paymentType: input.paymentType ?? existing.paymentType,
        amount,
        paidAt,
        paymentMode: input.paymentMode !== undefined ? input.paymentMode : existing.paymentMode,
        referenceNo: input.referenceNo !== undefined ? input.referenceNo : existing.referenceNo,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        invoiceId: input.invoiceId !== undefined ? input.invoiceId : existing.invoiceId,
        indentId: input.indentId !== undefined ? input.indentId : existing.indentId,
        tripId: input.tripId !== undefined ? input.tripId : existing.tripId,
      },
    });

    const invoiceId = input.invoiceId !== undefined ? input.invoiceId : existing.invoiceId;
    if (invoiceId) {
      await applyInvoicePayment(tx, invoiceId, amount, paidAt);
    }
  });

  if (proof) {
    const proofFileId = await storePaymentProof(id, proof, actor?.id);
    await prisma.clientPayment.update({ where: { id }, data: { proofFileId } });
  }

  const result = await getClientPaymentById(id);

  await logAudit({
    user: actor,
    action: AUDIT_ACTIONS.CLIENT_PAYMENT_UPDATED,
    entity: "ClientPayment",
    entityId: id,
    meta: input,
    before: {
      amount: n(existing.amount),
      referenceNo: existing.referenceNo,
      paymentType: existing.paymentType,
    },
    after: {
      amount,
      referenceNo: result?.referenceNo,
      paymentType: result?.paymentType,
    },
  });

  const { safePostClientPaymentReceiptJournal } = await import("../accounting/operational-posting.service");
  await safePostClientPaymentReceiptJournal(id, actor?.id);

  return result;
}

export async function countClientPaymentsThisMonth() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const agg = await prisma.clientPayment.aggregate({
    where: { paidAt: { gte: monthStart } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return { count: agg._count._all, total: n(agg._sum.amount) };
}
