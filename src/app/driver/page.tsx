import { redirect } from "next/navigation";
import { MapPin, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DriverTracking from "@/components/forms/driver-tracking";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import { getSessionUser } from "@/lib/auth";
import { getDriverCurrentIndent } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DriverHomePage() {
  const user = await getSessionUser();
  if (!user?.driverId) redirect("/login");

  const indent = await getDriverCurrentIndent(user.driverId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Current Trip"
        description="Your active assignment"
      />

      {!indent ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Truck}
              title="No active trip"
              description="When a trip is assigned to you, it will appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-xl font-bold text-foreground">{indent.indentNumber}</p>
                <p className="text-base text-muted-foreground mt-1">{indent.client}</p>
              </div>
              <StatusBadge status={indent.status} />
            </div>

            <div className="rounded-xl bg-muted/60 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Pickup</p>
                  <p className="text-base font-medium mt-0.5">{indent.pickup || "—"}</p>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-border ml-2 h-4" />
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Delivery</p>
                  <p className="text-base font-medium mt-0.5">{indent.delivery || "—"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Vehicle</p>
                <p className="text-base font-medium mt-1">{indent.vehicle || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Cargo</p>
                <p className="text-base font-medium mt-1">{indent.cargo || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {indent && (
        <Card>
          <CardHeader>
            <CardTitle>Live GPS (automatic)</CardTitle>
          </CardHeader>
          <CardContent>
            <DriverTracking
              indentId={indent.id}
              indentStatus={indent.status}
              tripStatus={indent.tripStatus}
              pings={indent.pings}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
