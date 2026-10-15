import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAudit } from "../audit";
import { putObject } from "../storage";
import { managedAdvanceSourceFilter } from "../constants";
import { validatePaymentFields } from "../payment-validation";
import type { SessionUser } from "../auth";

const paymentInclude = {
  vendor: { select: { id: true, name: true } },
  trip: { select: { id: true, lrNumber: true, routeFrom: true, routeTo: true, indentId: true } },
  indent: { select: { id: true, indentNumber: true } },
  proofFile: { select: { id: true, fileName: true, url: true, mimeType: true } },
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.VendorPaymentInclude;

function n(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export function mapVendorPayment(row: Prisma.VendorPaymentGetPayload<{ include: typeof paymentInclude }>) {
  return {
    id: row.id,
    vendorId: row.vendorId,
    tripId: row.tripId,
    paymentType: row.paymentType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    amount: n(row.amount),
    advanceAmount: n(row.advanceAmount),
    tdsAmount: n(row.tdsAmount),
    netPayable: n(row.netPayable),
    currency: row.currency,
    status: row.status,
    paidAt: row.paidAt,
    paymentMode: row.paymentMode,
    referenceNo: row.referenceNo,
    chequeNumber: row.chequeNumber,
    notes: row.notes,
    vendor: row.vendor,
    trip: row.trip,
    indent: row.indent,
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
  const key = `vendor-payment/${paymentId}/${Date.now()}-${safeName}`;
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
      entityType: "TRIP",
      entityId: paymentId,
      documentType: "PAYMENT_PROOF",
      title: file.fileName,
    },
  });

  return stored.id;
}

/** Record advance payout in the unified vendor payment ledger. */
export async function recordAdvanceInVendorLedger(
  advanceRequestId: string,
  actor?: SessionUser | null,
  opts?: { skipCashJournal?: boolean }
) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id: advanceRequestId, status: "PROCESSED" },
    include: { trip: { select: { id: true, vendorId: true, vendorRate: true, indentId: true } } },
  });
  if (!req?.trip) return null;

  const paid = n(req.paidAmount ?? req.approvedAmount ?? req.requestedAmount);
  const sourceId = `advance:${req.id}`;

  const existing = await prisma.vendorPayment.findFirst({ where: { sourceId }, include: paymentInclude });
  if (existing) {
    if (!opts?.skipCashJournal) {
      const { safePostVendorPaymentCashJournal } = await import("../accounting/operational-posting.service");
      await safePostVendorPaymentCashJournal(existing.id, actor?.id ?? req.processedById, {
        skipIfGatewayPosted: true,
      });
    }
    return mapVendorPayment(existing);
  }

  const row = await prisma.vendorPayment.create({
    data: {
      tripId: req.tripId,
      vendorId: req.vendorId,
      indentId: req.trip.indentId,
      paymentType: "ADVANCE",
      sourceType: "ADVANCE_REQUEST",
      sourceId,
      amount: n(req.trip.vendorRate),
      advanceAmount: paid,
      tdsAmount: 0,
      netPayable: paid,
      status: "PAID",
      paidAt: req.paymentDate ?? req.processedAt ?? new Date(),
      paymentMode: req.paymentMethod,
      referenceNo: req.utrReference,
      notes: req.processingRemarks ?? req.remarks,
      proofFileId: req.paymentProofFileId,
      recordedById: req.processedById ?? actor?.id ?? null,
    },
    include: paymentInclude,
  });

  if (!opts?.skipCashJournal) {
    const { safePostVendorPaymentCashJournal } = await import("../accounting/operational-posting.service");
    await safePostVendorPaymentCashJournal(row.id, actor?.id ?? req.processedById, {
      skipIfGatewayPosted: true,
    });
  }

  return mapVendorPayment(row);
}

