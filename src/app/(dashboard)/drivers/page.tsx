import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { getDrivers } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const drivers = await getDrivers();

  return (
    <div>
      <PageHeader
        title="Drivers"
        description="Driver records and assignments"
        action={
          <Link href="/drivers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Driver
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Drivers ({drivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Phone</th>
                  <th className="pb-3 font-medium">DL Number</th>
                  <th className="pb-3 font-medium">Device</th>
                  <th className="pb-3 font-medium">OTP</th>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium text-right">Trips</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No drivers yet.
                    </td>
                  </tr>
                )}
                {drivers.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-3 font-medium text-card-foreground">{d.name}</td>
                    <td className="py-3">{d.phone}</td>
                    <td className="py-3">
                      <div>{d.dlNumber ?? "—"}</div>
                      {d.dlExpiry && (
                        <div className="text-xs text-muted-foreground">
                          Exp {formatDate(d.dlExpiry)}
                        </div>
                      )}
                    </td>
                    <td className="py-3">{d.deviceType?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="py-3">
                      {d.otpVerified ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3">{d.city ?? "—"}</td>
                    <td className="py-3 text-right">{d.trips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
