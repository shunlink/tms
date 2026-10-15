import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { getChartOfAccountById } from "@/lib/accounting/chart-of-accounts.service";
import { requirePagePermission } from "@/lib/page-auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission("accounting.coa.view");
  const account = await getChartOfAccountById(params.id);
  if (!account) notFound();

  return (
    <div>
      <PageHeader
        title={`${account.code} — ${account.name}`}
        description={account.description ?? account.accountType}
      />
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-slate-500">Type:</span> {account.accountType}</p>
          <p><span className="text-slate-500">Normal balance:</span> {account.normalBalance}</p>
          <p>
            <span className="text-slate-500">Status:</span>{" "}
            <StatusBadge status={account.isActive ? "ACTIVE" : "INACTIVE"} />
          </p>
          <p><span className="text-slate-500">Manual posting:</span> {account.manualPostingAllowed ? "Allowed" : "Restricted"}</p>
          <p><span className="text-slate-500">System account:</span> {account.isSystem ? "Yes" : "No"}</p>
          <Link href="/accounting/chart-of-accounts" className="text-blue-600 text-sm hover:underline">
            ← Back to chart
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
