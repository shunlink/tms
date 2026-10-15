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
import { addTrackingPing } from "@/lib/services/tracking.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  try {
    const trip = await prisma.trip.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!trip) return notFound("Trip not found");

    const pings = await prisma.trackingPing.findMany({
      where: { tripId: params.id },
      orderBy: { recordedAt: "desc" },
      take: 50,
    });
    return ok(
      pings.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        source: p.source,
        accuracyMeters: p.accuracyMeters,
        note: p.note,
        recordedAt: p.recordedAt.toISOString(),
        createdAt: p.recordedAt.toISOString(),
      }))
    );
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "tracking.post");
  if (denied) return denied;

  const user = auth.user;
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: params.id },
      select: { id: true, indentId: true, vendorId: true, driverId: true },
    });
    if (!trip) return notFound("Trip not found");
    if (user.role === "VENDOR" && trip.vendorId !== user.vendorId) return forbidden();
    if (user.role === "DRIVER" && trip.driverId !== user.driverId) return forbidden();

    const body = await req.json();
    const parsed = validate(trackingPingSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const driverId =
      user.role === "DRIVER" ? user.driverId : body.driverId ?? trip.driverId ?? null;

    const ping = await addTrackingPing({
      indentId: trip.indentId,
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
