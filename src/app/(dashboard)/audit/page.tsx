import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AuditFilters from "@/components/audit/audit-filters";
import AuditLogTable from "@/components/audit/audit-log-table";
import PageHeader from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-auth";
import { getAuditFilterOptions, getAuditLogs } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = {
  userId?: string;
  teamCode?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  tripId?: string;
  from?: string;
  to?: string;
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("audit.view");

  const filters = {
    userId: searchParams.userId,
    teamCode: searchParams.teamCode,
    action: searchParams.action,
    entity: searchParams.entity,
    entityId: searchParams.entityId,
    tripId: searchParams.tripId,
    from: parseDate(searchParams.from),
    to: parseDate(searchParams.to),
    limit: 200,
  };

  const [logs, filterOptions] = await Promise.all([
    getAuditLogs(filters),
    getAuditFilterOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Employee Activity Log"
        description="Append-only audit trail of employee actions across finance, operations, sales, and admin"
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
            <AuditFilters
              employees={filterOptions.employees}
              teams={filterOptions.teams}
              actions={filterOptions.actions}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditLogTable rows={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
