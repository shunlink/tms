import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { nextNumber } from "../sequence";
import { managedAdvanceSourceFilter } from "../constants";
import type { SessionUser } from "../auth";
import { logAudit } from "../audit";
import { gatewayExecutionEnabled } from "./config";
import { sanitizeBeneficiaryForClient } from "./beneficiary";
import { logPaymentAudit } from "./audit";
import { enqueuePaymentJob } from "./outbox";
import { dispatchPaymentOutboxJob } from "./queue";
import { assertPaymentTransition } from "./state-machine";
import { minorToRupees, rupeesToMinor } from "./money";

const paymentInclude = {
  vendor: { select: { id: true, name: true } },
  indent: { select: { id: true, indentNumber: true } },
  trip: { select: { id: true, lrNumber: true } },
  beneficiary: true,
  attempts: { orderBy: { attemptNumber: "asc" } },
  approvals: { orderBy: { createdAt: "asc" }, include: { approver: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.OutboundPaymentInclude;

function mapPayment(row: Prisma.OutboundPaymentGetPayload<{ include: typeof paymentInclude }>) {
  return {
    id: row.id,
    paymentNumber: row.paymentNumber,
    purpose: row.purpose,
    settlementChannel: row.settlementChannel,
    amountMinor: row.amountMinor,
    amount: minorToRupees(row.amountMinor),
    currency: row.currency,
    status: row.status,
    approvalStatus: row.approvalStatus,
    vendorId: row.vendorId,
    vendor: row.vendor,
    indentId: row.indentId,
    indent: row.indent,
    tripId: row.tripId,
    trip: row.trip,
    advanceRequestId: row.advanceRequestId,
    balancePaymentTaskId: row.balancePaymentTaskId,
    beneficiaryId: row.beneficiaryId,
    beneficiary: row.beneficiary ? sanitizeBeneficiaryForClient(row.beneficiary) : null,
    providerId: row.providerId,
    providerTransferRef: row.providerTransferRef,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    initiatedAt: row.initiatedAt,
    approvedAt: row.approvedAt,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
    createdBy: row.createdBy,
    attempts: row.attempts,
    approvals: row.approvals,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type CreateOutboundPaymentInput = {
  purpose: "ADVANCE" | "BALANCE" | "ADDITIONAL_CHARGE" | "REFUND" | "OTHER";
  amountRupees: number;
  vendorId: string;
  indentId?: string | null;
  tripId?: string | null;
  advanceRequestId?: string | null;
  balancePaymentTaskId?: string | null;
  beneficiaryId?: string | null;
  idempotencyKey?: string;
};

export async function createOutboundPaymentDraft(input: CreateOutboundPaymentInput, actor?: SessionUser | null) {
  if (input.amountRupees <= 0) throw new Error("Amount must be greater than zero");

  const amountMinor = rupeesToMinor(input.amountRupees);
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const existing = await prisma.outboundPayment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const row = await prisma.outboundPayment.findUnique({ where: { id: existing.id }, include: paymentInclude });
    return row ? mapPayment(row) : null;
  }

  if (input.advanceRequestId) {
    await validateAdvancePaymentDraft(input.advanceRequestId, input.amountRupees);
  }
  if (input.balancePaymentTaskId) {
    await validateBalancePaymentDraft(input.balancePaymentTaskId, input.amountRupees);
  }

  const paymentNumber = await nextNumber("PAY");

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.outboundPayment.create({
      data: {
        paymentNumber,
        purpose: input.purpose,
        settlementChannel: "GATEWAY",
        amountMinor,
        currency: "INR",
        status: "DRAFT",
        approvalStatus: "PENDING",
        vendorId: input.vendorId,
        indentId: input.indentId ?? null,
        tripId: input.tripId ?? null,
        advanceRequestId: input.advanceRequestId ?? null,
        balancePaymentTaskId: input.balancePaymentTaskId ?? null,
        beneficiaryId: input.beneficiaryId ?? null,
        idempotencyKey,
        createdById: actor?.id ?? null,
        initiatedAt: new Date(),
      },
      include: paymentInclude,
    });
    await logPaymentAudit(tx, {
      paymentId: created.id,
      action: "CREATED",
      actorId: actor?.id,
      metadata: { purpose: input.purpose, amountMinor },
    });
    return created;
  });

  await logAudit({
    user: actor,
    action: "outbound_payment.created",
    entity: "OutboundPayment",
    entityId: row.id,
    meta: { paymentNumber, purpose: input.purpose, amount: input.amountRupees },
  });

  return mapPayment(row);
}

async function validateAdvancePaymentDraft(advanceRequestId: string, amountRupees: number) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id: advanceRequestId, ...managedAdvanceSourceFilter() },
  });
  if (!req) throw new Error("Advance request not found");
  if (!["APPROVED", "VENDOR_ACCEPTED", "SLA_BREACHED", "PROCESSING"].includes(req.status)) {
    throw new Error(`Advance request in status ${req.status} cannot initiate gateway payment`);
  }
  const cap = Number(req.approvedAmount ?? req.negotiatedAmount ?? req.requestedAmount);
  if (amountRupees > cap + 0.01) throw new Error(`Amount exceeds approved advance of ₹${cap}`);

  const dup = await prisma.outboundPayment.findFirst({
    where: {
      advanceRequestId,
      status: { notIn: ["CANCELLED", "FAILED"] },
    },
  });
  if (dup) throw new Error("An active gateway payment already exists for this advance request");
}

