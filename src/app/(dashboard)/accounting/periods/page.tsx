import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import {
  ensureDefaultAccountingPeriods,
  listAccountingPeriods,
} from "@/lib/accounting/accounting-period.service";
import { requirePagePermission } from "@/lib/page-auth";
import AccountingPeriodActions from "./period-actions";

export const dynamic = "force-dynamic";

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  OPEN: "success",
  UNDER_REVIEW: "warning",
  CLOSED: "muted",
};

const columns: DataColumn[] = [
  { key: "name", header: "Period" },
  { key: "startDate", header: "Start", kind: "date" },
  { key: "endDate", header: "End", kind: "date" },
  { key: "status", header: "Status", kind: "badge", tones: statusTones },
];

export default async function AccountingPeriodsPage() {
  await requirePagePermission("accounting.period.view");
  await ensureDefaultAccountingPeriods();
  const periods = await listAccountingPeriods();

  const rows = periods.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
  }));

  return (
    <div>
      <PageHeader
        title="Accounting Periods"
        description="Posting is blocked into closed periods"
      />
      <Card>
        <CardHeader>
          <CardTitle>Periods ({periods.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} />
          <AccountingPeriodActions periods={periods.map((p) => ({ id: p.id, name: p.name, status: p.status }))} />
        </CardContent>
      </Card>
    </div>
  );
}
