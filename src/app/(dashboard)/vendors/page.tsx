import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getVendors } from "@/lib/queries";
import PageHeader from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/services/permission.service";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "name", header: "Name", kind: "link", hrefPrefix: "/vendors/" },
  {
    key: "type",
    header: "Type",
    kind: "badge",
    labels: { FLEET_OWNER: "Fleet Owner", BROKER: "Broker" },
    tones: { FLEET_OWNER: "info", BROKER: "default" },
  },
  { key: "contactName", header: "Contact" },
  { key: "phone", header: "Phone" },
  { key: "rating", header: "Rating", align: "right" },
  { key: "vehicles", header: "Vehicles", align: "right" },
  {
    key: "isActive",
    header: "Status",
    kind: "badge",
    labels: { true: "Active", false: "Inactive" },
    tones: { true: "success", false: "muted" },
  },
];

export default async function VendorsPage() {
  const user = await requirePagePermission("vendor.view");
  const canEdit = user.id ? await hasPermission(user.id, "vendor.edit") : false;
  const vendors = await getVendors();

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Manage transporters and fleet partners"
        action={
          canEdit ? (
            <Link href="/vendors/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Vendor
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Vendors ({vendors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={vendors as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["name", "contactName", "phone", "type"]}
            exportName="vendors"
            emptyText="No vendors yet. Add your first vendor."
          />
        </CardContent>
      </Card>
    </div>
  );
}
