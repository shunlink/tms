/** Server-side maps / routing configuration (secrets stay server-only unless NEXT_PUBLIC_*). */

export type MapsProvider = "google" | "mapbox" | "here" | "osm";

export function mapsProvider(): MapsProvider {
  const raw = (process.env.MAPS_PROVIDER ?? "osm").trim().toLowerCase();
  if (raw === "google") return "google";
  if (raw === "mapbox") return "mapbox";
  if (raw === "here") return "here";
  return "osm";
}

export function isRoutingConfigured(): boolean {
  const p = mapsProvider();
  if (p === "google") return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
  if (p === "mapbox") return Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
  if (p === "here") return Boolean(process.env.HERE_API_KEY?.trim());
  return false;
}

/** Safe to expose to the browser for map tiles / embeds. */
export function getPublicMapsConfig() {
  const provider =
    (process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? process.env.MAPS_PROVIDER ?? "osm").trim().toLowerCase();

  return {
    provider:
      provider === "google" || provider === "mapbox" || provider === "here" ? provider : "osm",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null,
    mapboxAccessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || null,
    hereApiKey: process.env.NEXT_PUBLIC_HERE_API_KEY?.trim() || null,
    tileUrl:
      process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() ||
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };
}
