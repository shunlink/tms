import {
  requireAuth,
  forbidden,
  notFound,
  unauthorized,
  serverError,
} from "@/lib/api";
import {
  ensureTripDriverId,
  resolveDriverAccessibleTrip,
} from "@/lib/services/driver.service";
import { uploadTripPodFromMultipart } from "@/lib/services/trip-pod-document-upload.service";

export const runtime = "nodejs";

/** Prefer URL segment — some POST/multipart requests do not populate `params.tripId` reliably. */
function tripIdFromRequest(req: Request, params: { tripId?: string }) {
  const fromPath = new URL(req.url).pathname.match(/\/api\/drivers\/me\/trips\/([^/]+)\/pod\/?$/i)?.[1];
  const fromParams = params.tripId?.trim();
  const id = (fromPath ?? fromParams ?? "").trim();
  if (id === "pod" || id === "[tripId]") return fromPath?.trim() ?? "";
  return id;
}

/** Driver mobile — upload front/back POD for a trip assigned to the signed-in driver. */
export async function POST(req: Request, { params }: { params: { tripId: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER" || !auth.user.driverId) {
    return forbidden("Sign in with your driver account to upload POD.");
  }

  const tripKey = tripIdFromRequest(req, params);
  if (!tripKey) return notFound("Trip not found");

  try {
    const trip = await resolveDriverAccessibleTrip(auth.user.driverId, tripKey);
    if (!trip) return notFound("Trip not found");

    await ensureTripDriverId(trip.id, auth.user.driverId);

    const formData = await req.formData();
    return await uploadTripPodFromMultipart(trip, auth.user, formData);
  } catch (e) {
    return serverError(e);
  }
}
