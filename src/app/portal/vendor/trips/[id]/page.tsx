import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Truck, Building2, Wallet, UserRound } from "lucide-react";
import DocumentUpload from "@/components/forms/document-upload";
import PodUpload from "@/components/forms/pod-upload";
import TripAdvancePanel from "@/components/forms/trip-advance-panel";
import { getSessionUser } from "@/lib/auth";
import { getVendorTripDetail } from "@/lib/queries";
import {
  advanceWindowClosedReason,
  getVendorTripAdvanceRequest,
  isTripAdvanceWindowOpen,
} from "@/lib/services/trip-advance.service";
import { formatINR } from "@/lib/utils";
import { resolveTripPodUploadGate } from "@/lib/pod-upload-eligibility";
import PortalTripLiveTracking from "@/components/portal/portal-trip-live-tracking";

export const dynamic = "force-dynamic";

export default async function VendorTripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const [trip, advanceRequest] = await Promise.all([
    getVendorTripDetail(user.vendorId, params.id),
    getVendorTripAdvanceRequest(user.vendorId, params.id),
  ]);
  if (!trip) notFound();

  const podUploadGate = resolveTripPodUploadGate(trip.rawStatus, trip.podState ?? null);
  const advanceWindowOpen = await isTripAdvanceWindowOpen(trip.id);
  const advanceClosedReason = advanceWindowClosedReason(trip.rawStatus);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/portal/vendor/trips"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Assigned Trips
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs">
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
          {trip.lrNumber}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">{trip.route}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</p>
            <p className="font-bold text-gray-950 text-sm mt-0.5">{trip.client}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100/60">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle</p>
            <p className="font-bold text-gray-950 text-sm mt-0.5">
              {trip.vehicle} · {trip.vehicleType.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Freight</p>
            <p className="font-bold text-gray-950 text-sm mt-0.5 tabular-nums">
              {formatINR(trip.vendorRate)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 border border-violet-100/60">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Driver</p>
            {trip.driver ? (
              <>
                <p className="font-bold text-gray-950 text-sm mt-0.5 truncate">{trip.driver.name}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{trip.driver.dlNumber}</p>
                <p className="text-xs text-gray-500 mt-0.5">{trip.driver.phone}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-0.5">Not assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Live tracking */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-950">Live tracking</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Map and driver location updates (same view as operations). Refreshes while in transit.
          </p>
        </div>
        <PortalTripLiveTracking
          tripId={trip.id}
          tripStatus={trip.rawStatus}
          fetchUrl={`/api/portal/vendor/trips/${trip.id}/tracking`}
          mapDisplayUrl={`/api/portal/vendor/trips/${trip.id}/map-display`}
          initialPing={trip.latestPing}
        />
      </div>

      {/* Advance Request Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <TripAdvancePanel
          tripId={trip.id}
          vendorRate={trip.vendorRate}
          initialRequest={advanceRequest}
          advanceWindowOpen={advanceWindowOpen}
          advanceWindowClosedReason={advanceClosedReason}
        />
      </div>

      {/* Complete POD */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-950">Complete POD</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Take a clear photo of the stamped and signed Proof of Delivery.
          </p>
        </div>
        <PodUpload
          tripId={trip.id}
          alwaysCamera
          uploadEnabled={podUploadGate.allowed}
          lockedMessage={podUploadGate.message}
        />
      </div>

      {/* Upload Documents */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-950">Upload Documents</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload e-way bill or LR for this trip. Use Complete POD above for delivery photos.
          </p>
        </div>
        <DocumentUpload
          tripId={trip.id}
          documents={trip.documents}
          allowedTypes={["EWAY_BILL", "LR"]}
          allowDelete={false}
        />
      </div>
    </div>
  );
}
