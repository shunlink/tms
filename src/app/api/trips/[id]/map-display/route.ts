import { requireAuth, authorize, ok, notFound, unauthorized, serverError } from "@/lib/api";
import { getTripMapDisplay } from "@/lib/services/trip-map-display.service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "tracking.view");
  if (denied) return denied;

  try {
    const display = await getTripMapDisplay(params.id);
    if (!display) return notFound("Trip not found");
    return ok(display);
  } catch (e) {
    return serverError(e);
  }
}