/** Build ledger row for one VendorBalancePayment cash transaction. Task totals stay on the task. */
export function buildBalanceVendorLedgerEntry(input: {
  payment: {
    id: string;
    amount: Prisma.Decimal | number;
    paidAt: Date;
    paymentMode: string | null;
    utrReference: string | null;
    chequeNumber: string | null;
    remarks: string | null;
    proofFileId: string | null;
    recordedById: string | null;
  };
  task: {
    tripId: string;
    vendorId: string;
    indentId: string | null;
    trip: { indentId: string | null };
    balanceAmount?: Prisma.Decimal | number;
    paidAmount?: Prisma.Decimal | number;
    tdsAmount?: Prisma.Decimal | number;
    freightAmount?: Prisma.Decimal | number;
  };
}) {
  const paymentAmount = n(input.payment.amount);
  const balanceAmount = n(input.task.balanceAmount);
  const paidAmount = n(input.task.paidAmount);
  const taskTds = n(input.task.tdsAmount);
  const freightAmount = n(input.task.freightAmount);
  const settled = balanceAmount > 0 && paidAmount >= balanceAmount;
  const tdsAmount = settled ? taskTds : 0;
  return {
    tripId: input.task.tripId,
    vendorId: input.task.vendorId,
    indentId: input.task.indentId ?? input.task.trip.indentId,
    paymentType: "BALANCE" as const,
    sourceType: "BALANCE_PAYMENT" as const,
    sourceId: `balance:${input.payment.id}`,
    amount: freightAmount > 0 ? freightAmount : paymentAmount,
    advanceAmount: 0,
    tdsAmount,
    netPayable: paymentAmount,
    status: "PAID" as const,
    paidAt: input.payment.paidAt,
    paymentMode: input.payment.paymentMode,
    referenceNo: input.payment.utrReference,
    chequeNumber: input.payment.chequeNumber,
    notes: input.payment.remarks,
    proofFileId: input.payment.proofFileId,
    recordedById: input.payment.recordedById,
  };
}

/** Record balance payout in the unified vendor payment ledger. */
export async function recordBalanceInVendorLedger(
  balancePaymentId: string,
  actor?: SessionUser | null,
  opts?: { skipCashJournal?: boolean }
) {
  const payment = await prisma.vendorBalancePayment.findFirst({
    where: { id: balancePaymentId },
    include: {
      task: {
        select: {
          tripId: true,
          vendorId: true,
          indentId: true,
          balanceAmount: true,
          paidAmount: true,
          tdsAmount: true,
          freightAmount: true,
          trip: { select: { id: true, vendorId: true, vendorRate: true, indentId: true } },
        },
      },
    },
  });
  if (!payment?.task) return null;

  const sourceId = `balance:${payment.id}`;
  const existing = await prisma.vendorPayment.findFirst({ where: { sourceId }, include: paymentInclude });
  if (existing) {
    if (!opts?.skipCashJournal) {
      const { safePostVendorPaymentCashJournal } = await import("../accounting/operational-posting.service");
      await safePostVendorPaymentCashJournal(existing.id, actor?.id, { skipIfGatewayPosted: true });
    }
    return mapVendorPayment(existing);
  }

  const ledgerData = buildBalanceVendorLedgerEntry({
    payment,
    task: payment.task,
  });

  const row = await prisma.vendorPayment.create({
    data: {
      ...ledgerData,
      recordedById: ledgerData.recordedById ?? actor?.id ?? null,
    },
    include: paymentInclude,
  });

  if (!opts?.skipCashJournal) {
    const { safePostVendorPaymentCashJournal } = await import("../accounting/operational-posting.service");
    await safePostVendorPaymentCashJournal(row.id, actor?.id, { skipIfGatewayPosted: true });
  }

  return mapVendorPayment(row);
}

/** Repair legacy balance ledger rows that stored task totals instead of actual cash paid. */
async function repairBalanceLedgerEntry(balancePaymentId: string): Promise<boolean> {
  const payment = await prisma.vendorBalancePayment.findFirst({
    where: { id: balancePaymentId },
    select: { id: true, amount: true },
  });
  if (!payment) return false;

  const sourceId = `balance:${payment.id}`;
  const existing = await prisma.vendorPayment.findFirst({ where: { sourceId } });
  if (!existing) return false;

  const paymentAmount = n(payment.amount);
  if (n(existing.amount) === paymentAmount && n(existing.netPayable) === paymentAmount) return false;

  await prisma.vendorPayment.update({
    where: { id: existing.id },
    data: {
      amount: paymentAmount,
      netPayable: paymentAmount,
      advanceAmount: 0,
      tdsAmount: 0,
    },
  });
  return true;
}

