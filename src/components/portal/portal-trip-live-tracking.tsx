"use client";

import LiveTrackingView from "@/components/forms/live-tracking-view";

const LIVE_TRIP_STATUSES = new Set(["DISPATCHED", "IN_TRANSIT"]);

type InitialPing = {
  id: string;
  lat: number;
  lng: number;
  note?: string | null;
  source?: string;
  accuracyMeters?: number | null;
  recordedAt?: string;
  createdAt?: string;
};

export default function PortalTripLiveTracking({
  tripId,
  tripStatus,
  fetchUrl,
  mapDisplayUrl,
  initialPing,
}: {
  tripId: string;
  tripStatus: string;
  fetchUrl: string;
  mapDisplayUrl: string;
  initialPing?: InitialPing | null;
}) {
  const latest = initialPing
    ? {
        ...initialPing,
        source: initialPing.source ?? "GPS",
        recordedAt: initialPing.recordedAt ?? initialPing.createdAt,
      }
    : null;

  return (
    <LiveTrackingView
      fetchUrl={fetchUrl}
      initialPing={latest}
      live={LIVE_TRIP_STATUSES.has(tripStatus)}
      showHistory
      tripId={tripId}
      mapDisplayUrl={mapDisplayUrl}
    />
  );
}
