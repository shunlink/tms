"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import LiveTrackingView from "./live-tracking-view";

type Ping = { id: string; lat: number; lng: number; note: string | null; createdAt: string; source?: string; accuracyMeters?: number | null };

const LIVE_TRIP_STATUSES = new Set(["DISPATCHED", "IN_TRANSIT"]);

export default function TripTracking({
  tripId,
  tripStatus,
  pings,
}: {
  tripId: string;
  tripStatus: string;
  pings: Ping[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ lat: "", lng: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const latest = pings[0]
    ? {
        ...pings[0],
        source: pings[0].source ?? "GPS",
        recordedAt: pings[0].createdAt,
      }
    : null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/trips/${tripId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source: "GPS" }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to add ping");
      return;
    }
    setForm({ lat: "", lng: "", note: "" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <LiveTrackingView
        fetchUrl={`/api/trips/${tripId}/tracking`}
        initialPing={latest}
        live={LIVE_TRIP_STATUSES.has(tripStatus)}
        showHistory
      />

      <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-t pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
          <input type="number" step="any" className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.lat} onChange={(e) => set("lat", e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
          <input type="number" step="any" className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.lng} onChange={(e) => set("lng", e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
          <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Crossed Gwalior" />
        </div>
        <div>
          <Button type="submit" size="sm" disabled={busy} className="w-full">
            {busy ? "Adding..." : "Add Ping"}
          </Button>
        </div>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
