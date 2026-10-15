import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LayoutGrid } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getIndents } from "@/lib/queries";
import PageHeader from "@/components/page-header";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  WAITING_FOR_ADVANCE: "Waiting for Advance",
  ADVANCE_PENDING: "Advance Pending",
  ADVANCE_PAID: "Advance Paid",
  RELEASED_TO_VENDORS: "Released to Vendors",
  QUOTING: "Quoting",
  VENDOR_ALLOCATED: "Vendor Allocated",
  PLACEMENT_PENDING: "Placement Pending",
  VEHICLE_PLACED: "Vehicle Placed",
  DRIVER_ASSIGNED: "Driver Assigned",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  POD_PENDING: "POD Pending",
  POD_RECEIVED: "POD Received",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  DRAFT: "muted",
  WAITING_FOR_ADVANCE: "warning",
  ADVANCE_PENDING: "warning",
  ADVANCE_PAID: "info",
  RELEASED_TO_VENDORS: "info",
  QUOTING: "info",
  VENDOR_ALLOCATED: "default",
  PLACEMENT_PENDING: "warning",
  VEHICLE_PLACED: "default",
  DRIVER_ASSIGNED: "default",
  IN_TRANSIT: "info",
  DELIVERED: "default",
  POD_PENDING: "warning",
  POD_RECEIVED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const columns: DataColumn[] = [
  { key: "indentNumber", header: "Indent No.", kind: "link", hrefPrefix: "/indents/" },
  { key: "client", header: "Client" },
  { key: "route", header: "Route" },
  { key: "vehicleType", header: "Vehicle" },
  { key: "quantity", header: "Qty", align: "right" },
  { key: "pickupDate", header: "Pickup", kind: "date" },
  { key: "clientRate", header: "Client Rate", align: "right", kind: "money" },
  { key: "vendorRate", header: "Vendor Rate", align: "right", kind: "money" },
  { key: "vendor", header: "Vendor" },
  { key: "status", header: "Status", kind: "badge", labels: statusLabels, tones: statusTones },
];

export default async function IndentsPage() {
  const indents = await getIndents();

  return (
    <div>
      <PageHeader
        title="Indents"
        description="Load requests and vendor allocation"
        action={
          <Link href="/indents/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Indent
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Indents ({indents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={indents as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["indentNumber", "client", "route", "vendor", "status"]}
            exportName="indents"
            emptyText="No indents yet. Create your first indent."
          />
        </CardContent>
      </Card>
    </div>
  );
}