async function validateBalancePaymentDraft(taskId: string, amountRupees: number) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({ where: { id: taskId } });
  if (!task) throw new Error("Balance payment task not found");
  if (!["APPROVED", "PROCESSING", "PARTIALLY_PAID", "SLA_BREACHED"].includes(task.status)) {
    throw new Error(`Balance task in status ${task.status} cannot initiate gateway payment`);
  }
  const outstanding = Math.max(0, Number(task.balanceAmount) - Number(task.paidAmount));
  if (amountRupees > outstanding + 0.01) {
    throw new Error(`Amount exceeds outstanding balance of ₹${outstanding}`);
  }
}

export async function submitOutboundPaymentForApproval(paymentId: string, actor?: SessionUser | null) {
  const payment = await prisma.outboundPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;

  const row = await prisma.$transaction(async (tx) => {
    assertPaymentTransition(payment.status, "PENDING_APPROVAL");
    const updated = await tx.outboundPayment.update({
      where: { id: paymentId },
      data: { status: "PENDING_APPROVAL" },
      include: paymentInclude,
    });
    await logPaymentAudit(tx, { paymentId, action: "SUBMITTED_FOR_APPROVAL", actorId: actor?.id });
    return updated;
  });

  return mapPayment(row);
}

export async function approveOutboundPayment(
  paymentId: string,
  input: { decision: "APPROVED" | "REJECTED"; reason?: string | null },
  actor?: SessionUser | null
) {
  const payment = await prisma.outboundPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (payment.status !== "PENDING_APPROVAL") {
    throw new Error("Payment is not pending approval");
  }
  if (actor?.id && payment.createdById && actor.id === payment.createdById) {
    throw new Error("Approver must be different from payment creator");
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.paymentApproval.create({
      data: {
        paymentId,
        decision: input.decision,
        reason: input.reason ?? null,
        approverId: actor?.id ?? null,
        policy: "FINANCE_DUAL_CONTROL",
      },
    });

    if (input.decision === "REJECTED") {
      assertPaymentTransition(payment.status, "CANCELLED");
      return tx.outboundPayment.update({
        where: { id: paymentId },
        data: {
          status: "CANCELLED",
          approvalStatus: "REJECTED",
          failureMessage: input.reason ?? "Rejected",
        },
        include: paymentInclude,
      });
    }

    assertPaymentTransition(payment.status, "APPROVED");
    return tx.outboundPayment.update({
      where: { id: paymentId },
      data: {
        status: "APPROVED",
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
      },
      include: paymentInclude,
    });
  });

  return mapPayment(row);
}

