import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NotificationActions from "@/components/forms/notification-actions";
import ProcessOutbox from "@/components/forms/process-outbox";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import NotificationsBadgeSync from "@/components/notifications-badge-sync";
import { markNotificationsRead } from "@/lib/services/notification-read.service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (user?.id) {
    await markNotificationsRead(user.id);
  }

  const notifications = await getNotifications();
  const pending = notifications.filter((n) => n.status === "PENDING").length;

  return (
    <div>
      <NotificationsBadgeSync />
      <PageHeader
        title="Notifications"
        description={`Client message outbox (WhatsApp / SMS) — ${pending} pending`}
        action={<ProcessOutbox />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Message Outbox ({notifications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-3 font-medium">Channel</th>
                <th className="pb-3 font-medium">To</th>
                <th className="pb-3 font-medium">Message</th>
                <th className="pb-3 font-medium">LR</th>
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No notifications yet.
                  </td>
                </tr>
              )}
              {notifications.map((x) => (
                <tr key={x.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {x.channel}
                    </span>
                  </td>
                  <td className="py-3 text-slate-600">{x.to}</td>
                  <td className="py-3 text-slate-800 max-w-md">{x.body}</td>
                  <td className="py-3 text-blue-600">{x.lrNumber ?? "—"}</td>
                  <td className="py-3 text-slate-600">{formatDate(x.createdAt)}</td>
                  <td className="py-3">
                    <StatusBadge status={x.status} />
                  </td>
                  <td className="py-3">
                    <NotificationActions id={x.id} status={x.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
