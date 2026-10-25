/**
 * SLA escalation worker — repeatable BullMQ job on Redis (advance, POD, invoice, balance, onboarding assignment).
 * Run: npm run worker:sla
 *
 * Requires REDIS_URL. Registers a repeatable scheduler on startup, then drains the queue.
 */
import { Queue, Worker } from "bullmq";
import {
  SLA_ESCALATION_JOB_NAME,
  SLA_ESCALATION_QUEUE_NAME,
  SLA_ESCALATION_SCHEDULER_ID,
  slaEscalationIntervalMs,
} from "../src/lib/queue/sla-escalation.constants";

function bullConnection() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is required for the SLA escalation worker");
  const parsed = new URL(url);
  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  return {
    host: isLocal ? "127.0.0.1" : parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

async function registerScheduler(connection: ReturnType<typeof bullConnection>) {
  const queue = new Queue(SLA_ESCALATION_QUEUE_NAME, { connection });
  await queue.upsertJobScheduler(
    SLA_ESCALATION_SCHEDULER_ID,
    { every: slaEscalationIntervalMs() },
    {
      name: SLA_ESCALATION_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    }
  );
  await queue.close();
  console.log(
    `[sla-worker] registered repeatable job every ${slaEscalationIntervalMs()}ms (${SLA_ESCALATION_SCHEDULER_ID})`
  );
}

async function main() {
  const connection = bullConnection();
  await registerScheduler(connection);

  const worker = new Worker(
    SLA_ESCALATION_QUEUE_NAME,
    async () => {
      const { runAllSlaEscalations } = await import("../src/lib/services/sla-escalation.service");
      return runAllSlaEscalations();
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job, result) => {
    const total = result && typeof result === "object" && "total" in result ? result.total : "?";
    console.log(`[sla-worker] completed ${job.id} (escalations: ${total})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[sla-worker] failed ${job?.id}:`, err.message);
  });

  console.log(`[sla-worker] listening on ${SLA_ESCALATION_QUEUE_NAME}`);
}

main().catch((e) => {
  console.error("[sla-worker] fatal:", e);
  process.exit(1);
});
