import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getRequirements } from "@/lib/queries";
import PageHeader from "@/components/page-header";

export const dynamic = "force-dynamic";

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  OPEN: "warning",
  PARTIALLY_ALLOCATED: "info",
  FULLY_ALLOCATED: "success",
  CANCELLED: "danger",
  COMPLETED: "muted",
};

const columns: DataColumn[] = [
  { key: "reqNumber", header: "Req No.", kind: "link", hrefPrefix: "/requirements/" },
  { key: "client", header: "Client" },
  { key: "route", header: "Route" },
  { key: "vehicleType", header: "Vehicle Type" },
  { key: "allocated", header: "Allocated", align: "right" },
  { key: "expectedDate", header: "Expected", kind: "date" },
  { key: "clientRate", header: "Client Rate", align: "right", kind: "money" },
  { key: "status", header: "Status", kind: "badge", tones: statusTones },
];

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams?: { source?: string };
}) {
  const source = searchParams?.source;
  const requirements = await getRequirements(source ? { source } : undefined);
  const title = source === "PORTAL" ? "Client-Raised Requirements" : "Requirements";
  const description =
    source === "PORTAL"
      ? "Requirements submitted by clients through the portal"
      : "Client load requirements";

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={
          <Link href="/requirements/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Requirement
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {source === "PORTAL" ? "Client-Raised" : "All"} Requirements ({requirements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={requirements as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["reqNumber", "client", "route", "vehicleType", "status"]}
            exportName="requirements"
            emptyText="No requirements yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
