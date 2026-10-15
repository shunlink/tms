import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type DataColumn } from "@/components/data-table";
import PageHeader from "@/components/page-header";
import { formatInrMinor } from "@/components/accounting/money-cells";
import { listVendorSubledgerSummaries } from "@/lib/accounting/vendor-subledger.service";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "vendorName", header: "Vendor", kind: "link", hrefPrefix: "/accounting/subledgers/vendors/", idKey: "vendorId" },
  { key: "operational", header: "Operational outstanding" },
  { key: "glPayables", header: "GL payables (2110)" },
];

export default async function VendorSubledgersPage() {
  await requirePagePermission("accounting.subledger.view");
  const { items } = await listVendorSubledgerSummaries({ limit: 100 });

  const rows = items.map((v) => ({
    id: v.vendorId,
    vendorId: v.vendorId,
    vendorName: v.vendorName,
    operational: formatInrMinor(v.operationalOutstandingMinor),
    glPayables: formatInrMinor(v.glPayablesBalanceMinor),
  }));

  return (
    <div>
      <PageHeader
        title="Vendor subledgers"
        description="Operational payables vs posted GL balances by vendor"
      />
      <Card>
        <CardHeader>
          <CardTitle>Vendors ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} searchKeys={["vendorName"]} />
        </CardContent>
      </Card>
    </div>
  );
}
