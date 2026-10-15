import { requireAuth, authorize, ok, created, badRequest, notFound, serverError } from "@/lib/api";
import { trackingPingSchema, validate } from "@/lib/validation";
import { addTrackingPing, listTrackingPings, getLatestLocation } from "@/lib/services/tracking.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "tracking.view");
  if (denied) return denied;
  try {
    const pings = await listTrackingPings(params.id);
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
  const denied = await authorize(auth, "tracking.post");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(trackingPingSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const driverId = auth!.user.role === "DRIVER" ? auth!.user.driverId : body.driverId ?? null;
    const ping = await addTrackingPing({
      indentId: params.id,
      driverId,
      lat: d.lat,
      lng: d.lng,
      source: d.source,
      accuracyMeters: d.accuracyMeters,
      provider: d.provider,
    });
    return created(ping);
  } catch (e) {
    return serverError(e);
  }
}