/** Backfill ledger from processed advances and balance payments not yet linked. */
export async function syncVendorPaymentLedger() {
  const [processedAdvances, balancePayments] = await Promise.all([
    prisma.advanceRequest.findMany({
      where: { status: "PROCESSED", ...managedAdvanceSourceFilter() },
      select: { id: true },
    }),
    prisma.vendorBalancePayment.findMany({ select: { id: true } }),
  ]);

  let created = 0;
  for (const a of processedAdvances) {
    const before = await prisma.vendorPayment.count({ where: { sourceId: `advance:${a.id}` } });
    if (!before) {
      await recordAdvanceInVendorLedger(a.id);
      created++;
    }
  }
  for (const p of balancePayments) {
    const sourceId = `balance:${p.id}`;
    const before = await prisma.vendorPayment.count({ where: { sourceId } });
    if (!before) {
      await recordBalanceInVendorLedger(p.id);
      created++;
    } else {
      await repairBalanceLedgerEntry(p.id);
    }
  }

  const { findOperationalPostingGaps, retryOperationalPosting } = await import(
    "../accounting/operational-posting-recovery.service"
  );
  const gaps = (await findOperationalPostingGaps(80)).filter((g) => g.kind === "VENDOR_PAYMENT");
  for (const gap of gaps) {
    await retryOperationalPosting(gap.kind, gap.sourceId);
  }

  return created;
}

export async function listVendorPayments(filters?: {
  vendorId?: string;
  tripId?: string;
  paymentType?: string;
}) {
  await syncVendorPaymentLedger();

  const rows = await prisma.vendorPayment.findMany({
    where: {
      ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters?.tripId ? { tripId: filters.tripId } : {}),
      ...(filters?.paymentType ? { paymentType: filters.paymentType } : {}),
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: paymentInclude,
  });

  return rows.map(mapVendorPayment);
}

export async function countVendorPaymentsThisMonth() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const rows = await prisma.vendorPayment.findMany({
    where: { status: "PAID", paidAt: { gte: start } },
    select: { netPayable: true },
  });

  return {
    count: rows.length,
    total: rows.reduce((s, r) => s + n(r.netPayable), 0),
  };
}

/** Guardrails for manual VendorPayment creation outside workflow modules. */
export function validateManualVendorPaymentContext(input: {
  paymentType: string;
  balanceTaskStatus?: string | null;
  hasBalanceTask: boolean;
  openAdvanceRequest?: { requestNumber: string; status: string } | null;
}): string | null {
  if (input.paymentType === "BALANCE") {
    if (input.balanceTaskStatus === "PROCESSED") {
      return "Invalid payment: vendor balance for this trip is already fully paid";
    }
    if (input.hasBalanceTask) {
      return "Invalid payment: this trip has a balance payment task — record the payment from Balance Payments";
    }
  }
  if (input.paymentType === "ADVANCE" && input.openAdvanceRequest) {
    return `Invalid payment: advance for this trip is handled by request ${input.openAdvanceRequest.requestNumber} (${input.openAdvanceRequest.status}) — use Advance Payments`;
  }
  return null;
}

