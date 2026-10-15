import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentUpload from "@/components/forms/document-upload";
import PodUpload from "@/components/forms/pod-upload";
import TripAdvancePanel from "@/components/forms/trip-advance-panel";
import { getSessionUser } from "@/lib/auth";
import { getVendorTripDetail } from "@/lib/queries";
import { getVendorTripAdvanceRequest } from "@/lib/services/trip-advance.service";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorTripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const [trip, advanceRequest] = await Promise.all([
    getVendorTripDetail(user.vendorId, params.id),
    getVendorTripAdvanceRequest(user.vendorId, params.id),
  ]);
  if (!trip) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/portal/vendor/trips" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Trips
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{trip.lrNumber}</h2>
        <p className="text-slate-500">{trip.route}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm">
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Client</p>
            <p className="font-medium text-slate-900">{trip.client}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Vehicle</p>
            <p className="font-medium text-slate-900">
              {trip.vehicle} · {trip.vehicleType.replace(/_/g, " ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500">Your Freight</p>
            <p className="font-medium text-slate-900">{formatINR(trip.vendorRate)}</p>
          </CardContent>
        </Card>
      </div>

      <TripAdvancePanel
        tripId={trip.id}
        vendorRate={trip.vendorRate}
        initialRequest={advanceRequest}
      />

      <Card>
        <CardHeader>
          <CardTitle>Complete POD</CardTitle>
        </CardHeader>
        <CardContent>
          <PodUpload tripId={trip.id} alwaysCamera />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Upload the POD, e-way bill or LR for this trip.
          </p>
          <DocumentUpload
            tripId={trip.id}
            documents={trip.documents}
            allowedTypes={["POD", "EWAY_BILL", "LR"]}
            allowDelete={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
