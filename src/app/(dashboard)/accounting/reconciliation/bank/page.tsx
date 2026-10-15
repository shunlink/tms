import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import BankStatementImportForm from "@/components/accounting/bank-statement-import-form";
import { listBankReconciliationItems } from "@/lib/accounting/reconciliation/bank-reconciliation.service";
import { listBankStatementImports } from "@/lib/accounting/reconciliation/bank-statement-import.service";
import { requirePagePermission } from "@/lib/page-auth";
import { formatInrMinor } from "@/components/accounting/money-cells";

export const dynamic = "force-dynamic";

export default async function BankReconciliationPage() {
  await requirePagePermission("accounting.reconcile.bank.view");
  const [imports, lines] = await Promise.all([
    listBankStatementImports({ limit: 20 }),
    listBankReconciliationItems({ glAccountCode: "1010", limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank reconciliation"
        description="Match imported statement lines to posted bank/cash journals and payments"
      />
      <BankStatementImportForm />

      <Card>
        <CardHeader>
          <CardTitle>Import history</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {imports.length === 0 && <p className="text-slate-500">No imports yet.</p>}
          {imports.map((imp) => (
            <div key={imp.id} className="border rounded p-2 text-xs">
              {imp.fileName ?? imp.id} · {imp.status} · {imp.rowCount} rows · {imp.glAccountCode}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statement lines (1010)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {lines.length === 0 && <p className="text-slate-500">No statement lines.</p>}
          {lines.map((line) => (
            <div key={line.id} className="border rounded p-2 text-xs flex justify-between gap-2">
              <span>
                {line.transactionDate.toISOString().slice(0, 10)} · {line.reconStatus} ·{" "}
                {line.description ?? line.externalReference ?? "—"}
              </span>
              <span>
                {line.direction} {formatInrMinor(line.amountMinor)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
