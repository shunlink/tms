import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveVendorDisplayStatus } from "@/lib/vendor-trip-sync";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorAssignmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const indent = await prisma.indent.findFirst({
    where: { id: params.id, vendorId: user.vendorId },
    include: {
      client: { select: { name: true } },
      loading: { select: { city: true, state: true } },
      unloading: { select: { city: true, state: true } },
      consignment: { select: { vehicleTypeCode: true, weightValue: true, weightUnit: true } },
      trips: { take: 1, select: { id: true, lrNumber: true } },
    },
  });
  if (!indent) notFound();

  if (indent.trips[0]) {
    redirect(`/portal/vendor/trips/${indent.trips[0].id}`);
  }

  const displayStatus = resolveVendorDisplayStatus({
    indentStatus: indent.status,
    placementStatus: indent.placementStatus,
    kind: "indent",
  });

  return (
    <div className="max-w-3xl">
      <Link href="/portal/vendor/trips" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Assigned Trips
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{indent.indentNumber}</h2>
          <p className="text-slate-500">
            {[indent.loading?.city, indent.loading?.state].filter(Boolean).join(", ")} →{" "}
            {[indent.unloading?.city, indent.unloading?.state].filter(Boolean).join(", ")}
          </p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Client</p>
            <p className="font-medium">{indent.client.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Vehicle type</p>
            <p className="font-medium">{indent.consignment?.vehicleTypeCode?.replace(/_/g, " ") ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Allocated on</p>
            <p className="font-medium">{indent.vendorAllocatedAt ? formatDate(indent.vendorAllocatedAt) : "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">Placement</p>
            <p className="font-medium">{indent.placementStatus?.replace(/_/g, " ") ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-sm text-slate-600">
          This load is assigned to you. Trip/LR will appear here once placement is complete and operations creates the trip.
          Advance requests open after the trip is created.
        </CardContent>
      </Card>
    </div>
  );
}
