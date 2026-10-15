import { NextResponse } from "next/server";
import { requireAuth, authorize } from "@/lib/api";
import { runAllSlaEscalations } from "@/lib/services/sla-escalation.service";

/**
 * Scheduled SLA escalation endpoint.
 * Call from an external cron (or manually with notifications.manage).
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

  const result = await runAllSlaEscalations();
  return NextResponse.json(result);
}
