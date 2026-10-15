import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { processPaymentOutboxJob } from "./execution.service";

export async function enqueuePaymentJob(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; jobType: string; payload?: Prisma.InputJsonValue }
) {
  await tx.paymentOutbox.create({
    data: {
      paymentId: input.paymentId,
      jobType: input.jobType,
      payload: input.payload ?? undefined,
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });
}

/** Drain pending outbox rows (inline when Redis worker is unavailable). */
export async function processPendingPaymentOutbox(limit = 10) {
  const jobs = await prisma.paymentOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    await processPaymentOutboxJob(job.id);
  }

  const { retryPendingFinanceSettlements } = await import("./settlement.service");
  await retryPendingFinanceSettlements(10);
}
