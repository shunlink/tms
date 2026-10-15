import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import { buildVendorStatement } from "@/lib/accounting/vendor-subledger.service";
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
];

type Params = { params: { vendorId: string } };

export default async function VendorStatementPage({ params }: Params) {
  await requirePagePermission("accounting.subledger.view");
  const statement = await buildVendorStatement({ vendorId: params.vendorId });
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
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={statement.vendorName} description="Vendor account statement" />
      <Card>
        <CardHeader>
          <CardTitle>Balances</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Opening: {formatInrMinor(statement.openingBalanceMinor)}</p>
          <p>Closing (operational subledger): {formatInrMinor(statement.closingBalanceMinor)}</p>
          <p>Operational outstanding: {formatInrMinor(statement.operationalOutstandingPayableMinor)}</p>
          <p>GL payables (2110): {formatInrMinor(statement.glPayablesBalanceMinor)}</p>
          <p>GL advances (2150): {formatInrMinor(statement.glAdvancesBalanceMinor)}</p>
          <a
            className="text-blue-600 underline text-xs"
            href={`/api/accounting/subledgers/vendors/${params.vendorId}/statement?format=csv`}
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
