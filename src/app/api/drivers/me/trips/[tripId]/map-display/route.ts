import { requireAuth, forbidden, notFound, ok, unauthorized, serverError } from "@/lib/api";
import { getDriverIdForAuthUser, resolveDriverAccessibleTrip } from "@/lib/services/driver.service";
import { getTripMapDisplay } from "@/lib/services/trip-map-display.service";

export const dynamic = "force-dynamic";

/** Driver-scoped trip map (HERE routing computed server-side). */
export async function GET(_req: Request, { params }: { params: { tripId: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const driverId = await getDriverIdForAuthUser(auth.user);
  if (auth.user.role !== "DRIVER" || !driverId) return forbidden();

  try {
    const trip = await resolveDriverAccessibleTrip(driverId, params.tripId);
    if (!trip) return notFound("Trip not found");

    const display = await getTripMapDisplay(trip.id);
    if (!display) return notFound("Trip not found");
    return ok(display);
  } catch (e) {
    return serverError(e);
  }
}
