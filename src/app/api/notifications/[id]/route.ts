import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, notFound, serverError } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "notifications.manage");
  if (denied) return denied;
  try {
    const existing = await prisma.notification.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Notification not found");

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.status === "SENT") data.sentAt = new Date();

    const notification = await prisma.notification.update({ where: { id: params.id }, data });
    return ok(notification);
  } catch (e) {
    return serverError(e);
  }
}
