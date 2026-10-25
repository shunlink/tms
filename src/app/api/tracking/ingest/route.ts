import {
  requireAuth,
  authorize,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { trackingIngestSchema, validate } from "@/lib/validation";
import {
  ingestTrackingLocation,
  CellTowerNotFoundError,
} from "@/lib/services/tracking.service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trackingIngestBearerOk(req: Request): boolean {
  const secret = process.env.TRACKING_INGEST_SECRET?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

async function assertTripIngestAllowed(
  req: Request,
  trip: { id: string; vendorId: string; driverId: string | null }
): Promise<Response | null> {
  if (trackingIngestBearerOk(req)) return null;

  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "tracking.post");
  if (denied) return denied;

  const user = auth.user;
  if (user.role === "VENDOR" && trip.vendorId !== user.vendorId) return forbidden();
  if (user.role === "DRIVER" && trip.driverId !== user.driverId) return forbidden();

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = validate(trackingIngestSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const trip = await prisma.trip.findFirst({
      where: { id: parsed.data.tripId },
      select: { id: true, vendorId: true, driverId: true },
    });
    if (!trip) return notFound("Trip not found");

    const denied = await assertTripIngestAllowed(req, trip);
    if (denied) return denied;

    const result = await ingestTrackingLocation({
      tripId: parsed.data.tripId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      mcc: parsed.data.mcc,
      mnc: parsed.data.mnc,
      lac: parsed.data.lac,
      cellId: parsed.data.cellId,
      accuracyMeters: parsed.data.accuracyMeters,
      provider: parsed.data.provider,
    });

    if (!result.ok) {
      if (result.error === "NOT_FOUND") return notFound("Trip not found");
      return badRequest("Invalid location payload");
    }

    return created({
      tripId: result.tripId,
      lat: result.location.lat,
      lng: result.location.lng,
      source: result.source,
      lastPingAt: result.lastPingAt.toISOString(),
      pingId: result.ping.id,
    });
  } catch (e) {
    if (e instanceof CellTowerNotFoundError) {
      return notFound(e.message);
    }
    return serverError(e);
  }
}
