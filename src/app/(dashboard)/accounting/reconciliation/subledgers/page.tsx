import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import { buildSubledgerReconciliationReport } from "@/lib/accounting/subledger-reconciliation.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function SubledgerReconciliationPage() {
  await requirePagePermission("accounting.reconcile.view");
  const report = await buildSubledgerReconciliationReport({ asOfDate: new Date() });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subledger reconciliation"
        description="Compare operational subledgers to posted GL control accounts"
      />
      <p className="text-xs text-slate-500">As of {report.asOfDate} · {report.currency}</p>
      {report.rows.map((row) => (
        <Card key={row.controlAccountCode}>
          <CardHeader>
            <CardTitle>
              {row.controlAccountCode} — {row.controlAccountName}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>{row.subledgerLabel}</p>
            <p>Subledger total: {formatInrMinor(row.subledgerTotalMinor)}</p>
            <p>GL control balance: {formatInrMinor(row.glControlBalanceMinor)}</p>
            <p className={row.differenceMinor === 0 ? "text-green-700" : "text-amber-800"}>
              Difference: {formatInrMinor(row.differenceMinor)}
            </p>
            {row.limitation && <p className="text-xs text-slate-500">{row.limitation}</p>}
            {row.details.length > 0 && (
              <ul className="text-xs list-disc pl-4">
                {row.details.slice(0, 20).map((d) => (
                  <li key={d.entityId}>
                    {d.entityName}: subledger {formatInrMinor(d.subledgerMinor)} vs GL{" "}
                    {formatInrMinor(d.glMinor)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
