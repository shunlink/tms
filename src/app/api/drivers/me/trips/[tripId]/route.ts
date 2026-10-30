import { requireAuth, forbidden, notFound, ok, unauthorized, serverError } from "@/lib/api";
import { getDriverIdForAuthUser, getDriverMeTripDetail } from "@/lib/services/driver.service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { tripId: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const driverId = await getDriverIdForAuthUser(auth.user);
  if (auth.user.role !== "DRIVER" || !driverId) return forbidden();

  try {
    const detail = await getDriverMeTripDetail(driverId, params.tripId);
    if (!detail) return notFound("Trip not found");
    return ok(detail);
  } catch (e) {
    return serverError(e);
  }
}
