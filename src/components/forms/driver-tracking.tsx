"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Radio } from "lucide-react";
import { DRIVER_GPS_SHARE_INTERVAL_MS } from "@/lib/constants";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
type Ping = { id: string; lat: number; lng: number; note: string | null; createdAt: string };

const TRACKING_INDENT_STATUSES = new Set(["VEHICLE_PLACED", "DRIVER_ASSIGNED", "IN_TRANSIT"]);
const TRACKING_TRIP_STATUSES = new Set(["DISPATCHED", "IN_TRANSIT"]);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function DriverTracking({
  indentId,
  tripId,
  indentStatus,
  tripStatus,
  pings: initialPings,
}: {
  indentId: string;
  tripId?: string | null;
  indentStatus: string;
  tripStatus: string | null;
  pings: Ping[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number } | null>(null);
  const [lastSharedAt, setLastSharedAt] = useState<string | null>(initialPings[0]?.createdAt ?? null);
  const [pings, setPings] = useState(initialPings);
  const mounted = useRef(true);
  const sharing = useRef(false);

  const active =
    TRACKING_INDENT_STATUSES.has(indentStatus) ||
    (tripStatus != null && TRACKING_TRIP_STATUSES.has(tripStatus));

  const geocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { silent: true });
        return;
      }
      const body = data as { address?: string };
      if (body.address && mounted.current) setAddress(body.address);
    } catch {
      // geocoding is best-effort
    }
  }, []);

  const shareLocation = useCallback(async () => {
    if (!navigator.geolocation || sharing.current) return;
    sharing.current = true;
    setError("");
    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracyMeters = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null;

        if (mounted.current) setLastFix({ lat, lng });
        await geocode(lat, lng);

        try {
          const trackingUrl = tripId
            ? `/api/trips/${tripId}/tracking`
            : `/api/indents/${indentId}/tracking`;
          const res = await fetch(trackingUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, source: "GPS", accuracyMeters }),
          });

          if (!mounted.current) return;

          if (!res.ok) {
            setError("Could not share location — check your connection");
            return;
          }

          const now = new Date().toISOString();
          setLastSharedAt(now);
          setPings((prev) => [
            {
              id: `local-${now}`,
              lat,
              lng,
              note: null,
              createdAt: now,
            },
            ...prev.slice(0, 4),
          ]);
        } catch {
          if (mounted.current) setError("Could not share location — check your connection");
        } finally {
          if (mounted.current) setBusy(false);
          sharing.current = false;
        }
      },
      () => {
        if (mounted.current) {
          setBusy(false);
          setError("Allow GPS access in your browser settings to share location automatically");
        }
        sharing.current = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [indentId, geocode]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Share immediately when trip becomes active, then on a fixed interval.
  useEffect(() => {
    if (!active) return;

    shareLocation();
    const id = setInterval(shareLocation, DRIVER_GPS_SHARE_INTERVAL_MS);

    const onVisible = () => {
      if (!document.hidden) shareLocation();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, shareLocation]);

  if (!active) {
    return (
      <p className="text-sm text-slate-500">
        Location sharing starts automatically when your vehicle is placed and the trip is active.
      </p>
    );
  }

  const intervalMinutes = Math.round(DRIVER_GPS_SHARE_INTERVAL_MS / 60_000);

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-teal-50 border border-teal-100 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-teal-800">
          <Radio className="h-4 w-4 shrink-0" />
          Sharing location automatically
        </div>
        <p className="text-xs text-teal-700">
          GPS updates every {intervalMinutes} minute{intervalMinutes === 1 ? "" : "s"} while this page is open.
          No action needed from you.
        </p>

        <div className="text-sm text-slate-700 pt-1">
          {busy ? (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting GPS fix…
            </span>
          ) : lastFix ? (
            <span>
              Last position:{" "}
              <span className="font-medium">
                {lastFix.lat.toFixed(5)}, {lastFix.lng.toFixed(5)}
              </span>
              {lastSharedAt && (
                <span className="text-slate-500"> · shared at {formatTime(lastSharedAt)}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-500">Waiting for first GPS fix…</span>
          )}
        </div>
      </div>

      {address && (
        <p className="text-sm text-slate-600 flex items-start gap-2">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          {address}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {pings.length > 0 && (
        <div className="pt-2 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase">Recent pings</p>
          {pings.map((p) => (
            <a
              key={p.id}
              href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=12/${p.lat}/${p.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              {p.note ?? `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`}
              <span className="text-slate-400 text-xs">{formatTime(p.createdAt)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
