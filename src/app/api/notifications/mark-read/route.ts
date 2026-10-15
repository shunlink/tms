import { requireAuth, ok, unauthorized, authorize } from "@/lib/api";
import { markNotificationsRead } from "@/lib/services/notification-read.service";

export const dynamic = "force-dynamic";

/** Mark notifications as read for the current user (all, or specific ids). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth?.user?.id) return unauthorized();

  const denied = await authorize(auth, "notifications.manage");
  if (denied) return denied;

  let notificationIds: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.notificationIds)) {
      notificationIds = body.notificationIds.filter((id: unknown) => typeof id === "string");
    }
  } catch {
    /* empty body = mark all unread */
  }

  const marked = await markNotificationsRead(auth.user.id, notificationIds);
  return ok({ marked });
}
