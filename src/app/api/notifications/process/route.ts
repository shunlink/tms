import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { processOutbox } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "notifications.manage");
  if (denied) return denied;
  try {
    const result = await processOutbox();
    await logAudit({ user: auth!.user, action: "notification.process", entity: "Notification", meta: result });
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
