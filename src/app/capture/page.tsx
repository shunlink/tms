import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import CameraCapture from "@/components/forms/camera-capture";
import PodUpload from "@/components/forms/pod-upload";
import { getSessionUser } from "@/lib/auth";
import { getTripForCapture } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["POD", "EWAY_BILL", "LR", "OTHER"];

export default async function CapturePage({
  searchParams,
}: {
  searchParams: { tripId?: string; type?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tripId = searchParams.tripId;
  const type = ALLOWED_TYPES.includes(searchParams.type ?? "") ? searchParams.type! : "POD";

  if (!tripId) notFound();
  const trip = await getTripForCapture(user, tripId);
  if (!trip) notFound();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Capture {type.replace(/_/g, " ")}
            </h1>
            <p className="text-sm text-slate-500">
              {trip.lrNumber} · {trip.route}
            </p>
          </div>
          {type === "POD" ? (
            <PodUpload tripId={trip.id} alwaysCamera />
          ) : (
            <CameraCapture tripId={trip.id} docType={type} alwaysCamera />
          )}
        </div>
      </div>
    </div>
  );
}
