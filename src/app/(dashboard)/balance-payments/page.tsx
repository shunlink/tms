import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import BalancePaymentsTable from "@/components/forms/balance-payments-table";
import { getSessionUser } from "@/lib/auth";
import { listBalancePaymentTasks } from "@/lib/services/vendor-balance-payment.service";
import { hasPermission, type PermissionKey } from "@/lib/services/permission.service";
import { formatINR } from "@/lib/utils";
import { AlertTriangle, Clock, IndianRupee } from "lucide-react";
import { redirect } from "next/navigation";
import { requireInternalSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function BalancePaymentsPage() {
  const user = await requireInternalSession();
  if (user.role !== "SUPER_ADMIN") {
    const canPay = await hasPermission(user.id!, "payment.view");
    const canTrip = await hasPermission(user.id!, "trip.view");
    if (!canPay && !canTrip) redirect("/");
  }
  const tasks = await listBalancePaymentTasks(undefined, user);

  const canProcess = await userCan(user, "payment.process");
  const canApprove = await userCan(user, "payment.approve");

  const pending = tasks.filter((t) =>
    ["PENDING_REVIEW", "APPROVED", "PROCESSING", "PARTIALLY_PAID", "SLA_BREACHED"].includes(t.status)
  );
  const breached = tasks.filter((t) => t.slaBreached || t.status === "SLA_BREACHED");
  const pendingBalance = pending.reduce((s, t) => s + (t.outstandingBalance ?? t.balanceAmount), 0);

  return (
    <div>
      <PageHeader
        title="Vendor Balance Payments"
        description="Post-POD vendor balance settlement — 96-hour SLA from POD verification"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Clock} value={String(pending.length)} label="Pending Tasks" />
        <StatCard icon={AlertTriangle} value={String(breached.length)} label="SLA Breached" />
        <StatCard icon={IndianRupee} value={formatINR(pendingBalance)} label="Balance Outstanding" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance Payment Tasks ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <BalancePaymentsTable
            tasks={tasks}
            canProcess={canProcess}
            canApprove={canApprove}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function userCan(user: Awaited<ReturnType<typeof getSessionUser>>, p: PermissionKey) {
  if (!user?.id) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
  return hasPermission(user.id, p);
}
