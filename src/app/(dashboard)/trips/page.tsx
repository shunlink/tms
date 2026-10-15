import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LayoutGrid } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getTrips } from "@/lib/queries";
import PageHeader from "@/components/page-header";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  POD_RECEIVED: "POD Received",
  INVOICED: "Invoiced",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  PENDING: "muted",
  DISPATCHED: "info",
  IN_TRANSIT: "info",
  DELIVERED: "success",
  POD_RECEIVED: "warning",
  INVOICED: "default",
  CLOSED: "muted",
  CANCELLED: "danger",
};

const columns: DataColumn[] = [
  { key: "lrNumber", header: "LR No.", kind: "link", hrefPrefix: "/trips/" },
  { key: "route", header: "Route" },
  { key: "client", header: "Client" },
  { key: "vendor", header: "Vendor" },
  { key: "vehicle", header: "Vehicle" },
  { key: "clientRate", header: "Client Rate", align: "right", kind: "money" },
  { key: "vendorRate", header: "Vendor Rate", align: "right", kind: "money" },
  { key: "margin", header: "Margin", align: "right", kind: "money" },
  { key: "status", header: "Status", kind: "badge", labels: statusLabels, tones: statusTones },
];

export default async function TripsPage() {
  const trips = await getTrips();

  return (
    <div>
      <PageHeader
        title="Trips"
        description="Active and completed shipments"
        action={
          <Link href="/trips/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Trip
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Trips ({trips.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={trips as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["lrNumber", "route", "client", "vendor", "vehicle", "status"]}
            exportName="trips"
            emptyText="No trips yet. Create your first trip."
          />
        </CardContent>
      </Card>
    </div>
  );
}
