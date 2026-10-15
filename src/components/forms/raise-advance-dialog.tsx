"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

type TripOption = {
  id: string;
  lrNumber: string;
  route: string;
  vendorId: string;
  vendorRate: number;
  indentNumber?: string | null;
};

type VendorOption = { id: string; label: string };

type TripContext = {
  tripId: string;
  vendorId: string;
  lrNumber: string;
  route: string;
  clientName: string;
  indentNumber: string | null;
  buyRate: number;
  advanceApproved: number | null;
  advancePaid: number | null;
  advanceOutstanding: number | null;
  hasLiveRequest: boolean;
  liveRequestNumber: string | null;
  liveRequestStatus: string | null;
};

export default function RaiseAdvanceDialog({
  vendors,
  trips,
  open,
  onClose,
}: {
  vendors: VendorOption[];
  trips: TripOption[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tripId, setTripId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [context, setContext] = useState<TripContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTripId("");
    setVendorId("");
    setAmount("");
    setRemarks("");
    setContext(null);
    setContextError("");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!tripId) {
      setContext(null);
      setContextError("");
      return;
    }
    const trip = trips.find((t) => t.id === tripId);
    const vid = vendorId || trip?.vendorId || "";
    if (trip?.vendorId && vendorId !== trip.vendorId) {
      setVendorId(trip.vendorId);
      return;
    }
    if (!vid) return;

    let cancelled = false;
    setContextError("");
    fetch(`/api/advance-requests?tripId=${encodeURIComponent(tripId)}&vendorId=${encodeURIComponent(vid)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setContext(null);
          setContextError(data.error || "Could not load trip details");
          return;
        }
        setContext(data.context ?? null);
      })
      .catch(() => {
        if (!cancelled) setContextError("Could not load trip details");
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, vendorId, trips]);

  const vendorTrips = vendorId ? trips.filter((t) => t.vendorId === vendorId) : trips;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tripId || !vendorId) {
      setError("Select a trip and vendor");
      return;
    }
    if (context?.hasLiveRequest) {
      setError(
        `An advance request already exists for this trip (${context.liveRequestNumber}, ${context.liveRequestStatus})`
      );
      return;
    }

    setBusy(true);
    const res = await fetch("/api/advance-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        vendorId,
        amount: Number(amount),
        remarks: remarks.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to raise advance request");
      return;
    }
    onClose();
    router.refresh();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          </div>
        )}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Raise Advance Request</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            Create an advance request on behalf of a vendor. The request enters the normal approval and payment workflow.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Trip (LR) *</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={tripId}
              onChange={(e) => {
                const next = e.target.value;
                setTripId(next);
                const trip = trips.find((t) => t.id === next);
                if (trip?.vendorId) setVendorId(trip.vendorId);
              }}
              required
            >
              <option value="">Select trip</option>
              {vendorTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.lrNumber} · {t.route}
                  {t.indentNumber ? ` · ${t.indentNumber}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vendor *</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                if (tripId) {
                  const trip = trips.find((t) => t.id === tripId);
                  if (trip && trip.vendorId !== e.target.value) setTripId("");
                }
              }}
              required
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>

          {context && (
            <div className="rounded-lg border bg-slate-50 p-4 text-sm space-y-2">
              <p className="font-medium text-slate-900">Trip summary</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-500">Client</p>
                  <p>{context.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Route</p>
                  <p>{context.route}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Buy rate</p>
                  <p>{formatINR(context.buyRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Advance approved</p>
                  <p>{context.advanceApproved != null ? formatINR(context.advanceApproved) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Advance paid</p>
                  <p>{context.advancePaid != null ? formatINR(context.advancePaid) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Advance outstanding</p>
                  <p>{context.advanceOutstanding != null ? formatINR(context.advanceOutstanding) : "—"}</p>
                </div>
              </div>
              {context.hasLiveRequest && (
                <p className="text-amber-700 text-xs">
                  Active request {context.liveRequestNumber} ({context.liveRequestStatus}) — cannot create another.
                </p>
              )}
            </div>
          )}

          {contextError && <p className="text-sm text-red-600">{contextError}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Requested amount (₹) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Remarks / reason</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional — why this advance is being raised internally"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || context?.hasLiveRequest}>
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
