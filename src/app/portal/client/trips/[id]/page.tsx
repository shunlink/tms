import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Truck, Building2, MapPin } from "lucide-react";
import PortalPage from "@/components/portal/portal-page";
import PortalTripLiveTracking from "@/components/portal/portal-trip-live-tracking";
import { getSessionUser } from "@/lib/auth";
import { getClientTripDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientTripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const trip = await getClientTripDetail(user.clientId, params.id);
  if (!trip) notFound();

  return (
    <PortalPage>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/portal/client/trips"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Shipments
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            {trip.lrNumber || `Shipment ${trip.id.slice(-6)}`}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{trip.route}</p>
          <span
            className="inline-flex mt-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200"
          >
            {trip.displayStatus}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100/60">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle</p>
              <p className="font-bold text-gray-950 text-sm mt-0.5 font-mono">{trip.vehicle}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transporter</p>
              <p className="font-bold text-gray-950 text-sm mt-0.5">{trip.vendor}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-950">Live tracking</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Track your shipment on the map. Location updates when the driver shares GPS.
              </p>
            </div>
          </div>
          <PortalTripLiveTracking
            tripId={trip.id}
            tripStatus={trip.status}
            fetchUrl={`/api/portal/client/trips/${trip.id}/tracking`}
            mapDisplayUrl={`/api/portal/client/trips/${trip.id}/map-display`}
            initialPing={trip.latestPing}
          />
        </div>

        {trip.invoice && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoice</p>
            <Link
              href={`/portal/client/invoices/${trip.invoice.id}`}
              className="text-sm font-bold text-blue-600 hover:underline mt-1 inline-block"
            >
              {trip.invoice.invoiceNumber}
            </Link>
          </div>
        )}
      </div>
    </PortalPage>
  );
}
