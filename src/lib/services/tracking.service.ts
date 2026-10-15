import { prisma } from "../prisma";

export type TrackingPingInput = {
  indentId?: string | null;
  driverId?: string | null;
  lat: number;
  lng: number;
  source: "GPS" | "CELL";
  accuracyMeters?: number | null;
  provider?: string | null;
};

export async function addTrackingPing(input: TrackingPingInput) {
  // Attach to the driver's active trip as well, if any.
  let tripId: string | null = null;
  if (input.indentId) {
    const trip = await prisma.trip.findFirst({
      where: { indentId: input.indentId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    tripId = trip?.id ?? null;
  }

  return prisma.trackingPing.create({
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
