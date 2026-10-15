import Link from "next/link";
import {
  Package,
  ClipboardCheck,
  FileText,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
  Truck,
  CheckCircle2,
  TrendingUp,
  Wallet,
  CreditCard,
  IndianRupee,
  Users,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import OrdersBookingsCard from "@/components/orders-bookings-card";
import PendingTasksSection from "@/components/dashboard/pending-tasks-section";
import ExpandableListCard from "@/components/expandable-list-card";
import { formatINR, formatDate } from "@/lib/utils";
import type { AdminDashboardExtras } from "@/lib/team-dashboard-types";
import type { getDashboard } from "@/lib/queries";

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export default function AdminDashboard({
  data: d,
  extras,
  isSuperAdmin = false,
}: {
  data: DashboardData;
  extras: AdminDashboardExtras;
  isSuperAdmin?: boolean;
}) {
  return (
    <div>
      <PageHeader
        title={isSuperAdmin ? "Super Admin Dashboard" : "Admin Dashboard"}
        description="Operations overview for your team"
      />

      <div className="mb-8">
        <PendingTasksSection tasks={extras.pendingTasks} />
      </div>

      <div className="mb-8">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4 pb-2 border-b-2 border-accent inline-block">
          Operations Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Package} value={d.tripsTotal} label="Total Bookings" />
          <StatCard icon={Clock} value={d.pendingPods} label="Pending Delivery Proof" />
          <StatCard icon={FileText} value={d.invoiceCount} label="Open Invoices" />
          <StatCard icon={CheckCircle2} value={d.inProgressTrips} label="In Progress" />
          <StatCard icon={FileSpreadsheet} value={d.totalIndents} label="Indents" />
          <StatCard icon={ClipboardCheck} value={d.placementPending} label="Placement Pending" />
          <StatCard icon={AlertTriangle} value={extras.escalations} label="Escalations" />
          <StatCard icon={Truck} value={`${d.activeVehicles}/${d.totalVehicles}`} label="Active Vehicles" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={AlertTriangle} value={extras.slaBreaches} label="SLA Breaches" />
        <StatCard icon={FileText} value={extras.pendingInvoices} label="Pending Invoices" />
        <StatCard icon={CreditCard} value={extras.balancePaymentEscalations} label="Balance Payment Escalations" />
        <StatCard icon={IndianRupee} value={extras.advanceEscalations} label="Advance Escalations" />
        <StatCard icon={AlertTriangle} value={extras.badPodEscalations} label="Bad POD Escalations" />
      </div>

      <OrdersBookingsCard
        bookingBuckets={d.bookingBuckets}
        indentBuckets={d.indentBuckets}
        tripsTotal={d.tripsTotal}
        totalIndents={d.totalIndents}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={TrendingUp} value={formatINR(d.monthlyRevenue)} label="Monthly Revenue" />
        <StatCard icon={IndianRupee} value={formatINR(d.monthlyMargin)} label="Monthly Margin" />
        <StatCard icon={Wallet} value={formatINR(d.pendingInvoiceAmount)} label="Client Outstanding" />
        <StatCard icon={CreditCard} value={formatINR(d.vendorPayables)} label="Vendor Payables" />
      </div>

      {d.docExpiries > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-8 text-base text-amber-900">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <span>
            {d.docExpiries} vehicle or driver document(s) expiring within 30 days.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Team Activity (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {extras.teamActivity.length === 0 ? (
              <p className="text-muted-foreground text-base">No team activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {extras.teamActivity.map((row) => (
                  <div key={row.teamCode} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                    <span className="font-medium">{row.teamName}</span>
                    <span className="text-sm text-muted-foreground">{row.count} actions</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ExpandableListCard
          title="Employee Activity"
          initialCount={5}
          viewAllHref="/audit"
          emptyMessage="No recent activity."
        >
          {extras.employeeActivity.map((row) => (
            <div key={row.id} className="border-b border-border pb-3 last:border-0">
              <p className="text-sm font-medium">{row.actorName ?? "System"}</p>
              <p className="text-xs text-muted-foreground">
                {row.action} · {row.entity}
                {row.teamCode ? ` · ${row.teamCode}` : ""}
              </p>
            </div>
          ))}
        </ExpandableListCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandableListCard
          title="Recent Trips"
          initialCount={5}
          viewAllHref="/trips"
          emptyMessage="No trips yet."
        >
          {d.recentTrips.map((trip) => (
            <div key={trip.lrNumber} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
              <div>
                <Link href={`/trips/${trip.id}`} className="font-semibold text-primary hover:underline">
                  {trip.lrNumber}
                </Link>
                <p className="text-sm text-muted-foreground mt-0.5">{trip.route}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{trip.client}</p>
                <StatusBadge status={trip.status} className="mt-1" />
              </div>
            </div>
          ))}
        </ExpandableListCard>

        <ExpandableListCard
          title="SLA Escalations"
          initialCount={5}
          viewAllHref="/invoices"
          emptyMessage="No SLA breaches — all teams are on track."
        >
          {extras.slaEscalations.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-3 border-l-4 border-red-500 bg-red-50/40 rounded-r-lg px-4 py-3"
            >
              <div className="w-2 h-2 rounded-full mt-2 shrink-0 bg-red-600" />
              <div className="min-w-0">
                <Link href={item.href} className="font-semibold text-primary hover:underline">
                  {item.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.teamLabel} team · missed deadline {formatDate(item.deadlineAt ?? item.breachedAt)}
                  {item.indentNumber ? ` · ${item.indentNumber}` : ""}
                </p>
              </div>
            </div>
          ))}
        </ExpandableListCard>
      </div>
    </div>
  );
}
