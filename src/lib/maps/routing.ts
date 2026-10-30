import { mapsProvider } from "./config";

export type RoutePoint = { lat: number; lng: number };

export type DrivingRouteResult = {
  durationSeconds: number;
  distanceMeters: number;
  /** HERE flexible polylines per route section (when available). */
  sectionPolylines?: string[];
};

async function googleDrivingRoute(from: RoutePoint, to: RoutePoint): Promise<DrivingRouteResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&key=${encodeURIComponent(key)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Google Directions HTTP ${res.status}`);

  const data = (await res.json()) as {
    status: string;
    routes?: { legs: { duration: { value: number }; distance: { value: number } }[] }[];
    error_message?: string;
  };

  if (data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) {
    throw new Error(data.error_message ?? `Google Directions failed: ${data.status}`);
  }

  const leg = data.routes[0].legs[0];
  return { durationSeconds: leg.duration.value, distanceMeters: leg.distance.value };
}

async function mapboxDrivingRoute(from: RoutePoint, to: RoutePoint): Promise<DrivingRouteResult> {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MAPBOX_ACCESS_TOKEN is not configured");

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?overview=false&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Mapbox Directions HTTP ${res.status}`);

  const data = (await res.json()) as {
    code: string;
    routes?: { duration: number; distance: number }[];
    message?: string;
  };

  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(data.message ?? `Mapbox Directions failed: ${data.code}`);
  }

  return {
    durationSeconds: data.routes[0].duration,
    distanceMeters: data.routes[0].distance,
  };
}

function hereTransportMode(): string {
  const raw = (process.env.HERE_ROUTING_TRANSPORT_MODE ?? "truck").trim().toLowerCase();
  return raw === "car" ? "car" : "truck";
}

type HereRouteSection = {
  polyline?: string;
  summary?: { duration?: number; length?: number };
};

async function hereDrivingRouteOnce(
  from: RoutePoint,
  to: RoutePoint,
  transportMode: string
): Promise<DrivingRouteResult> {
  const key = process.env.HERE_API_KEY?.trim();
  if (!key) throw new Error("HERE_API_KEY is not configured");

  const params = new URLSearchParams({
    transportMode,
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    return: "polyline,summary",
    routingMode: "fast",
    apiKey: key,
  });

  const url = `https://router.hereapi.com/v8/routes?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HERE Routing HTTP ${res.status}`);

  const data = (await res.json()) as {
    routes?: { sections?: HereRouteSection[] }[];
    title?: string;
    cause?: string;
  };

  const sections = data.routes?.[0]?.sections;
  if (!sections?.length) {
    throw new Error(data.cause ?? data.title ?? "HERE Routing returned no routes");
  }

  let durationSeconds = 0;
  let distanceMeters = 0;
  const sectionPolylines: string[] = [];

  for (const section of sections) {
    durationSeconds += section.summary?.duration ?? 0;
    distanceMeters += section.summary?.length ?? 0;
    if (section.polyline) sectionPolylines.push(section.polyline);
  }

  return { durationSeconds, distanceMeters, sectionPolylines };
}

async function hereDrivingRoute(from: RoutePoint, to: RoutePoint): Promise<DrivingRouteResult> {
  const mode = hereTransportMode();
  try {
    return await hereDrivingRouteOnce(from, to, mode);
  } catch (e) {
    if (mode === "truck") {
      return hereDrivingRouteOnce(from, to, "car");
    }
    throw e;
  }
}

export async function fetchDrivingRoute(from: RoutePoint, to: RoutePoint): Promise<DrivingRouteResult> {
  const provider = mapsProvider();
  if (provider === "google") return googleDrivingRoute(from, to);
  if (provider === "mapbox") return mapboxDrivingRoute(from, to);
  if (provider === "here") return hereDrivingRoute(from, to);
  throw new Error(
    "Driving routes require MAPS_PROVIDER=google, mapbox, or here with the matching API key/token. OSM tiles do not include routing."
  );
}
