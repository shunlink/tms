import { prisma } from "../prisma";
import { resolveCellTower, CellTowerNotFoundError } from "../resolve-cell-tower";

export { CellTowerNotFoundError };

export type TrackingPingInput = {
  indentId?: string | null;
  tripId?: string | null;
  driverId?: string | null;
  lat: number;
  lng: number;
  source: "GPS" | "CELL";
  accuracyMeters?: number | null;
  provider?: string | null;
};

export type TrackingIngestInput = {
  tripId: string;
  lat?: number;
  lng?: number;
  mcc?: number;
  mnc?: number;
  lac?: number;
  cellId?: bigint | number | string;
  accuracyMeters?: number | null;
  provider?: string | null;
};

async function syncTripLiveLocation(tripId: string, lat: number, lng: number, recordedAt: Date) {
  await prisma.trip.update({
    where: { id: tripId },
    data: { currentLat: lat, currentLng: lng, lastPingAt: recordedAt },
  });
}

export async function addTrackingPing(input: TrackingPingInput) {
  let tripId: string | null = input.tripId ?? null;
  if (!tripId && input.indentId && input.driverId) {
    const trip = await prisma.trip.findFirst({
      where: { indentId: input.indentId, driverId: input.driverId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    tripId = trip?.id ?? null;
  } else if (!tripId && input.indentId) {
    const trip = await prisma.trip.findFirst({
      where: { indentId: input.indentId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    tripId = trip?.id ?? null;
  }

  const ping = await prisma.trackingPing.create({
    data: {
      indentId: input.indentId ?? null,
      tripId,
      driverId: input.driverId ?? null,
      lat: input.lat,
      lng: input.lng,
      source: input.source,
      accuracyMeters: input.accuracyMeters ?? null,
      provider: input.provider ?? null,
    },
  });

  if (tripId) {
    await syncTripLiveLocation(tripId, input.lat, input.lng, ping.recordedAt);
  }

  return ping;
}

/**
 * Provider-agnostic location ingest: GPS coordinates or cell-tower IDs → normalized ping + Trip snapshot.
 */
export async function ingestTrackingLocation(input: TrackingIngestInput) {
  const trip = await prisma.trip.findFirst({
    where: { id: input.tripId },
    select: { id: true, indentId: true, driverId: true, vendorId: true, status: true },
  });
  if (!trip) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  let lat: number;
  let lng: number;
  let source: "GPS" | "CELL";
  let provider = input.provider ?? null;

  const hasGps = input.lat != null && input.lng != null;
  const hasCell =
    input.mcc != null &&
    input.mnc != null &&
    input.lac != null &&
    input.cellId != null;

  if (hasGps) {
    lat = input.lat!;
    lng = input.lng!;
    source = "GPS";
  } else if (hasCell) {
    const resolved = await resolveCellTower(input.mcc!, input.mnc!, input.lac!, input.cellId!);
    lat = resolved.lat;
    lng = resolved.lng;
    source = "CELL";
    provider = provider ?? "opencellid-local";
  } else {
    return { ok: false as const, error: "INVALID_LOCATION" as const };
  }

  const ping = await prisma.trackingPing.create({
    data: {
      tripId: trip.id,
      indentId: trip.indentId,
      driverId: trip.driverId,
      lat,
      lng,
      source,
      accuracyMeters: input.accuracyMeters ?? null,
      provider,
    },
  });

  await syncTripLiveLocation(trip.id, lat, lng, ping.recordedAt);

  return {
    ok: true as const,
    tripId: trip.id,
    ping,
    location: { lat, lng },
    source,
    lastPingAt: ping.recordedAt,
  };
}

export async function getLatestLocation(indentId: string) {
  return prisma.trackingPing.findFirst({
    where: { indentId },
    orderBy: { recordedAt: "desc" },
  });
}

/** Cell-tower (LBS) lookup for feature-phone drivers — pluggable adapter. */
export async function requestCellLocation(phoneNumber: string) {
  const { cellTrackingAdapter } = await import("../adapters/cell-tracking");
  return cellTrackingAdapter.getLocation(phoneNumber);
}

export async function listTrackingPings(indentId: string, limit = 200) {
  return prisma.trackingPing.findMany({
    where: { indentId },
    orderBy: { recordedAt: "desc" },
    take: limit,
  });
}

export type TrackingPingDto = {
  id: string;
  lat: number;
  lng: number;
  source: string;
  accuracyMeters: number | null;
  note: string | null;
  recordedAt: string;
  createdAt: string;
};

export function mapTrackingPingDto(
  p: {
    id: string;
    lat: number;
    lng: number;
    source: string;
    accuracyMeters: number | null;
    note: string | null;
    recordedAt: Date;
  }
): TrackingPingDto {
  const iso = p.recordedAt.toISOString();
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    source: p.source,
    accuracyMeters: p.accuracyMeters,
    note: p.note,
    recordedAt: iso,
    createdAt: iso,
  };
}

export async function listTripTrackingPings(tripId: string, limit = 50) {
  const pings = await prisma.trackingPing.findMany({
    where: { tripId },
    orderBy: { recordedAt: "desc" },
    take: limit,
  });
  return pings.map(mapTrackingPingDto);
}

export async function getTripForClient(clientId: string, tripId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, clientId },
    select: { id: true, clientId: true, status: true },
  });
}

export async function getTripForVendor(vendorId: string, tripId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, vendorId },
    select: { id: true, vendorId: true, status: true },
  });
}
