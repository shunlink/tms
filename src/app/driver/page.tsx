import { redirect } from "next/navigation";
import { MapPin, Truck, Navigation } from "lucide-react";
import DriverTracking from "@/components/forms/driver-tracking";
import PodUpload from "@/components/forms/pod-upload";
import StatusBadge from "@/components/status-badge";
import { resolveTripPodUploadGate } from "@/lib/pod-upload-eligibility";
import { getSessionUser } from "@/lib/auth";
import { getDriverCurrentIndent } from "@/lib/queries";
import { driverPortalClasses } from "@/lib/driver-portal-theme";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DriverHomePage() {
  const user = await getSessionUser();
  if (!user?.driverId) redirect("/login");

  const indent = await getDriverCurrentIndent(user.driverId);
  const podUploadGate = indent?.tripId
    ? resolveTripPodUploadGate(indent.tripStatus, indent.podState ?? null)
    : { allowed: false, message: "" };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
        <div className={cn("px-5 py-3 border-b border-gray-100", driverPortalClasses.accentSoftBg)}>
          <p className={cn("text-xs font-bold uppercase tracking-wide", driverPortalClasses.accentTextMuted)}>
            Current assignment
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {!indent ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <div
                className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center mb-4 border",
                  driverPortalClasses.accentSoftBg,
                  driverPortalClasses.accentBorder
                )}
              >
                <Truck className={cn("h-8 w-8", driverPortalClasses.accentTextMuted)} />
              </div>
              <h2 className="text-xl font-bold text-gray-950">No active trip</h2>
              <p className="text-sm text-gray-600 mt-2 max-w-sm leading-relaxed">
                When a trip is assigned to you, pickup, delivery, and live GPS will show up here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-xl sm:text-2xl font-bold text-gray-950">
                    {indent.lrNumber ?? indent.indentNumber}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {indent.client}
                    {indent.lrNumber && indent.lrNumber !== indent.indentNumber ? (
                      <span className="text-gray-400"> · {indent.indentNumber}</span>
                    ) : null}
                  </p>
                </div>
                <StatusBadge status={indent.status} />
              </div>

              <div className="rounded-xl bg-[#F4F6F9] border border-gray-100 p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", driverPortalClasses.accentSoftBg)}>
                    <MapPin className={cn("h-4 w-4", driverPortalClasses.accentTextMuted)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pickup</p>
                    <p className="text-base font-medium text-gray-900 mt-0.5">{indent.pickup || "—"}</p>
                  </div>
                </div>
                <div className="border-l-2 border-dashed border-[#F5D33C]/50 ml-4 h-5" />
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-900/5 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-gray-800" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Delivery</p>
                    <p className="text-base font-medium text-gray-900 mt-0.5">{indent.delivery || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 p-4 bg-white">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Vehicle</p>
                  <p className="font-semibold text-gray-900 mt-1">{indent.vehicle || "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 bg-white">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Cargo</p>
                  <p className="font-semibold text-gray-900 mt-1">{indent.cargo || "—"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {indent && (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", driverPortalClasses.accentSoftBg)}>
              <Navigation className={cn("h-5 w-5", driverPortalClasses.accentTextMuted)} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-950">Live GPS</h2>
              <p className="text-xs text-gray-500 mt-0.5">Automatic location updates while your trip is active</p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <DriverTracking
              indentId={indent.id}
              tripId={indent.tripId}
              indentStatus={indent.status}
              tripStatus={indent.tripStatus}
              pings={indent.pings}
            />
          </div>
        </div>
      )}

      {indent?.tripId && (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-950">Proof of delivery</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload front and back photos of the signed POD for this trip.
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <PodUpload
              tripId={indent.tripId}
              alwaysCamera
              uploadEnabled={podUploadGate.allowed}
              lockedMessage={podUploadGate.message}
            />
          </div>
        </div>
      )}
    </div>
  );
}
