/**
 * Payment execution worker — drains PaymentOutbox and InboundPaymentOutbox via BullMQ.
 * Run: npm run worker:payment
 */
import { Worker } from "bullmq";
import { processPaymentOutboxJob } from "../src/lib/payments/execution.service";
import { processInboundOutboxJob } from "../src/lib/payments/inbound/inbound-execution.service";

function bullConnection() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is required for the payment worker");
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

const connection = bullConnection();

const outboundWorker = new Worker(
  "tms-payment-execution",
  async (job) => {
    const { outboxId } = job.data as { outboxId: string };
    await processPaymentOutboxJob(outboxId);
  },
  {
    connection,
    concurrency: Number(process.env.PAYMENT_WORKER_CONCURRENCY ?? 3),
  }
);

const inboundWorker = new Worker(
  "tms-inbound-payment",
  async (job) => {
    const { outboxId } = job.data as { outboxId: string };
    await processInboundOutboxJob(outboxId);
  },
  {
    connection,
    concurrency: Number(process.env.PAYMENT_WORKER_CONCURRENCY ?? 3),
  }
);

for (const worker of [outboundWorker, inboundWorker]) {
  worker.on("completed", (job) => {
    console.log(`[payment-worker] completed ${job.queueName} ${job.id}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[payment-worker] failed ${job?.queueName} ${job?.id}:`, err.message);
  });
}

console.log("[payment-worker] listening on tms-payment-execution and tms-inbound-payment");
