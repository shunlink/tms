import { prisma } from "../prisma";
import { forwardGeocode } from "../geocode";

type LocationRow = {
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  scheduledAt?: Date | null;
};

export function formatTripOriginQuery(
  routeFrom: string,
  loading: LocationRow | null | undefined
): string {
  const parts = [
    loading?.addressLine1,
    loading?.city ?? routeFrom,
    loading?.state,
    loading?.pincode,
    "India",
  ].filter(Boolean);
  return parts.join(", ");
}

export function formatTripDestinationQuery(
  routeTo: string,
  unloading: LocationRow | null | undefined
): string {
  const parts = [
    unloading?.addressLine1,
    unloading?.city ?? routeTo,
    unloading?.state,
    unloading?.pincode,
    "India",
  ].filter(Boolean);
  return parts.join(", ");
}

const tripRouteSelect = {
  id: true,
  routeFrom: true,
  routeTo: true,
  originLat: true,
  originLng: true,
  destLat: true,
  destLng: true,
  expectedEndAt: true,
  indent: {
    select: {
      loading: {
        select: {
          addressLine1: true,
          city: true,
          state: true,
          pincode: true,
        },
      },
      unloading: {
        select: {
          addressLine1: true,
          city: true,
          state: true,
          pincode: true,
          scheduledAt: true,
        },
      },
    },
  },
} as const;

/**
 * Geocode origin/destination once and persist expected delivery time from indent unloading schedule.
 * Safe to call multiple times — only fills missing coordinates.
 */
export async function ensureTripRouteGeocoded(tripId: string): Promise<void> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: tripRouteSelect,
  });
  if (!trip) return;

  const loading = trip.indent?.loading;
  const unloading = trip.indent?.unloading;

  const data: {
    originLat?: number;
    originLng?: number;
    destLat?: number;
    destLng?: number;
    expectedEndAt?: Date;
    routeGeocodedAt?: Date;
  } = {};

  if (trip.expectedEndAt == null && unloading?.scheduledAt) {
    data.expectedEndAt = unloading.scheduledAt;
  }

  let geocodedAny = false;

  if (trip.originLat == null || trip.originLng == null) {
    const query = formatTripOriginQuery(trip.routeFrom, loading);
    const hit = await forwardGeocode(query);
    if (hit) {
      data.originLat = hit.lat;
      data.originLng = hit.lng;
      geocodedAny = true;
    }
  }

  if (trip.destLat == null || trip.destLng == null) {
    const query = formatTripDestinationQuery(trip.routeTo, unloading);
    const hit = await forwardGeocode(query);
    if (hit) {
      data.destLat = hit.lat;
      data.destLng = hit.lng;
      geocodedAny = true;
    }
  }

  if (Object.keys(data).length === 0) return;

  if (geocodedAny || data.expectedEndAt) {
    data.routeGeocodedAt = new Date();
  }

  await prisma.trip.update({ where: { id: tripId }, data });
}

export async function getTripRouteSnapshot(tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: {
      id: true,
      routeFrom: true,
      routeTo: true,
      originLat: true,
      originLng: true,
      destLat: true,
      destLng: true,
      currentLat: true,
      currentLng: true,
      lastPingAt: true,
      expectedEndAt: true,
      routeGeocodedAt: true,
      dispatchedAt: true,
    },
  });
  if (!trip) return null;

  return {
    tripId: trip.id,
    routeFrom: trip.routeFrom,
    routeTo: trip.routeTo,
    origin:
      trip.originLat != null && trip.originLng != null
        ? { lat: trip.originLat, lng: trip.originLng }
        : null,
    destination:
      trip.destLat != null && trip.destLng != null
        ? { lat: trip.destLat, lng: trip.destLng }
        : null,
    currentLocation:
      trip.currentLat != null && trip.currentLng != null
        ? { lat: trip.currentLat, lng: trip.currentLng }
        : null,
    lastPingAt: trip.lastPingAt?.toISOString() ?? null,
    expectedEndAt: trip.expectedEndAt?.toISOString() ?? null,
    routeGeocodedAt: trip.routeGeocodedAt?.toISOString() ?? null,
    dispatchedAt: trip.dispatchedAt?.toISOString() ?? null,
  };
}
