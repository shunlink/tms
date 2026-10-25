import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getClients } from "@/lib/queries";
import PageHeader from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/services/permission.service";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "name", header: "Name", kind: "link", hrefPrefix: "/clients/" },
  { key: "contactName", header: "Contact" },
  { key: "phone", header: "Phone" },
  { key: "gstin", header: "GSTIN" },
  { key: "paymentTerms", header: "Terms (days)", align: "right" },
  { key: "creditLimit", header: "Credit Limit", align: "right", kind: "money" },
  { key: "trips", header: "Trips", align: "right" },
  {
    key: "isActive",
    header: "Status",
    kind: "badge",
    labels: { true: "Active", false: "Inactive" },
    tones: { true: "success", false: "muted" },
  },
];

export default async function ClientsPage() {
  const user = await requirePagePermission("client.view");
  const canEdit = user.id ? await hasPermission(user.id, "client.edit") : false;
  const clients = await getClients();

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage your client companies"
        action={
          canEdit ? (
            <Link href="/clients/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Client
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={clients as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["name", "contactName", "phone", "gstin"]}
            exportName="clients"
            emptyText="No clients yet. Add your first client."
          />
        </CardContent>
      </Card>
    </div>
  );
}
