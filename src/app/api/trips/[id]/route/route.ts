import { requireAuth, authorize, ok, notFound, unauthorized, serverError } from "@/lib/api";
import {
  ensureTripRouteGeocoded,
  getTripRouteSnapshot,
} from "@/lib/services/trip-route.service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "tracking.view");
  if (denied) return denied;

  try {
    await ensureTripRouteGeocoded(params.id);
    const snapshot = await getTripRouteSnapshot(params.id);
    if (!snapshot) return notFound("Trip not found");
    return ok(snapshot);
  } catch (e) {
    return serverError(e);
  }
}
