import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Truck, Calendar, Clock } from "lucide-react";
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
  if (!user?.vendorId) redirect("/login?portal=transporter");

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
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/portal/vendor/trips"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Assigned Trips
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            {indent.indentNumber}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {[indent.loading?.city, indent.loading?.state].filter(Boolean).join(", ")} →{" "}
            {[indent.unloading?.city, indent.unloading?.state].filter(Boolean).join(", ")}
          </p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-950 border-b border-gray-100 pb-3">
          Assignment Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3 w-3" /> Client
            </p>
            <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">{indent.client.name}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-3 w-3" /> Vehicle Type
            </p>
            <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">
              {indent.consignment?.vehicleTypeCode?.replace(/_/g, " ") ?? "—"}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Allocated On
            </p>
            <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">
              {indent.vendorAllocatedAt ? formatDate(indent.vendorAllocatedAt) : "—"}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Placement
            </p>
            <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">
              {indent.placementStatus?.replace(/_/g, " ") ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/70 border border-blue-200/70 rounded-2xl p-5 text-xs sm:text-sm text-blue-900 leading-relaxed">
        This load is assigned to your fleet. Once vehicle placement is confirmed and operations creates the official Trip & LR, you will be able to submit PODs and request advances right from your portal.
      </div>
    </div>
  );
}
