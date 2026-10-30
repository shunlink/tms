import { requireAuth, ok, notFound, unauthorized, serverError } from "@/lib/api";
import { getTripMapDisplay } from "@/lib/services/trip-map-display.service";
import { getTripForVendor } from "@/lib/services/tracking.service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (!auth.user.vendorId) return unauthorized();

  try {
    const trip = await getTripForVendor(auth.user.vendorId, params.id);
    if (!trip) return notFound("Trip not found");

    const display = await getTripMapDisplay(params.id);
    if (!display) return notFound("Trip not found");
    return ok(display);
  } catch (e) {
    return serverError(e);
  }
}
