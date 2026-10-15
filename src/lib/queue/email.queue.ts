import "server-only";

export type EmailJobPayload = {
  notificationId: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
};

const QUEUE_NAME = "tms-email-notifications";

let queuePromise: Promise<import("bullmq").Queue<EmailJobPayload> | null> | null = null;

async function getEmailQueue() {
  if (!queuePromise) {
    queuePromise = (async () => {
      const { getBullConnection, queueEnabled } = await import("./connection");
      if (!queueEnabled()) return null;
      const connection = getBullConnection();
      if (!connection) return null;
      const { Queue } = await import("bullmq");
      return new Queue<EmailJobPayload>(QUEUE_NAME, { connection });
    })();
  }
  return queuePromise;
}

export async function enqueueEmailJob(payload: EmailJobPayload) {
  const queue = await getEmailQueue();
  if (!queue) return false;
  await queue.add("send", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
  return true;
}

export { QUEUE_NAME };
