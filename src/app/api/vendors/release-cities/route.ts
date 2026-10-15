import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { getReleaseCityOptions, listReleasedCities } from "@/lib/services/release.service";

export const runtime = "nodejs";

/** Distinct vendor cities with eligible vendor counts for the release picker. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.release");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const indentId = url.searchParams.get("indentId");

    const [cities, released] = await Promise.all([
      getReleaseCityOptions(),
      indentId ? listReleasedCities(indentId) : Promise.resolve([]),
    ]);

    return ok({
      cities,
      releasedCities: released.map((r) => r.city),
    });
  } catch (e) {
    return serverError(e);
  }
}
