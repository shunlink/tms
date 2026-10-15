"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type Ping = {
  id: string;
  lat: number;
  lng: number;
  source?: string;
  accuracyMeters?: number | null;
  note?: string | null;
  recordedAt?: string;
  createdAt?: string;
};

const STALE_MS = 4 * 60 * 60 * 1000;
const POLL_MS = 60 * 1000;

function pingTime(ping: Ping) {
  return ping.recordedAt ?? ping.createdAt ?? null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function mapEmbedUrl(lat: number, lng: number) {
  const pad = 0.02;
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export default function LiveTrackingView({
  fetchUrl,
  initialPing,
  live = false,
  showHistory = false,
}: {
  fetchUrl: string;
  initialPing?: Ping | null;
  live?: boolean;
  showHistory?: boolean;
}) {
  const [latest, setLatest] = useState<Ping | null>(initialPing ?? null);
  const [history, setHistory] = useState<Ping[]>(initialPing ? [initialPing] : []);
  const [address, setAddress] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(fetchUrl);
      if (!res.ok) return;
      const data = await res.json();
      const pings: Ping[] = Array.isArray(data) ? data : data.data ?? [];
      if (pings.length > 0) {
        setLatest(pings[0]);
        if (showHistory) setHistory(pings);
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchUrl, showHistory]);

  useEffect(() => {
    if (!latest) return;
    fetch(`/api/geocode?lat=${latest.lat}&lng=${latest.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.address && setAddress(d.address))
      .catch(() => null);
  }, [latest?.lat, latest?.lng, latest]);

  useEffect(() => {
    if (!live) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [live, refresh]);

  const recordedAt = latest ? pingTime(latest) : null;
  const stale = recordedAt ? Date.now() - new Date(recordedAt).getTime() > STALE_MS : false;

  if (!latest) {
    return <p className="text-sm text-slate-500">No tracking data yet. Waiting for driver GPS…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <iframe
          title="Driver location map"
          src={mapEmbedUrl(latest.lat, latest.lng)}
          className="w-full h-64 border-0"
          loading="lazy"
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 text-sm">
          <div>
            <p className="text-slate-500">Location</p>
            <p className="font-medium text-slate-900">
              {address ?? `${latest.lat.toFixed(4)}, ${latest.lng.toFixed(4)}`}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Source</p>
            <p className="font-medium">{latest.source === "CELL" ? "CELL (approx)" : "GPS"}</p>
          </div>
          <div>
            <p className="text-slate-500">Accuracy</p>
            <p className="font-medium">
              {latest.accuracyMeters != null ? `~${Math.round(latest.accuracyMeters)} m` : "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Last updated</p>
            <p className="font-medium">
              {recordedAt ? `${formatDate(recordedAt)} (${timeAgo(recordedAt)})` : "—"}
            </p>
          </div>
        </div>
        {live && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            stale ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {stale ? "Tracking: STALE (not updated in 4+ hours)" : "Tracking: Active"}
        </div>
        {live && <span className="text-xs text-slate-400">Auto-refreshes every minute</span>}
        <a
          href={`https://www.openstreetmap.org/?mlat=${latest.lat}&mlon=${latest.lng}#map=14/${latest.lat}/${latest.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <MapPin className="h-3.5 w-3.5" />
          Open in map
        </a>
      </div>

      {showHistory && history.length > 1 && (
        <div className="space-y-2 max-h-48 overflow-auto border-t pt-3">
          <p className="text-xs font-medium text-slate-500 uppercase">Recent pings</p>
          {history.slice(1).map((p) => {
            const at = pingTime(p);
            return (
              <a
                key={p.id}
                href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=12/${p.lat}/${p.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-sm text-blue-600 hover:underline"
              >
                <span>{p.note ?? `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`}</span>
                <span className="text-xs text-slate-400">{at ? timeAgo(at) : ""}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
