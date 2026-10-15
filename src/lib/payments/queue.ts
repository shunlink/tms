import "server-only";

import { getBullConnection, queueEnabled } from "../queue/connection";

const QUEUE_NAME = "tms-payment-execution";

let paymentQueue: import("bullmq").Queue | null = null;

export async function getPaymentQueue(): Promise<import("bullmq").Queue | null> {
  if (!queueEnabled()) return null;
  if (paymentQueue) return paymentQueue;
  const connection = getBullConnection();
  if (!connection) return null;
  const { Queue } = await import("bullmq");
  paymentQueue = new Queue(QUEUE_NAME, { connection });
  return paymentQueue;
}

export async function dispatchPaymentOutboxJob(outboxId: string) {
  const queue = await getPaymentQueue();
  if (queue) {
    await queue.add("process-outbox", { outboxId }, { removeOnComplete: 100, removeOnFail: 500 });
    return;
  }
  const { processPaymentOutboxJob } = await import("./execution.service");
  await processPaymentOutboxJob(outboxId);
}
