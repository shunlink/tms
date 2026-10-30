import { requireAuth, forbidden, notFound, ok, unauthorized } from "@/lib/api";
import { getDriverProfile } from "@/lib/services/driver.service";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role !== "DRIVER" || !auth.user.driverId) return forbidden();

  const profile = await getDriverProfile(auth.user.driverId);
  if (!profile) return notFound("Driver not found");
  return ok(profile);
}
