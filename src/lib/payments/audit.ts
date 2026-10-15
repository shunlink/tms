import type { Prisma } from "@prisma/client";

export async function logPaymentAudit(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; action: string; actorId?: string | null; metadata?: Prisma.InputJsonValue }
) {
  await tx.paymentAuditLog.create({
    data: {
      paymentId: input.paymentId,
      action: input.action,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
