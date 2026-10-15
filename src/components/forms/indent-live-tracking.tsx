"use client";

import LiveTrackingView from "./live-tracking-view";

type Ping = {
  lat: number;
  lng: number;
  source?: string;
  accuracyMeters?: number | null;
  recordedAt?: Date | string | null;
};

const LIVE_INDENT_STATUSES = new Set(["VEHICLE_PLACED", "DRIVER_ASSIGNED", "IN_TRANSIT"]);

export default function IndentLiveTracking({
  indentId,
  indentStatus,
  lastPing,
}: {
  indentId: string;
  indentStatus: string;
  lastPing?: Ping | null;
}) {
  const initial = lastPing
    ? {
        id: "initial",
        lat: lastPing.lat,
        lng: lastPing.lng,
        source: lastPing.source,
        accuracyMeters: lastPing.accuracyMeters,
        recordedAt:
          lastPing.recordedAt instanceof Date
            ? lastPing.recordedAt.toISOString()
            : lastPing.recordedAt ?? undefined,
      }
    : null;

  return (
    <LiveTrackingView
      fetchUrl={`/api/indents/${indentId}/tracking`}
      initialPing={initial}
      live={LIVE_INDENT_STATUSES.has(indentStatus)}
    />
  );
}
