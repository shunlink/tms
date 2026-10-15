import { NextResponse } from "next/server";
import { requireAuth, authorize } from "@/lib/api";
import { sendOverdueTaskDigest } from "@/lib/services/overdue-digest.service";

/** Daily combined email of all overdue SLA tasks to Admin + Super Admin. */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const bearerOk = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!bearerOk) {
    const auth = await requireAuth();
    const denied = await authorize(auth, "notifications.manage");
    if (denied) return denied;
  }

  const result = await sendOverdueTaskDigest();
  return NextResponse.json(result);
}
