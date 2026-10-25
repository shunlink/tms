import "server-only";

import { getBullConnection, queueEnabled } from "./connection";
import {
  SLA_ESCALATION_JOB_NAME,
  SLA_ESCALATION_QUEUE_NAME,
  SLA_ESCALATION_SCHEDULER_ID,
  slaEscalationIntervalMs,
} from "./sla-escalation.constants";

export {
  SLA_ESCALATION_JOB_NAME,
  SLA_ESCALATION_QUEUE_NAME,
  SLA_ESCALATION_SCHEDULER_ID,
  slaEscalationIntervalMs,
} from "./sla-escalation.constants";

let queuePromise: Promise<import("bullmq").Queue | null> | null = null;

async function getSlaEscalationQueue() {
  if (!queuePromise) {
    queuePromise = (async () => {
      if (!queueEnabled()) return null;
      const connection = getBullConnection();
      if (!connection) return null;
      const { Queue } = await import("bullmq");
      return new Queue(SLA_ESCALATION_QUEUE_NAME, { connection });
    })();
  }
  return queuePromise;
}

/** Register (or update) the Redis/BullMQ repeatable scheduler — call from the SLA worker on startup. */
export async function ensureSlaEscalationScheduler() {
  const queue = await getSlaEscalationQueue();
  if (!queue) return false;

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
  return true;
}

/** Enqueue a one-off SLA escalation run (e.g. from HTTP cron). Returns false if Redis queue unavailable. */
export async function enqueueSlaEscalationRun() {
  const queue = await getSlaEscalationQueue();
  if (!queue) return false;
  await queue.add(
    SLA_ESCALATION_JOB_NAME,
    {},
    {
      removeOnComplete: 50,
      removeOnFail: 100,
    }
  );
  return true;
}
