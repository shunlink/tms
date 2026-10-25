import { requireAuth, ok, notFound, unauthorized, serverError } from "@/lib/api";
import { getTripForVendor, listTripTrackingPings } from "@/lib/services/tracking.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!auth.user.vendorId) return unauthorized();

  try {
    const trip = await getTripForVendor(auth.user.vendorId, params.id);
    if (!trip) return notFound("Trip not found");

    const pings = await listTripTrackingPings(params.id);
    return ok(pings);
  } catch (e) {
    return serverError(e);
  }
}
