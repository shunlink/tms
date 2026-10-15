import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import { buildReconciliationDashboard } from "@/lib/accounting/reconciliation/reconciliation-dashboard.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ReconciliationDashboardPage() {
  await requirePagePermission("accounting.reconcile.view");
  const dash = await buildReconciliationDashboard();

  const accountReconciled =
    dash.bank.unmatchedLines === 0 &&
    dash.bank.suggestedLines === 0 &&
    dash.gateway.openExceptions === 0 &&
    dash.subledger.rowsWithDifference === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Bank, gateway, and subledger-to-GL reconciliation status"
      />
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
        {dash.dataSourceNotice}
      </p>
      <p className="text-sm text-slate-600">
        Overall account status:{" "}
        <span className={accountReconciled ? "text-green-700 font-medium" : "text-amber-800 font-medium"}>
          {accountReconciled ? "No open exceptions in summary metrics" : "Exceptions remain — drill down before period close"}
        </span>
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bank statements</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Committed imports: {dash.bank.importBatches}</p>
            <p>Unmatched lines: {dash.bank.unmatchedLines}</p>
            <p>Suggested matches: {dash.bank.suggestedLines}</p>
            <p>Matched lines: {dash.bank.matchedLines}</p>
            <p className="text-xs text-slate-500">
              Last import: {dash.bank.lastCommittedImportAt ?? "—"}
            </p>
            <Link className="text-blue-600 text-xs underline" href="/accounting/reconciliation/bank">
              Bank reconciliation →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gateway settlement</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Provider: {dash.gateway.providerId}</p>
            <p>Capability: {dash.gateway.settlementCapability}</p>
            <p>Open exceptions: {dash.gateway.openExceptions}</p>
            <p>Legacy MATCHED without evidence: {dash.gateway.insufficientEvidenceMatched}</p>
            <Link className="text-blue-600 text-xs underline" href="/accounting/reconciliation/gateway">
              Gateway reconciliation →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subledger vs GL</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>As of {dash.subledger.asOfDate}</p>
            <p>Control accounts with differences: {dash.subledger.rowsWithDifference}</p>
            <Link className="text-blue-600 text-xs underline" href="/accounting/reconciliation/subledgers">
              Subledger reconciliation →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Ambiguous bank suggestions: {dash.ambiguousMatches}</p>
            <p>Failed statement imports: {dash.failedImports}</p>
            <Link className="text-blue-600 text-xs underline" href="/accounting/periods">
              Period close validation →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
