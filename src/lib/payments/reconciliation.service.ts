import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";

export async function runPaymentReconciliation(providerId: string, actor?: SessionUser | null) {
  if (!providerId || providerId === "none") {
    return [];
  }

  const payments = await prisma.outboundPayment.findMany({
    where: {
      providerId,
      status: "SUCCEEDED",
      completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    take: 200,
  });

  const records = [];
  for (const p of payments) {
    const existing = await prisma.reconciliationRecord.findFirst({
      where: { paymentId: p.id, status: { in: ["MATCHED", "OPEN"] } },
    });
    if (existing) continue;

    const record = await prisma.reconciliationRecord.create({
      data: {
        paymentId: p.id,
        providerId,
        providerTransferRef: p.providerTransferRef,
        internalAmountMinor: p.amountMinor,
        providerAmountMinor: null,
        status: "OPEN",
        discrepancyType: "PENDING_PROVIDER_STATEMENT",
        notes:
          "Internal transfer succeeded; awaiting provider settlement report or bank confirmation before MATCHED",
      },
    });
    records.push(record);
  }

  await prisma.auditLog.create({
    data: {
      userId: actor?.id ?? null,
      action: "payment.reconciliation.run",
      entity: "ReconciliationRecord",
      meta: JSON.stringify({ providerId, count: records.length }),
    },
  });

  return records;
}

export async function listReconciliationDiscrepancies() {
  return prisma.reconciliationRecord.findMany({
    where: { status: { in: ["OPEN", "MISMATCH", "UNMATCHED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function resolveReconciliationRecord(
  id: string,
  input: {
    status: "RESOLVED" | "MATCHED";
    notes?: string;
    matchingMethod?: string;
    evidenceJson?: Record<string, unknown>;
  },
  actor?: SessionUser | null
) {
  if (input.status === "MATCHED") {
    const hasEvidence =
      Boolean(input.matchingMethod) ||
      Boolean(input.evidenceJson && Object.keys(input.evidenceJson).length > 0);
    if (!hasEvidence) {
      throw new Error("MATCHED requires matchingMethod and/or evidenceJson — cannot mark matched without evidence");
    }
  }

  const record = await prisma.reconciliationRecord.update({
    where: { id },
    data: {
      status: input.status,
      notes: input.notes,
      matchingMethod: input.matchingMethod ?? undefined,
      evidenceJson: (input.evidenceJson ?? undefined) as Prisma.InputJsonValue | undefined,
      insufficientEvidence: input.status === "MATCHED" ? false : undefined,
      resolvedAt: new Date(),
      resolvedById: actor?.id ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor?.id ?? null,
      action: "payment.reconciliation.resolve",
      entity: "ReconciliationRecord",
      entityId: id,
      meta: JSON.stringify({ status: input.status, matchingMethod: input.matchingMethod ?? null }),
    },
  });

  return record;
}