export async function executeOutboundPayment(paymentId: string, actor?: SessionUser | null) {
  if (!gatewayExecutionEnabled()) {
    throw new Error(
      "Gateway execution is not enabled. Configure PAYMENT_GATEWAY_PROVIDER or use non-production mock provider."
    );
  }

  const payment = await prisma.outboundPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (payment.status !== "APPROVED") throw new Error("Payment must be approved before execution");

  const pending = await prisma.paymentOutbox.findFirst({
    where: { paymentId, jobType: "EXECUTE_TRANSFER", status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (pending) {
    await dispatchPaymentOutboxJob(pending.id);
    const row = await prisma.outboundPayment.findUnique({ where: { id: paymentId }, include: paymentInclude });
    return row ? mapPayment(row) : null;
  }

  let outboxId: string | null = null;
  await prisma.$transaction(async (tx) => {
    await enqueuePaymentJob(tx, { paymentId, jobType: "EXECUTE_TRANSFER" });
    const job = await tx.paymentOutbox.findFirst({
      where: { paymentId, jobType: "EXECUTE_TRANSFER", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    outboxId = job?.id ?? null;
    await logPaymentAudit(tx, { paymentId, action: "EXECUTION_QUEUED", actorId: actor?.id });
  });

  if (outboxId) await dispatchPaymentOutboxJob(outboxId);

  const row = await prisma.outboundPayment.findUnique({ where: { id: paymentId }, include: paymentInclude });
  return row ? mapPayment(row) : null;
}

export async function cancelOutboundPayment(paymentId: string, actor?: SessionUser | null, reason?: string) {
  const payment = await prisma.outboundPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "FAILED"].includes(payment.status)) {
    throw new Error(`Cannot cancel payment in status ${payment.status}`);
  }

  const row = await prisma.$transaction(async (tx) => {
    assertPaymentTransition(payment.status, "CANCELLED");
    const updated = await tx.outboundPayment.update({
      where: { id: paymentId },
      data: { status: "CANCELLED", failureMessage: reason ?? null },
      include: paymentInclude,
    });
    await logPaymentAudit(tx, { paymentId, action: "CANCELLED", actorId: actor?.id, metadata: { reason } });
    return updated;
  });

  return mapPayment(row);
}

export async function getOutboundPayment(paymentId: string) {
  const row = await prisma.outboundPayment.findUnique({ where: { id: paymentId }, include: paymentInclude });
  return row ? mapPayment(row) : null;
}

export async function listOutboundPayments(filters?: {
  vendorId?: string;
  indentId?: string;
  tripId?: string;
  status?: string;
  purpose?: string;
  limit?: number;
  offset?: number;
}) {
  const rows = await prisma.outboundPayment.findMany({
    where: {
      vendorId: filters?.vendorId,
      indentId: filters?.indentId,
      tripId: filters?.tripId,
      status: filters?.status,
      purpose: filters?.purpose,
    },
    include: paymentInclude,
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
  return rows.map(mapPayment);
}

export async function listPaymentsForIndent(indentId: string) {
  return listOutboundPayments({ indentId, limit: 100 });
}

/** Create a gateway payment draft from an approved trip advance request. */
export async function createAdvanceGatewayPayment(
  advanceRequestId: string,
  beneficiaryId: string,
  actor?: SessionUser | null
) {
  const req = await prisma.advanceRequest.findFirst({
    where: { id: advanceRequestId, ...managedAdvanceSourceFilter() },
    include: { trip: { select: { id: true, indentId: true, vendorId: true } } },
  });
  if (!req?.trip) throw new Error("Advance request not found");

  const amountRupees = Number(req.approvedAmount ?? req.negotiatedAmount ?? req.requestedAmount);
  return createOutboundPaymentDraft(
    {
      purpose: "ADVANCE",
      amountRupees,
      vendorId: req.vendorId,
      tripId: req.tripId,
      indentId: req.trip.indentId,
      advanceRequestId: req.id,
      beneficiaryId,
    },
    actor
  );
}

/** Create a gateway payment draft for vendor balance settlement (partial or full outstanding). */
export async function createBalanceGatewayPayment(
  balancePaymentTaskId: string,
  amountRupees: number,
  beneficiaryId: string,
  actor?: SessionUser | null
) {
  const task = await prisma.vendorBalancePaymentTask.findFirst({
    where: { id: balancePaymentTaskId },
    include: { trip: { select: { id: true } } },
  });
  if (!task) throw new Error("Balance payment task not found");

  return createOutboundPaymentDraft(
    {
      purpose: "BALANCE",
      amountRupees,
      vendorId: task.vendorId,
      tripId: task.tripId,
      indentId: task.indentId,
      balancePaymentTaskId: task.id,
      beneficiaryId,
    },
    actor
  );
}
