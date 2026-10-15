import { requireAuth, ok, badRequest, unauthorized, serverError } from "@/lib/api";
import { reverseGeocode } from "@/lib/geocode";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return badRequest("Valid latitude and longitude are required");
    }
    const result = await reverseGeocode(lat, lng);
    return ok({ lat, lng, address: result?.label ?? null });
  } catch (e) {
    return serverError(e);
  }
}
