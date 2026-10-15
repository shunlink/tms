/**
 * Async email worker — drains BullMQ email jobs and sends via Resend.
 * Run: npm run worker:email
 */
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { sendResendEmail } from "../src/lib/email/resend";

const prisma = new PrismaClient();

function bullConnection() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is required for the email worker");
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

const worker = new Worker(
  "tms-email-notifications",
  async (job) => {
    const { notificationId, to, subject, body, html } = job.data;
    const result = await sendResendEmail({
      to,
      subject,
      html: html ?? `<p>${body.replace(/\n/g, "<br/>")}</p>`,
      text: body,
    });

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        sentAt: result.ok ? new Date() : null,
        attempts: { increment: 1 },
        error: result.ok ? null : result.detail ?? "Unknown error",
      },
    });

    if (!result.ok) throw new Error(result.detail ?? "Email send failed");
    return result;
  },
  {
    connection: bullConnection(),
    concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY ?? 5),
  }
);

worker.on("completed", (job) => {
  console.log(`[email-worker] sent ${job.id} -> ${job.data.to}`);
});

worker.on("failed", (job, err) => {
  console.error(`[email-worker] failed ${job?.id}:`, err.message);
});

console.log("[email-worker] listening on tms-email-notifications");
