import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import GatewaySettlementImportForm from "@/components/accounting/gateway-settlement-import-form";
import { prisma } from "@/lib/prisma";
import { paymentProviderId } from "@/lib/payments/config";
import { requirePagePermission } from "@/lib/page-auth";
import { formatInrMinor } from "@/components/accounting/money-cells";

export const dynamic = "force-dynamic";

export default async function GatewayReconciliationPage() {
  await requirePagePermission("accounting.reconcile.view");
  const provider = paymentProviderId();
  const records = await prisma.reconciliationRecord.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gateway settlement reconciliation"
        description="Compare outbound payments to provider settlement evidence"
      />
      {provider === "none" ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
          Gateway provider is not configured. Settlement reconciliation is BLOCKED for live provider data;
          you may import provider settlement CSV reports when available.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Provider: {provider}. Live settlement batch API is not exposed by the gateway adapter — use CSV
          settlement import.
        </p>
      )}

      <GatewaySettlementImportForm disabled={provider === "none"} />

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation records</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {records.map((r) => (
            <div key={r.id} className="border rounded p-2 text-xs">
              <span className="font-medium">{r.status}</span>
              {r.insufficientEvidence && <span className="text-amber-700"> · evidence review</span>}
              {" · "}
              {r.providerTransferRef ?? "—"} · internal{" "}
              {r.internalAmountMinor != null ? formatInrMinor(r.internalAmountMinor) : "—"} · provider{" "}
              {r.providerAmountMinor != null ? formatInrMinor(r.providerAmountMinor) : "—"}
              {r.discrepancyType && ` · ${r.discrepancyType}`}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
