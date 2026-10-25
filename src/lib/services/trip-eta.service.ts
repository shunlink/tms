import { prisma } from "../prisma";
import { fetchDrivingRoute } from "../maps/routing";
import { ensureTripRouteGeocoded } from "./trip-route.service";

export type TripEtaStatus = "DELAYED" | "ON_TIME" | "EARLY" | "UNKNOWN";

const ON_TIME_BUFFER_MS = 15 * 60 * 1000;

export type TripEtaResult = {
  tripId: string;
  liveEta: string;
  durationSeconds: number;
  distanceMeters: number;
  status: TripEtaStatus;
  expectedEndAt: string | null;
  currentLocation: { lat: number; lng: number };
  destination: { lat: number; lng: number; label: string };
  lastPingAt: string | null;
};

export async function calculateTripETA(tripId: string): Promise<TripEtaResult | null> {
  await ensureTripRouteGeocoded(tripId);

  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      routeTo: true,
      currentLat: true,
      currentLng: true,
      lastPingAt: true,
      destLat: true,
      destLng: true,
      expectedEndAt: true,
    },
  });

  if (!trip) return null;
  if (trip.currentLat == null || trip.currentLng == null) {
    throw new Error("Trip has no current location yet");
  }
  if (trip.destLat == null || trip.destLng == null) {
    throw new Error("Trip destination coordinates are not set — dispatch the trip or call GET /api/trips/{id}/route");
  }

  const { durationSeconds, distanceMeters } = await fetchDrivingRoute(
    { lat: trip.currentLat, lng: trip.currentLng },
    { lat: trip.destLat, lng: trip.destLng }
  );

  const now = new Date();
  const liveEta = new Date(now.getTime() + durationSeconds * 1000);
  const expectedEnd = trip.expectedEndAt;

  let status: TripEtaStatus = "UNKNOWN";
  if (expectedEnd) {
    const delta = liveEta.getTime() - expectedEnd.getTime();
    if (delta > ON_TIME_BUFFER_MS) status = "DELAYED";
    else if (delta < -ON_TIME_BUFFER_MS) status = "EARLY";
    else status = "ON_TIME";
  }

  return {
    tripId: trip.id,
    liveEta: liveEta.toISOString(),
    durationSeconds,
    distanceMeters,
    status,
    expectedEndAt: expectedEnd?.toISOString() ?? null,
    currentLocation: { lat: trip.currentLat, lng: trip.currentLng },
    destination: { lat: trip.destLat, lng: trip.destLng, label: trip.routeTo },
    lastPingAt: trip.lastPingAt?.toISOString() ?? null,
  };
}
