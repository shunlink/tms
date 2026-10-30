import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  authorize,
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { trackingPingSchema, validate } from "@/lib/validation";
import { addTrackingPing, listTripTrackingPings } from "@/lib/services/tracking.service";

async function canReadTripTracking(
  auth: NonNullable<Awaited<ReturnType<typeof requireAuth>>>,
  trip: { vendorId: string | null; driverId: string | null }
) {
  const user = auth.user;
  if (user.role === "VENDOR" && trip.vendorId === user.vendorId) return true;
  if (user.role === "DRIVER" && trip.driverId === user.driverId) return true;
  const denied = await authorize(auth, "tracking.view");
  return !denied;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: params.id },
      select: { id: true, vendorId: true, driverId: true },
    });
    if (!trip) return notFound("Trip not found");

    const allowed = await canReadTripTracking(auth, trip);
    if (!allowed) return forbidden();

    const pings = await listTripTrackingPings(params.id);
    return ok(pings);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const user = auth.user;
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: params.id },
      select: { id: true, indentId: true, vendorId: true, driverId: true },
    });
    if (!trip) return notFound("Trip not found");
    if (user.role === "VENDOR" && trip.vendorId !== user.vendorId) return forbidden();
    if (user.role === "DRIVER" && trip.driverId !== user.driverId) return forbidden();

    const isPortalDriverOrVendor =
      (user.role === "DRIVER" && trip.driverId === user.driverId) ||
      (user.role === "VENDOR" && trip.vendorId === user.vendorId);
    if (!isPortalDriverOrVendor) {
      const denied = await authorize(auth, "tracking.post");
      if (denied) return denied;
    }

    const body = await req.json();
    const parsed = validate(trackingPingSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const driverId =
      user.role === "DRIVER" ? user.driverId : body.driverId ?? trip.driverId ?? null;

    const ping = await addTrackingPing({
      indentId: trip.indentId,
      tripId: trip.id,
      driverId,
      lat: d.lat,
      lng: d.lng,
      source: d.source,
      accuracyMeters: d.accuracyMeters,
      provider: d.provider,
    });

    if (body.note) {
      await prisma.trackingPing.update({
        where: { id: ping.id },
        data: { note: String(body.note) },
      });
    }

    return created(ping);
  } catch (e) {
    return serverError(e);
  }
}
