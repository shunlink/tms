import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { ensureChartOfAccounts, listChartOfAccounts } from "@/lib/accounting/chart-of-accounts.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "code", header: "Code", kind: "link", hrefPrefix: "/accounting/chart-of-accounts/" },
  { key: "name", header: "Name" },
  { key: "accountType", header: "Type" },
  { key: "normalBalance", header: "Normal" },
  { key: "parentCode", header: "Parent" },
  { key: "isActive", header: "Active", kind: "badge", tones: { true: "success", false: "muted" } },
  { key: "manualPostingAllowed", header: "Manual OK" },
];

export default async function ChartOfAccountsPage() {
  await requirePagePermission("accounting.coa.view");
  await ensureChartOfAccounts();
  const accounts = await listChartOfAccounts();

  const rows = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    accountType: a.accountType,
    normalBalance: a.normalBalance,
    parentCode: a.parent?.code ?? "—",
    isActive: a.isActive ? "true" : "false",
    manualPostingAllowed: a.manualPostingAllowed ? "Yes" : "No",
  }));

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        description="Finance starter chart — classification by account type, not name matching"
      />
      <Card>
        <CardHeader>
          <CardTitle>Accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} />
          <p className="text-xs text-slate-500 mt-4">
            System accounts and inactive tax control (2200) are managed by finance configuration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
