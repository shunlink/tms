import {
  requireAuth,
  authorize,
  ok,
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { calculateTripETA } from "@/lib/services/trip-eta.service";
import { isRoutingConfigured } from "@/lib/maps/config";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "tracking.view");
  if (denied) return denied;

  if (!isRoutingConfigured()) {
    return badRequest(
      "Routing is not configured. Set MAPS_PROVIDER=google and GOOGLE_MAPS_API_KEY, or MAPS_PROVIDER=mapbox and MAPBOX_ACCESS_TOKEN."
    );
  }

  try {
    const result = await calculateTripETA(params.id);
    if (!result) return notFound("Trip not found");
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ETA calculation failed";
    if (message.includes("no current location")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
