import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getVehicles } from "@/lib/queries";
import PageHeader from "@/components/page-header";

export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = {
  TEMPO_8FT: "Tempo 8ft",
  TEMPO_14FT: "Tempo 14ft",
  TRUCK_17FT: "Truck 17ft",
  TRUCK_19FT: "Truck 19ft",
  TRUCK_20FT: "Truck 20ft",
  TRUCK_22FT: "Truck 22ft",
  TRUCK_32FT_SINGLE: "32ft Single Axle",
  TRUCK_32FT_MULTI: "32ft Multi Axle",
  CONTAINER_20FT: "Container 20ft",
  CONTAINER_40FT: "Container 40ft",
  TANKER: "Tanker",
  TRAILER: "Trailer",
  OTHER: "Other",
};

const columns: DataColumn[] = [
  { key: "number", header: "Number", kind: "link", hrefPrefix: "/vehicles/" },
  { key: "type", header: "Type", kind: "badge", labels: typeLabels, tones: { UNKNOWN: "muted" } },
  { key: "owner", header: "Owner" },
  { key: "capacity", header: "Capacity" },
  { key: "insuranceExpiry", header: "Insurance Exp.", kind: "date" },
  { key: "fitnessExpiry", header: "Fitness Exp.", kind: "date" },
  { key: "pucExpiry", header: "PUC Exp.", kind: "date" },
];

export default async function VehiclesPage() {
  const vehicles = await getVehicles();

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Fleet registry and compliance"
        action={
          <Link href="/vehicles/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Vehicle
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Vehicle Fleet ({vehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={vehicles as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["number", "type", "owner", "capacity"]}
            exportName="vehicles"
            emptyText="No vehicles yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
