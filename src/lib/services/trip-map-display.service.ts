import { mapsProvider, isRoutingConfigured } from "../maps/config";
import { mergeFlexiblePolylines } from "../maps/flex-polyline";
import { hasStartedMainRoute } from "../maps/geo";
import { fetchDrivingRoute } from "../maps/routing";
import type { TripEtaStatus } from "./trip-eta.service";
import { ensureTripRouteGeocoded, getTripRouteSnapshot } from "./trip-route.service";
import { listTripTrackingPings } from "./tracking.service";

const ON_TIME_BUFFER_MS = 15 * 60 * 1000;

export type TripMapRouteLeg = {
  polylines: string[];
  distanceMeters: number;
  durationSeconds: number;
};

export type TripMapDisplay = {
  tripId: string;
  routeFrom: string;
  routeTo: string;
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  current: { lat: number; lng: number } | null;
  /** Decoded driving path for map clients (HERE polyline or origin→destination fallback). */
  routePath: { lat: number; lng: number }[];
  plannedRoute: TripMapRouteLeg | null;
  /** Current → pickup while still approaching pickup (not on main haul yet). */
  approachRoute: TripMapRouteLeg | null;
  remaining: (TripMapRouteLeg & {
    liveEta: string;
    status: TripEtaStatus;
    /** False while still approaching pickup — remaining reflects full pickup→drop leg. */
    onMainRoute: boolean;
  }) | null;
  expectedEndAt: string | null;
  geocodeIncomplete: boolean;
  routingAvailable: boolean;
};

function routeLegFromFetch(result: Awaited<ReturnType<typeof fetchDrivingRoute>>): TripMapRouteLeg {
  return {
    polylines: result.sectionPolylines ?? [],
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
  };
}

function computeEtaStatus(liveEta: Date, expectedEnd: Date | null): TripEtaStatus {
  if (!expectedEnd) return "UNKNOWN";
  const delta = liveEta.getTime() - expectedEnd.getTime();
  if (delta > ON_TIME_BUFFER_MS) return "DELAYED";
  if (delta < -ON_TIME_BUFFER_MS) return "EARLY";
  return "ON_TIME";
}

export async function getTripMapDisplay(tripId: string): Promise<TripMapDisplay | null> {
  await ensureTripRouteGeocoded(tripId);
  const snapshot = await getTripRouteSnapshot(tripId);
  if (!snapshot) return null;

  const latestPings = await listTripTrackingPings(tripId, 1);
  const latestPing = latestPings[0];
  const currentLocation =
    latestPing != null
      ? { lat: latestPing.lat, lng: latestPing.lng }
      : snapshot.currentLocation;

  const routingAvailable = isRoutingConfigured() && mapsProvider() === "here";
  const geocodeIncomplete = !snapshot.origin || !snapshot.destination;

  let plannedRoute: TripMapRouteLeg | null = null;
  let approachRoute: TripMapRouteLeg | null = null;
  let remaining: TripMapDisplay["remaining"] = null;

  if (routingAvailable && snapshot.origin && snapshot.destination) {
    try {
      const planned = await fetchDrivingRoute(snapshot.origin, snapshot.destination);
      plannedRoute = routeLegFromFetch(planned);
    } catch {
      plannedRoute = null;
    }
  }

  if (
    routingAvailable &&
    currentLocation &&
    snapshot.destination &&
    snapshot.origin &&
    plannedRoute
  ) {
    try {
      const onMainRoute = hasStartedMainRoute(
        currentLocation,
        snapshot.origin,
        snapshot.destination,
        plannedRoute.distanceMeters,
        plannedRoute.polylines
      );

      let leg: TripMapRouteLeg;
      let durationForEta: number;

      if (onMainRoute) {
        const enRoute = await fetchDrivingRoute(currentLocation, snapshot.destination);
        leg = routeLegFromFetch(enRoute);
        durationForEta = leg.durationSeconds;
      } else {
        // Full pickup → drop leg still ahead; do not use distance-to-pickup as "remaining".
        leg = {
          polylines: plannedRoute.polylines,
          distanceMeters: plannedRoute.distanceMeters,
          durationSeconds: plannedRoute.durationSeconds,
        };
        let approachSeconds = 0;
        try {
          const approach = await fetchDrivingRoute(currentLocation, snapshot.origin);
          approachRoute = routeLegFromFetch(approach);
          approachSeconds = approach.durationSeconds;
        } catch {
          approachRoute = null;
          approachSeconds = 0;
        }
        durationForEta = approachSeconds + plannedRoute.durationSeconds;
      }

      const now = new Date();
      const liveEta = new Date(now.getTime() + durationForEta * 1000);
      const expectedEnd = snapshot.expectedEndAt ? new Date(snapshot.expectedEndAt) : null;
      remaining = {
        ...leg,
        liveEta: liveEta.toISOString(),
        status: computeEtaStatus(liveEta, expectedEnd),
        onMainRoute,
      };
    } catch {
      remaining = null;
    }
  }

  let routePath: { lat: number; lng: number }[] = [];
  if (plannedRoute?.polylines?.length) {
    routePath = mergeFlexiblePolylines(plannedRoute.polylines);
  }
  if (routePath.length < 2 && snapshot.origin && snapshot.destination) {
    routePath = [snapshot.origin, snapshot.destination];
  }

  return {
    tripId: snapshot.tripId,
    routeFrom: snapshot.routeFrom,
    routeTo: snapshot.routeTo,
    origin: snapshot.origin,
    destination: snapshot.destination,
    current: currentLocation,
    routePath,
    plannedRoute,
    approachRoute,
    remaining,
    expectedEndAt: snapshot.expectedEndAt,
    geocodeIncomplete,
    routingAvailable,
  };
}
