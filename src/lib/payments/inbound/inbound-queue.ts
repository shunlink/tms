import "server-only";

import { getBullConnection, queueEnabled } from "../../queue/connection";

const QUEUE_NAME = "tms-inbound-payment";

let inboundQueue: import("bullmq").Queue | null = null;

export async function getInboundPaymentQueue(): Promise<import("bullmq").Queue | null> {
  if (!queueEnabled()) return null;
  if (inboundQueue) return inboundQueue;
  const connection = getBullConnection();
  if (!connection) return null;
  const { Queue } = await import("bullmq");
  inboundQueue = new Queue(QUEUE_NAME, { connection });
  return inboundQueue;
}

export async function dispatchInboundOutboxJob(outboxId: string) {
  const queue = await getInboundPaymentQueue();
  if (queue) {
    await queue.add("process-inbound-outbox", { outboxId }, { removeOnComplete: 100, removeOnFail: 500 });
    return;
  }
  const { processInboundOutboxJob } = await import("./inbound-execution.service");
  await processInboundOutboxJob(outboxId);
}
