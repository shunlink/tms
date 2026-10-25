"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { formatINR } from "@/lib/utils";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { maxAdvanceForVendorRate } from "@/lib/advance-limits";

type EligibleTrip = {
  tripId: string;
  lrNumber: string;
  route: string;
  vendorRate: number;
  maxAdvance: number;
};

export default function VendorBulkAdvancePanel({
  indentId,
  indentNumber,
}: {
  indentId: string;
  indentNumber: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<EligibleTrip[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [splitMode, setSplitMode] = useState<"per_lr" | "total_equal" | "total_max">("per_lr");
  const [totalAmount, setTotalAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/portal/vendor/indents/${indentId}/advance-eligible-trips`);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Could not load eligible trips" });
      setLoading(false);
      return;
    }
    const payload = data as { trips?: EligibleTrip[] };
    const list = payload.trips ?? (data as { data?: { trips?: EligibleTrip[] } }).data?.trips ?? [];
    setTrips(list);
    const defaults: Record<string, string> = {};
    for (const t of list) defaults[t.tripId] = String(t.maxAdvance);
    setAmounts(defaults);
    setLoading(false);
  }, [indentId, toast]);

  const emptyHint =
    !loading && trips.length === 0
      ? "No trips are eligible for bulk advance. Advance can only be requested while trips are pending, dispatched, or in transit (before delivered)."
      : null;

  useEffect(() => {
    load();
  }, [load]);

  const totalRequested = useMemo(() => {
    return trips.reduce((sum, t) => {
      const raw = amounts[t.tripId];
      const n = raw ? Number(raw) : 0;
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [trips, amounts]);

  const combinedMax = useMemo(() => trips.reduce((s, t) => s + t.maxAdvance, 0), [trips]);

  function applyEqualFromTotal() {
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a valid total amount");
      return;
    }
    if (total > combinedMax) {
      setError(`Total cannot exceed ${formatINR(combinedMax)}`);
      return;
    }
    const n = trips.length;
    const base = Math.floor((total / n) * 100) / 100;
    let allocated = 0;
    const next: Record<string, string> = {};
    trips.forEach((t, i) => {
      const isLast = i === n - 1;
      let amount = isLast ? Math.round((total - allocated) * 100) / 100 : base;
      if (amount > t.maxAdvance) amount = t.maxAdvance;
      next[t.tripId] = String(amount);
      allocated += amount;
    });
    const diff = Math.round((total - allocated) * 100) / 100;
    if (diff !== 0 && trips.length > 0) {
      const last = trips[trips.length - 1];
      const bumped = Math.round((Number(next[last.tripId]) + diff) * 100) / 100;
      next[last.tripId] = String(bumped);
    }
    setAmounts(next);
    setError("");
  }

  function applyMaxPerLr() {
    const next: Record<string, string> = {};
    for (const t of trips) next[t.tripId] = String(t.maxAdvance);
    setAmounts(next);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const items = trips.map((t) => ({
      tripId: t.tripId,
      requestedAmount: Number(amounts[t.tripId] ?? 0),
    }));

    for (const item of items) {
      const trip = trips.find((x) => x.tripId === item.tripId);
      if (!trip) continue;
      if (item.requestedAmount <= 0) {
        setError(`Enter an amount for ${trip.lrNumber}`);
        setBusy(false);
        return;
      }
      const cap = maxAdvanceForVendorRate(trip.vendorRate);
      if (item.requestedAmount > cap) {
        setError(`Amount for ${trip.lrNumber} exceeds maximum ${formatINR(cap)}`);
        setBusy(false);
        return;
      }
    }

    const res = await fetch(`/api/portal/vendor/indents/${indentId}/advance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, remarks: remarks.trim() || undefined }),
    });
    const data = await readJsonBody(res);
    setBusy(false);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Bulk advance request failed" });
      return;
    }

    toast.push({
      variant: "success",
      title: `Submitted ${items.length} advance requests for ${indentNumber}`,
    });
    const payload = data as { requests?: { id: string }[] };
    const firstId = payload.requests?.[0]?.id;
    if (firstId) {
      router.push(`/portal/vendor/trips/${trips[0]?.tripId}`);
    } else {
      router.push("/portal/vendor/trips");
    }
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading eligible trips…</p>;
  }

  if (trips.length < 2) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-gray-600">
          {trips.length === 0
            ? emptyHint
            : "Bulk advance needs at least two trips on this indent without an active advance request."}
          <div className="mt-4">
            <Link href="/portal/vendor/trips" className="text-blue-600 hover:underline text-sm font-medium">
              Back to trips
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to split advance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["per_lr", "Per LR (edit below)"],
                ["total_equal", "Split a total equally"],
                ["total_max", "Max per LR (85% each)"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSplitMode(key);
                  if (key === "total_max") applyMaxPerLr();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  splitMode === key
                    ? "bg-[#F5D33C] border-[#EAC72E] text-gray-950"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {splitMode === "total_equal" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm flex-1 min-w-[200px]">
                <span className="text-gray-600">Total advance (₹)</span>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  className="mt-1 w-full border rounded-md px-3 py-2"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
              </label>
              <Button type="button" variant="outline" onClick={applyEqualFromTotal}>
                Apply split
              </Button>
              <p className="text-xs text-gray-500 w-full">Combined max: {formatINR(combinedMax)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Trips ({trips.length})</CardTitle>
          <span className="text-sm font-semibold text-gray-950">Total: {formatINR(totalRequested)}</span>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">LR</th>
                <th className="py-2 pr-4">Route</th>
                <th className="py-2 pr-4 text-right">Max</th>
                <th className="py-2 text-right">Request (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {trips.map((t) => (
                <tr key={t.tripId}>
                  <td className="py-3 pr-4 font-medium">{t.lrNumber}</td>
                  <td className="py-3 pr-4 text-gray-600">{t.route}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatINR(t.maxAdvance)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      min={1}
                      max={t.maxAdvance}
                      step="0.01"
                      className="w-28 border rounded-md px-2 py-1.5 text-right"
                      value={amounts[t.tripId] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [t.tripId]: e.target.value }))}
                      disabled={splitMode === "total_max"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <label className="block text-sm">
        <span className="text-gray-600">Remarks (optional)</span>
        <textarea
          className="mt-1 w-full border rounded-md px-3 py-2 min-h-[80px]"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Shared note for finance on all requests in this batch"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Submitting…" : `Submit ${trips.length} advance requests`}
        </Button>
        <Link href="/portal/vendor/trips" className="text-sm text-gray-600 hover:underline self-center">
          Cancel
        </Link>
      </div>
    </form>
  );
}
