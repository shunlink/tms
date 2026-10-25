import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { DELIVERY_ZONE_OPTIONS, RELEASE_FILTER_ZONE_VALUES } from "@/lib/delivery-zones";
import { getReleaseCityOptions, listReleasedCities, listReleasedZones } from "@/lib/services/release.service";

export const runtime = "nodejs";

/** Distinct vendor cities with eligible vendor counts for the release picker. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.release");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const indentId = url.searchParams.get("indentId");
    const zonesParam = url.searchParams.get("zones");
    const zonesFromRepeated = url.searchParams.getAll("zone");
    const zonesRaw =
      zonesFromRepeated.length > 0
        ? zonesFromRepeated
        : zonesParam
          ? zonesParam.split(",")
          : [];
    const zones = zonesRaw.map((z) => z.trim()).filter(Boolean);

    const [cities, released, releasedZones] = await Promise.all([
      getReleaseCityOptions(zones),
      indentId ? listReleasedCities(indentId) : Promise.resolve([]),
      indentId ? listReleasedZones(indentId) : Promise.resolve([]),
    ]);

    const zoneOptions = DELIVERY_ZONE_OPTIONS.filter((o) =>
      (RELEASE_FILTER_ZONE_VALUES as readonly string[]).includes(o.value)
    );

    return ok({
      cities,
      releasedCities: released.map((r) => r.city),
      releasedZones: releasedZones.map((r) => r.zone),
      zoneOptions,
    });
  } catch (e) {
    return serverError(e);
  }
}
