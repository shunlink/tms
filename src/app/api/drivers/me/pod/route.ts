import {
  requireAuth,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  serverError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  ensureTripDriverId,
  getDriverIdForAuthUser,
  getDriverMeTripDetail,
} from "@/lib/services/driver.service";
import { uploadTripPodFromMultipart } from "@/lib/services/trip-pod-document-upload.service";

export const runtime = "nodejs";

function tripKeyFromRequest(req: Request, formData: FormData): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("tripId") ?? url.searchParams.get("trip_id") ?? "";
  const fromForm = String(formData.get("tripId") ?? formData.get("trip_id") ?? "");
  return (fromQuery.trim() || fromForm.trim());
}

/**
 * Driver POD upload — trip id in multipart (`tripId` field).
 * Avoids dynamic `[tripId]` route params, which are unreliable on multipart POST in App Router.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER") {
    return forbidden("Sign in with your driver account to upload POD.");
  }

  const driverId = await getDriverIdForAuthUser(auth.user);
  if (!driverId) {
    return forbidden("Your account is not linked to a driver profile. Contact dispatch.");
  }

  try {
    const formData = await req.formData();
    const tripKey = tripKeyFromRequest(req, formData);
    if (!tripKey) return badRequest("tripId is required");

    const detail = await getDriverMeTripDetail(driverId, tripKey);
    if (!detail) {
      const row = await prisma.trip.findFirst({
        where: { OR: [{ id: tripKey }, { indentId: tripKey }] },
        select: { id: true, driverId: true },
      });
      if (row) {
        return forbidden(
          row.driverId && row.driverId !== driverId
            ? "This trip is assigned to another driver. Sign in with the driver account linked to this trip."
            : "This trip is not assigned to you"
        );
      }
      return notFound("Trip not found");
    }

    const trip = await prisma.trip.findFirst({
      where: { id: detail.tripId },
      select: { id: true, status: true, indentId: true },
    });
    if (!trip) return notFound("Trip not found");

    await ensureTripDriverId(trip.id, driverId);
    return await uploadTripPodFromMultipart(trip, auth.user, formData);
  } catch (e) {
    return serverError(e);
  }
}
