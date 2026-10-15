import { prisma } from "../prisma";
/** Count notifications the user has not yet viewed/read. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      reads: { none: { userId } },
    },
  });
}

/** Mark one or all notifications as read for a user. */
export async function markNotificationsRead(userId: string, notificationIds?: string[]) {
  const unread = await prisma.notification.findMany({
    where: {
      reads: { none: { userId } },
      ...(notificationIds?.length ? { id: { in: notificationIds } } : {}),
    },
    select: { id: true },
  });

  if (unread.length === 0) return 0;

  await prisma.userNotificationRead.createMany({
    data: unread.map((n) => ({ userId, notificationId: n.id })),
    skipDuplicates: true,
  });

  return unread.length;
}