import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import PayablesFilters from "@/components/payables/payables-filters";
import PayablesTable from "@/components/payables/payables-table";
import { requirePagePermission } from "@/lib/page-auth";
import {
  getPayablesFilterOptions,
  getPayablesSummary,
  listPayablesPaginated,
  parsePayablesFilters,
  parsePayablesSort,
} from "@/lib/services/payables.service";
import { formatINR } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  IndianRupee,
  Receipt,
  Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PayablesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("payment.view");

  const filters = parsePayablesFilters(searchParams);
  const sort = parsePayablesSort(searchParams);

  const [summary, data, filterOptions] = await Promise.all([
    getPayablesSummary(filters),
    listPayablesPaginated(filters, searchParams, sort),
    getPayablesFilterOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Vendor Payables"
        description="Outstanding vendor settlements — gross payable, TDS withheld, net cash due, and ageing"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
        <StatCard icon={Wallet} value={formatINR(summary.totalOutstanding)} label="Total Vendor Payables" />
        <StatCard icon={CreditCard} value={formatINR(summary.advancesOutstanding)} label="Advances Outstanding" />
        <StatCard icon={IndianRupee} value={formatINR(summary.balancePending)} label="Balance Payables" />
        <StatCard
          icon={AlertTriangle}
          value={formatINR(summary.dueActionRequired)}
          label="Due / Action Required"
          className="text-amber-700"
        />
        <StatCard icon={Receipt} value={formatINR(summary.tdsToWithhold)} label="TDS to Withhold" />
        <StatCard icon={Building2} value={String(summary.vendorsWithOutstanding)} label="Vendors With Dues" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Calendar} value={formatINR(summary.buckets.current)} label="Current" />
        <StatCard icon={Clock} value={formatINR(summary.buckets.d1_30)} label="1–30 Days" className="text-amber-700" />
        <StatCard icon={Clock} value={formatINR(summary.buckets.d31_60)} label="31–60 Days" className="text-orange-700" />
        <StatCard icon={Clock} value={formatINR(summary.buckets.d61_90)} label="61–90 Days" className="text-red-600" />
        <StatCard icon={AlertTriangle} value={formatINR(summary.buckets.d90plus)} label="90+ Days" className="text-red-700" />
      </div>

      <p className="text-xs text-muted-foreground mb-4">{summary.ageingLabel}</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
            <PayablesFilters vendors={filterOptions.vendors} clients={filterOptions.clients} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Payables ({data.total})</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
            <PayablesTable data={data} ageingLabel={summary.ageingLabel} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
