import { NextResponse } from "next/server";
import { requireAuth, authorize } from "@/lib/api";
import { enqueueSlaEscalationRun } from "@/lib/queue/sla-escalation.queue";
import { runAllSlaEscalations } from "@/lib/services/sla-escalation.service";

/**
 * Scheduled SLA escalation endpoint.
 * With REDIS_URL + worker:sla running, enqueues a BullMQ job; otherwise runs inline.
 * External cron may still POST here with CRON_SECRET.
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const bearerOk = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!bearerOk) {
    const auth = await requireAuth();
    const denied = await authorize(auth, "notifications.manage");
    if (denied) return denied;
  }

  const queued = await enqueueSlaEscalationRun();
  if (queued) {
    return NextResponse.json({ queued: true, message: "SLA escalation job enqueued on Redis" });
  }

  const result = await runAllSlaEscalations();
  return NextResponse.json(result);
}
