import { requireAuth, ok, forbidden, unauthorized, notFound, serverError } from "@/lib/api";
import { getDriverMeProfile, listDriverTripHistoryForMobile } from "@/lib/services/driver.service";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER" || !auth.user.driverId) return forbidden();

  try {
    const profile = await getDriverMeProfile(auth.user.driverId!);
    if (!profile) return notFound("Driver not found");
    return ok(profile);
  } catch (e) {
    return serverError(e);
  }
}
