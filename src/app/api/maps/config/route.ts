import { ok } from "@/lib/api";
import { getPublicMapsConfig } from "@/lib/maps/config";

export const dynamic = "force-dynamic";

/** Public map UI settings (API keys here must be browser-restricted in Google/Mapbox console). */
export async function GET() {
  return ok(getPublicMapsConfig());
}