export async function createVendorPayment(
  input: {
    vendorId: string;
    tripId: string;
    paymentType: string;
    amount: number;
    paidAt: string | Date;
    paymentMode?: string | null;
    referenceNo?: string | null;
    chequeNumber?: string | null;
    notes?: string | null;
    advanceAmount?: number;
    tdsAmount?: number;
  },
  proof: { fileName: string; mimeType?: string; sizeBytes: number; buffer: Buffer } | null,
  actor?: SessionUser | null
) {
  const trip = await prisma.trip.findFirst({
    where: { id: input.tripId, vendorId: input.vendorId },
    select: { id: true, vendorId: true, vendorRate: true, indentId: true },
  });
  if (!trip) throw new Error("Trip not found for this vendor");

  if (input.paymentType === "BALANCE") {
    const task = await prisma.vendorBalancePaymentTask.findUnique({
      where: { tripId: trip.id },
      select: { status: true },
    });
    const manualError = validateManualVendorPaymentContext({
      paymentType: input.paymentType,
      balanceTaskStatus: task?.status,
      hasBalanceTask: Boolean(task),
    });
    if (manualError) throw new Error(manualError);
  }
  if (input.paymentType === "ADVANCE") {
    const { ACTIVE_ADVANCE_REQUEST_STATUSES } = await import("../advance-request-states");
    const openRequest = await prisma.advanceRequest.findFirst({
      where: {
        tripId: trip.id,
        ...managedAdvanceSourceFilter(),
        status: { in: [...ACTIVE_ADVANCE_REQUEST_STATUSES, "PROCESSED"] },
      },
      select: { requestNumber: true, status: true },
    });
    const manualError = validateManualVendorPaymentContext({
      paymentType: input.paymentType,
      hasBalanceTask: false,
      openAdvanceRequest: openRequest,
    });
    if (manualError) throw new Error(manualError);
  }

  const validationError = validatePaymentFields(
    {
      paymentMode: input.paymentMode,
      utrReference: input.referenceNo,
      chequeNumber: input.chequeNumber,
      hasProof: Boolean(proof),
    },
    { requireProof: true, referenceField: "referenceNo" }
  );
  if (validationError) throw new Error(validationError);

  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) throw new Error("Invalid payment date");

  const advanceAmount = input.advanceAmount ?? 0;
  const tdsAmount = input.tdsAmount ?? 0;
  const freight = input.paymentType === "ADVANCE" ? n(trip.vendorRate) : input.amount;
  const netPayable = input.amount;

  const row = await prisma.vendorPayment.create({
    data: {
      tripId: trip.id,
      vendorId: trip.vendorId,
      indentId: trip.indentId,
      paymentType: input.paymentType,
      sourceType: "MANUAL",
      sourceId: `manual:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      amount: freight,
      advanceAmount: input.paymentType === "ADVANCE" ? netPayable : advanceAmount,
      tdsAmount,
      netPayable,
      status: "PAID",
      paidAt,
      paymentMode: input.paymentMode,
      referenceNo: input.referenceNo,
      chequeNumber: input.chequeNumber,
      notes: input.notes,
      recordedById: actor?.id ?? null,
    },
    include: paymentInclude,
  });

  if (input.paymentType === "ADVANCE") {
    const { syncBalanceTaskAmounts } = await import("./trip-charge.service");
    await syncBalanceTaskAmounts(trip.id);
  }

  if (proof) {
    const proofFileId = await storePaymentProof(row.id, proof, actor?.id);
    const updated = await prisma.vendorPayment.update({
      where: { id: row.id },
      data: { proofFileId },
      include: paymentInclude,
    });
    await logAudit({
      user: actor,
      action: "payment.create",
      entity: "VendorPayment",
      entityId: row.id,
      tripId: trip.id,
      meta: { paymentType: input.paymentType, amount: netPayable },
    });
    const { safePostVendorPaymentCashJournal } = await import("../accounting/operational-posting.service");
    await safePostVendorPaymentCashJournal(updated.id, actor?.id);
    return mapVendorPayment(updated);
  }

  await logAudit({
    user: actor,
    action: "payment.create",
    entity: "VendorPayment",
    entityId: row.id,
    tripId: trip.id,
    meta: { paymentType: input.paymentType, amount: netPayable },
  });

  const { safePostVendorPaymentCashJournal } = await import("../accounting/operational-posting.service");
  await safePostVendorPaymentCashJournal(row.id, actor?.id);

  return mapVendorPayment(row);
}
