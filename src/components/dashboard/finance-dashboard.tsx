import { Suspense } from "react";
import Link from "next/link";
import {
  IndianRupee,
  FileText,
  CreditCard,
  AlertTriangle,
  Clock,
  Receipt,
  Building2,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  ListOrdered,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import PendingTasksSection from "@/components/dashboard/pending-tasks-section";
import FinanceMetricCard from "@/components/dashboard/finance-metric-card";
import FinanceDashboardFilters from "@/components/dashboard/finance-dashboard-filters";
import ExpandableListCard from "@/components/expandable-list-card";
import { formatINR, formatDate } from "@/lib/utils";
import type { FinanceDashboardData } from "@/lib/team-dashboard-types";

const SUMMARY_ICONS = {
  revenue: TrendingUp,
  receivables: FileText,
  collected: IndianRupee,
  payables: Wallet,
  "vendor-paid": CreditCard,
  "advances-outstanding": Building2,
  tds: Receipt,
  margin: TrendingUp,
} as const;

function SectionLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2 hover:text-primary">
      <h2 className="font-heading text-lg font-semibold text-foreground pb-2 border-b-2 border-accent inline-block group-hover:border-primary">
        {title}
      </h2>
      <ArrowRightLeft className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export default function FinanceDashboard({ data }: { data: FinanceDashboardData }) {
  const { metrics: m } = data;

  return (
    <div>
      <PageHeader
        title="Finance Dashboard"
        description="Revenue, receivables, payables, payment queues, and trip profitability"
      />

      <Suspense fallback={<p className="mb-8 text-sm text-muted-foreground">Loading filters…</p>}>
        <FinanceDashboardFilters options={m.filterOptions} />
      </Suspense>

      <h2 className="font-heading text-lg font-semibold text-foreground mb-4 pb-2 border-b-2 border-accent inline-block">
        Financial Summary
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {m.summary.map((card) => (
          <FinanceMetricCard
            key={card.key}
            label={card.label}
            amount={card.amount}
            kind={card.kind}
            href={card.href}
            icon={SUMMARY_ICONS[card.key as keyof typeof SUMMARY_ICONS] ?? IndianRupee}
          />
        ))}
      </div>

      <div className="mb-8">
        <PendingTasksSection tasks={data.pendingTasks} />
      </div>

      <h2 className="font-heading text-lg font-semibold text-foreground mb-4 pb-2 border-b-2 border-accent inline-block">
        Payment Queues
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {m.paymentQueues.map((q) => (
          <Link key={q.key} href={q.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  <span className="font-heading text-2xl font-bold">{q.count}</span>
                </div>
                <p className="text-sm text-muted-foreground">{q.label}</p>
                {q.amount > 0 && (
                  <p className="text-sm font-medium text-foreground mt-2">{formatINR(q.amount)}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <SectionLink href={m.receivables.href} title="Customer Receivables" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-1">Total outstanding (excl. GST in margin)</p>
            <p className="text-2xl font-bold mb-4">{formatINR(m.receivables.total)}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Current</p>
                <p className="font-semibold">{formatINR(m.receivables.buckets.current)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">1–30 days overdue</p>
                <p className="font-semibold text-amber-600">{formatINR(m.receivables.buckets.d1_30)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">31–60 days</p>
                <p className="font-semibold text-orange-600">{formatINR(m.receivables.buckets.d31_60)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">61–90 days</p>
                <p className="font-semibold text-red-600">{formatINR(m.receivables.buckets.d61_90)}</p>
              </div>
              <div className="rounded-lg border p-3 col-span-2">
                <p className="text-muted-foreground">90+ days</p>
                <p className="font-semibold text-red-700">{formatINR(m.receivables.buckets.d90plus)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionLink href={m.payables.href} title="Vendor Payables" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between border-b pb-3">
              <span className="text-muted-foreground">Total vendor outstanding</span>
              <span className="font-semibold">{formatINR(m.payables.totalOutstanding)}</span>
            </div>
            <div className="flex justify-between border-b pb-3">
              <span className="text-muted-foreground">Advances outstanding</span>
              <span className="font-semibold">{formatINR(m.payables.advancesOutstanding)}</span>
            </div>
            <div className="flex justify-between border-b pb-3">
              <span className="text-muted-foreground">Balance payments pending</span>
              <span className="font-semibold">{formatINR(m.payables.balancePending)}</span>
            </div>
            <div className="flex justify-between border-b pb-3">
              <span className="text-muted-foreground">Overdue / pending settlement</span>
              <span className="font-semibold text-amber-700">{formatINR(m.payables.overdueSettlement)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TDS withheld (on payables)</span>
              <span className="font-semibold">{formatINR(m.payables.tdsWithheld)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="font-heading text-lg font-semibold text-foreground mb-4 pb-2 border-b-2 border-accent inline-block">
        Workflow Queues
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard icon={Clock} value={data.advance.pendingRequests} label="Advance — Awaiting Review" />
        <StatCard icon={CreditCard} value={data.advance.vendorAccepted} label="Advance — Vendor Accepted" />
        <StatCard icon={AlertTriangle} value={data.advance.slaBreached} label="Advance SLA Breach" />
        <StatCard icon={FileText} value={data.invoice.invoicePending} label="Invoice Tasks Pending" />
        <StatCard icon={Receipt} value={data.invoice.draftInvoices} label="Draft Invoices" />
        <StatCard icon={AlertTriangle} value={data.invoice.slaBreached} label="Invoice SLA Breach" />
        <StatCard icon={Clock} value={data.balancePayment.pending} label="Balance — Awaiting Approval" />
        <StatCard icon={CreditCard} value={data.balancePayment.processing} label="Balance — Processing" />
        <StatCard icon={AlertTriangle} value={data.balancePayment.slaBreached} label="Balance SLA Breach" />
      </div>

      <ExpandableListCard
        title="Recent Financial Transactions"
        initialCount={8}
        emptyMessage="No recent transactions."
      >
        {m.recentTransactions.map((tx) => (
          <div key={`${tx.type}-${tx.id}`} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
            <div>
              <Link href={tx.href} className="font-semibold text-primary hover:underline">
                {tx.label}
              </Link>
              <p className="text-sm text-muted-foreground mt-0.5">{tx.party}</p>
              <p className="text-xs text-muted-foreground">{formatDate(tx.occurredAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatINR(tx.amount)} {tx.currency}</p>
              <StatusBadge status={tx.status} className="mt-1" />
            </div>
          </div>
        ))}
      </ExpandableListCard>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Trip Profitability</CardTitle>
          <p className="text-sm text-muted-foreground">
            Expected margin = client rate − vendor rate (booking). Actual margin = customer cash received − vendor cash paid (excludes GST; TDS shown separately).
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Trip / LR</th>
                <th className="pb-2 pr-3 font-medium">Client</th>
                <th className="pb-2 pr-3 font-medium">Vendor</th>
                <th className="pb-2 pr-3 font-medium text-right">Revenue</th>
                <th className="pb-2 pr-3 font-medium text-right">Vendor cost</th>
                <th className="pb-2 pr-3 font-medium text-right">Charges</th>
                <th className="pb-2 pr-3 font-medium text-right">TDS</th>
                <th className="pb-2 pr-3 font-medium text-right">Expected</th>
                <th className="pb-2 font-medium text-right">Actual</th>
              </tr>
            </thead>
            <tbody>
              {m.tripProfitability.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted-foreground">
                    No completed trips in scope.
                  </td>
                </tr>
              )}
              {m.tripProfitability.map((row) => (
                <tr key={row.tripId} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <Link href={row.href} className="font-medium text-primary hover:underline">
                      {row.lrNumber}
                    </Link>
                    <StatusBadge status={row.status} className="mt-1" />
                  </td>
                  <td className="py-2 pr-3">{row.client}</td>
                  <td className="py-2 pr-3">{row.vendor}</td>
                  <td className="py-2 pr-3 text-right">{formatINR(row.revenue)}</td>
                  <td className="py-2 pr-3 text-right">{formatINR(row.vendorCost)}</td>
                  <td className="py-2 pr-3 text-right">{formatINR(row.charges)}</td>
                  <td className="py-2 pr-3 text-right">{formatINR(row.tds)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-emerald-700">
                    {formatINR(row.expectedMargin)}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {row.actualMargin != null ? formatINR(row.actualMargin) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-8">
      <ExpandableListCard
        title="Recently Created Invoices"
        initialCount={5}
        viewAllHref="/invoices"
        emptyMessage="No invoices yet."
      >
        {data.recentInvoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
            <div>
              <Link href={`/invoices/${inv.id}`} className="font-semibold text-primary hover:underline">
                {inv.invoiceNumber}
              </Link>
              <p className="text-sm text-muted-foreground mt-0.5">{inv.client}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatINR(inv.totalAmount)}</p>
              <StatusBadge status={inv.status} className="mt-1" />
            </div>
          </div>
        ))}
      </ExpandableListCard>
      </div>
    </div>
  );
}
