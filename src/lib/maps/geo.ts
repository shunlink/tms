import { mergeFlexiblePolylines } from "./flex-polyline";

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ~4 km — within geofence of pickup coordinates. */
export const PICKUP_REACHED_RADIUS_M = 4_000;

function polylineLengthMeters(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineMeters(points[i - 1], points[i]);
  }
  return sum;
}

/** Closest-point distance along polyline from the start to `target`. */
export function distanceAlongPolylineToPoint(points: LatLng[], target: LatLng): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return haversineMeters(points[0], target);

  let bestAlong = 0;
  let bestDist = Infinity;
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = haversineMeters(a, b);
    if (segLen === 0) continue;

    const t = clamp01(projectFractionOnSegment(a, b, target));
    const proj = {
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    };
    const dist = haversineMeters(target, proj);
    const along = accumulated + t * segLen;
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = along;
    }
    accumulated += segLen;
  }

  return bestAlong;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Approximate projection of target onto segment a→b (planar). */
function projectFractionOnSegment(a: LatLng, b: LatLng, target: LatLng): number {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const tx = target.lng;
  const ty = target.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  if (denom === 0) return 0;
  return ((tx - ax) * dx + (ty - ay) * dy) / denom;
}

/**
 * True when the vehicle is on the main haul (pickup → drop): at pickup or past pickup on the planned road.
 * Until then, remaining distance should be full pickup → drop (B→C).
 */
export function hasStartedMainRoute(
  current: LatLng,
  origin: LatLng,
  destination: LatLng,
  plannedDistanceMeters: number,
  plannedPolylines: string[] = []
): boolean {
  const routePoints =
    plannedPolylines.length > 0 ? mergeFlexiblePolylines(plannedPolylines) : [];
  return hasStartedMainRouteOnPoints(
    current,
    origin,
    destination,
    plannedDistanceMeters,
    routePoints
  );
}

export function hasStartedMainRouteOnPoints(
  current: LatLng,
  origin: LatLng,
  destination: LatLng,
  plannedDistanceMeters: number,
  routePoints: LatLng[]
): boolean {
  const toOrigin = haversineMeters(current, origin);
  const toDest = haversineMeters(current, destination);

  if (toOrigin <= PICKUP_REACHED_RADIUS_M) return true;

  // Far from pickup but very close to drop — still treat as pre-pickup for remaining (B→C).
  if (
    plannedDistanceMeters > 0 &&
    toOrigin > plannedDistanceMeters * 0.45 &&
    toDest < plannedDistanceMeters * 0.12
  ) {
    return false;
  }

  if (routePoints.length >= 2) {
    const totalLen = polylineLengthMeters(routePoints);
    const originAlong = distanceAlongPolylineToPoint(routePoints, origin);
    const currentAlong = distanceAlongPolylineToPoint(routePoints, current);
    const pastPickupOnLine = currentAlong >= originAlong + PICKUP_REACHED_RADIUS_M;

    if (!pastPickupOnLine) return false;

    // GPS on the corridor toward drop but still before pickup (e.g. Nashik while pickup is Mumbai).
    if (
      totalLen > 0 &&
      toDest > toOrigin * 1.2 &&
      currentAlong / totalLen < 0.35
    ) {
      return false;
    }

    return toOrigin > PICKUP_REACHED_RADIUS_M;
  }

  return false;
}
