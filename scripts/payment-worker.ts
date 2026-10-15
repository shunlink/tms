/**
 * Payment execution worker — drains PaymentOutbox via BullMQ.
 * Run: npm run worker:payment
 */
import { Worker } from "bullmq";
import { processPaymentOutboxJob } from "../src/lib/payments/execution.service";

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

const worker = new Worker(
  "tms-payment-execution",
  async (job) => {
    const { outboxId } = job.data as { outboxId: string };
    await processPaymentOutboxJob(outboxId);
  },
  {
    connection: bullConnection(),
    concurrency: Number(process.env.PAYMENT_WORKER_CONCURRENCY ?? 3),
  }
);

worker.on("completed", (job) => {
  console.log(`[payment-worker] completed ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[payment-worker] failed ${job?.id}:`, err.message);
});

console.log("[payment-worker] listening on tms-payment-execution");
