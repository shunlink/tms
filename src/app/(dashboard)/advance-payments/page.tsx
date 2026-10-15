import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import AdvancePaymentsTable from "@/components/forms/advance-payments-table";
import AdvancePaymentsHeader from "@/components/forms/advance-payments-header";
import ExternalAdvancesTable from "@/components/forms/external-advances-table";
import { getSessionUser } from "@/lib/auth";
import { listAdvanceRequests } from "@/lib/services/trip-advance.service";
import { getFormOptions } from "@/lib/queries";
import { hasPermission, type PermissionKey } from "@/lib/services/permission.service";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils";
import { AlertTriangle, Clock, IndianRupee, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdvancePaymentsPage() {
  const user = await getSessionUser();
  const [shunLinkRequests, externalRequests, formOptions, trips] = await Promise.all([
    listAdvanceRequests({ source: "SHUNLINK" }),
    listAdvanceRequests({ source: "EXTERNAL" }),
    getFormOptions(),
    prisma.trip.findMany({
      where: {
        status: { notIn: ["CANCELLED", "CLOSED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        lrNumber: true,
        routeFrom: true,
        routeTo: true,
        vendorId: true,
        vendorRate: true,
        indent: { select: { indentNumber: true } },
      },
    }),
  ]);

  const canDecide = await userCan(user, "advance.decide");
  const canRaise = canDecide;
  const canProcess = await userCan(user, "advance.process");
  const canMarkPaid = await userCan(user, "advance.markPaid");

  const pending = shunLinkRequests.filter((r) =>
    ["PENDING_REVIEW", "NEGOTIATED", "VENDOR_ACCEPTED", "APPROVED", "PROCESSING", "SLA_BREACHED"].includes(r.status)
  );
  const breached = shunLinkRequests.filter((r) => r.slaBreached || r.status === "SLA_BREACHED");
  const processedTotal = shunLinkRequests
    .filter((r) => r.status === "PROCESSED")
    .reduce((s, r) => s + (r.approvedAmount ?? r.negotiatedAmount ?? r.requestedAmount), 0);

  return (
    <div>
      <PageHeader
        title="Advance Payments"
        description="ShunLink advance requests and external vendor finance visibility"
        action={
          <AdvancePaymentsHeader
            canRaise={canRaise}
            vendors={formOptions.vendors.map((v) => ({ id: v.id, label: v.name }))}
            trips={trips.map((t) => ({
                id: t.id,
                lrNumber: t.lrNumber,
                route: `${t.routeFrom} → ${t.routeTo}`,
                vendorId: t.vendorId,
                vendorRate: Number(t.vendorRate),
                indentNumber: t.indent?.indentNumber ?? null,
              }))}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Clock} value={String(pending.length)} label="ShunLink Pending" />
        <StatCard icon={AlertTriangle} value={String(breached.length)} label="SLA Breached" />
        <StatCard icon={IndianRupee} value={formatINR(processedTotal)} label="ShunLink Processed" />
        <StatCard icon={Building2} value={String(externalRequests.length)} label="External Provider" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>ShunLink Advance Requests ({shunLinkRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvancePaymentsTable
            requests={shunLinkRequests}
            canDecide={canDecide}
            canProcess={canProcess}
            canMarkPaid={canMarkPaid}
            currentUserId={user?.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>External Finance Provider Requests ({externalRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Vendors who chose an external finance provider instead of ShunLink. Not processed by ShunLink Finance.
          </p>
          <ExternalAdvancesTable requests={externalRequests} canEdit={canDecide} />
        </CardContent>
      </Card>
    </div>
  );
}

async function userCan(user: Awaited<ReturnType<typeof getSessionUser>>, p: PermissionKey) {
  if (!user?.id) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return hasPermission(user.id, p);
}
