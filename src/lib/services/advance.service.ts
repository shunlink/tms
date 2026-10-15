import { prisma } from "../prisma";
import { assertTransition } from "../indent-states";
import { logAudit } from "../audit";
import { AUDIT_ACTIONS } from "../audit-actions";
import type { SessionUser } from "../auth";

export type AdvanceDecisionInput = {
  requestedAmount?: number | null;
  approvedAmount?: number | null;
  status: "PENDING" | "APPROVED" | "PAID" | "REJECTED";
  remarks?: string | null;
};

/** Set advance amount and proceed — single-step (0 or any amount). */
export async function confirmAdvance(
  indentId: string,
  data: { amount: number; remarks?: string | null },
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  if (!["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING"].includes(indent.status)) {
    throw new Error(`Indent in status ${indent.status} cannot set advance`);
  }
  if (indent.advanceStatus === "PAID") {
    throw new Error("Advance is already confirmed for this indent");
  }

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    assertTransition(indent.status, "ADVANCE_PAID");
    await tx.indent.update({
      where: { id: indentId },
      data: {
        advanceRequested: data.amount,
        advanceApproved: data.amount,
        advanceStatus: "PAID",
        status: "ADVANCE_PAID",
      },
    });

    if (data.amount > 0) {
      const alreadyPaid = await tx.indentPayment.findFirst({
        where: { indentId, paymentType: "ADVANCE" },
      });
      if (alreadyPaid) {
        throw new Error("Advance payment already recorded for this indent");
      }
      await tx.indentPayment.create({
        data: {
          indentId,
          paymentType: "ADVANCE",
          amount: data.amount,
          paidAt,
          recordedById: actor?.id ?? null,
        },
      });
    }
  });

  await logAudit({
    user: actor,
    action: "advance.confirmed",
    entity: "INDENT",
    entityId: indentId,
    meta: data,
  });

  return (await import("./indent.service")).getIndentById(indentId);
}

/** Operations requests a vendor advance amount (does not approve or pay). */
export async function requestAdvance(
  indentId: string,
  data: { requestedAmount: number; remarks?: string | null },
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  if (!["DRAFT", "WAITING_FOR_ADVANCE"].includes(indent.status)) {
    throw new Error(`Indent in status ${indent.status} cannot request an advance`);
  }
  if (
    indent.advanceRequested &&
    ["PENDING", "APPROVED", "PAID"].includes(indent.advanceStatus)
  ) {
    throw new Error("An advance request already exists for this indent");
  }

  await prisma.indent.update({
    where: { id: indentId },
    data: {
      advanceRequested: data.requestedAmount,
      advanceStatus: "PENDING",
      status: indent.status === "DRAFT" ? "WAITING_FOR_ADVANCE" : indent.status,
    },
  });

  const { createImportantEvent } = await import("./important-event.service");
  await createImportantEvent({
    type: "ADVANCE_PENDING",
    severity: "WARNING",
    title: `Advance requested for ${indent.indentNumber}`,
    description: data.remarks ?? `Requested ₹${data.requestedAmount}`,
    indentId,
  });

  await logAudit({
    user: actor,
    action: "advance.requested",
    entity: "INDENT",
    entityId: indentId,
    meta: data,
  });

  return (await import("./indent.service")).getIndentById(indentId);
}

/** Finance decides the advance amount/status (requested vs approved). */
export async function decideAdvance(
  indentId: string,
  input: AdvanceDecisionInput,
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;

  if (!["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING"].includes(indent.status)) {
    throw new Error(`Indent in status ${indent.status} cannot receive an advance decision`);
  }
  if (input.status === "APPROVED" && indent.advanceStatus === "PAID") {
    throw new Error("Advance is already paid");
  }
  if (input.status === "APPROVED" && !indent.advanceRequested && !input.requestedAmount) {
    throw new Error("No advance has been requested yet");
  }

  let nextStatus = indent.status;
  if (input.status === "APPROVED" && indent.status === "WAITING_FOR_ADVANCE") {
    nextStatus = "ADVANCE_PENDING";
  } else if (input.status === "REJECTED") {
    nextStatus = "WAITING_FOR_ADVANCE";
  }

  await prisma.$transaction(async (tx) => {
    if (nextStatus !== indent.status) {
      assertTransition(indent.status, nextStatus);
    }
    await tx.indent.update({
      where: { id: indentId },
      data: {
        advanceRequested: input.requestedAmount ?? null,
        advanceApproved: input.approvedAmount ?? null,
        advanceStatus: input.status,
        ...(nextStatus !== indent.status ? { status: nextStatus } : {}),
      },
    });
  });

  if (input.status === "APPROVED") {
    const { createImportantEvent } = await import("./important-event.service");
    await createImportantEvent({
      type: "ADVANCE_PENDING",
      severity: "WARNING",
      title: `Advance approved for ${indent.indentNumber} — mark paid to release`,
      indentId,
    });
  }

  await logAudit({
    user: actor,
    action: input.status === "APPROVED" ? AUDIT_ACTIONS.APPROVED_ADVANCE : "advance.decided",
    entity: "Indent",
    entityId: indentId,
    meta: input,
    before: { advanceStatus: indent.advanceStatus },
    after: { advanceStatus: input.status, approvedAmount: input.approvedAmount ?? null },
  });

  return (await import("./indent.service")).getIndentById(indentId);
}

/** Mark the advance as paid — the release condition for vendor visibility. */
export async function markAdvancePaid(
  indentId: string,
  data: { mode?: string | null; referenceNo?: string | null; paidAt?: string | Date | null },
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({ where: { id: indentId } });
  if (!indent) return null;
  if (!["WAITING_FOR_ADVANCE", "ADVANCE_PENDING"].includes(indent.status)) {
    throw new Error(`Indent in status ${indent.status} cannot mark advance paid`);
  }
  if (indent.advanceStatus !== "APPROVED") {
    throw new Error("Advance must be approved before marking it paid");
  }

  const amount = indent.advanceApproved ?? indent.advanceRequested ?? null;
  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("Invalid payment date");
  }

  await prisma.$transaction(async (tx) => {
    assertTransition(indent.status, "ADVANCE_PAID");
    await tx.indent.update({
      where: { id: indentId },
      data: { advanceStatus: "PAID", status: "ADVANCE_PAID" },
    });

    if (amount && amount.gt(0)) {
      const alreadyPaid = await tx.indentPayment.findFirst({
        where: { indentId, paymentType: "ADVANCE" },
      });
      if (alreadyPaid) {
        throw new Error("Advance payment already recorded for this indent");
      }
      await tx.indentPayment.create({
        data: {
          indentId,
          paymentType: "ADVANCE",
          amount,
          mode: data.mode ?? null,
          referenceNo: data.referenceNo ?? null,
          paidAt,
          recordedById: actor?.id ?? null,
        },
      });
    }
  });

  await logAudit({
    user: actor,
    action: "advance.paid",
    entity: "INDENT",
    entityId: indentId,
    meta: data,
  });

  return (await import("./indent.service")).getIndentById(indentId);
}
