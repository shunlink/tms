import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import ReceivablesFilters from "@/components/receivables/receivables-filters";
import ReceivablesTable from "@/components/receivables/receivables-table";
import { requirePagePermission } from "@/lib/page-auth";
import {
  getReceivablesFilterOptions,
  getReceivablesSummary,
  listReceivablesPaginated,
  parseReceivablesFilters,
  parseReceivablesSort,
} from "@/lib/services/receivables.service";
import { formatINR } from "@/lib/utils";
import { AlertTriangle, Calendar, Clock, FileText, IndianRupee } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReceivablesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("invoice.view");

  const filters = parseReceivablesFilters(searchParams);
  const sort = parseReceivablesSort(searchParams);

  const [summary, data, filterOptions] = await Promise.all([
    getReceivablesSummary(filters),
    listReceivablesPaginated(filters, searchParams, sort),
    getReceivablesFilterOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Customer Receivables"
        description="Outstanding balances by invoice age; Total Overdue is past the payment due date (not cash collected in a period)."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard icon={IndianRupee} value={formatINR(summary.total)} label="Total Receivables" />
        <StatCard icon={Calendar} value={formatINR(summary.buckets.d0_30)} label="0–30 days outstanding" />
        <StatCard icon={Clock} value={formatINR(summary.buckets.d31_60)} label="31–60 days outstanding" className="text-amber-700" />
        <StatCard icon={Clock} value={formatINR(summary.buckets.d61_90)} label="61–90 days outstanding" className="text-orange-700" />
        <StatCard icon={AlertTriangle} value={formatINR(summary.buckets.d90plus)} label="90+ days outstanding" className="text-red-700" />
        <StatCard icon={FileText} value={formatINR(summary.totalOverdue)} label="Total Overdue (past due)" className="text-red-600" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
            <ReceivablesFilters clients={filterOptions.clients} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices ({data.total})</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
            <ReceivablesTable data={data} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
