import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import { listClientSubledgerSummaries } from "@/lib/accounting/client-subledger.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "clientName", header: "Client", kind: "link", hrefPrefix: "/accounting/subledgers/clients/", idKey: "clientId" },
  { key: "operational", header: "Invoice outstanding" },
  { key: "glReceivables", header: "GL AR (1200)" },
];

export default async function ClientSubledgersPage() {
  await requirePagePermission("accounting.subledger.view");
  const { items } = await listClientSubledgerSummaries({ limit: 100 });

  const rows = items.map((c) => ({
    id: c.clientId,
    clientId: c.clientId,
    clientName: c.clientName,
    operational: formatInrMinor(c.operationalReceivablesMinor),
    glReceivables: formatInrMinor(c.glReceivablesBalanceMinor),
  }));

  return (
    <div>
      <PageHeader
        title="Client receivables subledgers"
        description="Invoice outstanding vs posted AR control by client"
      />
      <Card>
        <CardHeader>
          <CardTitle>Clients ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} searchKeys={["clientName"]} />
        </CardContent>
      </Card>
    </div>
  );
}
