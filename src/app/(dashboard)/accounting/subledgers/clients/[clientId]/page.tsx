import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import { buildClientStatement } from "@/lib/accounting/client-subledger.service";
import { requirePagePermission } from "@/lib/page-auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "effectiveDate", header: "Date", kind: "date" },
  { key: "documentType", header: "Type" },
  { key: "reference", header: "Reference" },
  { key: "description", header: "Description" },
  { key: "debit", header: "Debit" },
  { key: "credit", header: "Credit" },
  { key: "balance", header: "Balance" },
  { key: "allocation", header: "Allocation" },
];

type Params = { params: { clientId: string } };

export default async function ClientStatementPage({ params }: Params) {
  await requirePagePermission("accounting.subledger.view");
  const statement = await buildClientStatement({ clientId: params.clientId });
  if (!statement) notFound();

  const rows = statement.lines.map((l) => ({
    id: l.id,
    effectiveDate: l.effectiveDate,
    documentType: l.documentType,
    reference: l.reference,
    description: l.description,
    debit: l.debitMinor ? formatInrMinor(l.debitMinor) : "—",
    credit: l.creditMinor ? formatInrMinor(l.creditMinor) : "—",
    balance: formatInrMinor(l.runningBalanceMinor),
    allocation: l.allocationStatus ?? "—",
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={statement.clientName} description="Client receivables statement" />
      <Card>
        <CardHeader>
          <CardTitle>Balances</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Opening: {formatInrMinor(statement.openingBalanceMinor)}</p>
          <p>Closing (subledger): {formatInrMinor(statement.closingBalanceMinor)}</p>
          <p>Operational receivables: {formatInrMinor(statement.operationalReceivablesMinor)}</p>
          <p>Unallocated receipts: {formatInrMinor(statement.unallocatedReceiptsMinor)}</p>
          <p>GL receivables (1200): {formatInrMinor(statement.glReceivablesBalanceMinor)}</p>
          <a
            className="text-blue-600 underline text-xs"
            href={`/api/accounting/subledgers/clients/${params.clientId}/statement?format=csv`}
          >
            Export CSV
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} pageSize={25} />
        </CardContent>
      </Card>
    </div>
  );
}
