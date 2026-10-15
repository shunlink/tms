"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const NEXT: Record<string, { label: string; status: string }> = {
  PENDING: { label: "Mark Dispatched", status: "DISPATCHED" },
  DISPATCHED: { label: "Mark In Transit", status: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Mark Delivered", status: "DELIVERED" },
};

export default function TripStatusActions({
  tripId,
  status,
  advanceClearedForTransit = true,
  vendorAllocated = false,
  podState = null,
}: {
  tripId: string;
  status: string;
  advanceClearedForTransit?: boolean;
  vendorAllocated?: boolean;
  podState?: "PENDING_VERIFICATION" | "BAD_POD" | "VERIFIED" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const next = NEXT[status];
  const transitBlocked =
    next?.status === "IN_TRANSIT" && vendorAllocated && !advanceClearedForTransit;

  async function update(newStatus: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update status");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {transitBlocked && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 w-full">
          Mark In Transit is blocked until the vendor submits an advance payment request.
        </p>
      )}
      {next && !transitBlocked ? (
        <Button onClick={() => update(next.status)} disabled={busy}>
          {busy ? "Updating..." : next.label}
        </Button>
      ) : status === "DELIVERED" ? (
        <p className="text-sm text-slate-500">
          {podState === "PENDING_VERIFICATION"
            ? "POD uploaded — awaiting verification. Trip closes automatically when POD is verified."
            : podState === "BAD_POD"
              ? "POD rejected — a corrected POD must be uploaded. Trip closes automatically when POD is verified."
              : "Delivered — awaiting POD upload. Trip closes automatically when POD is verified."}
        </p>
      ) : status === "CLOSED" ? (
        <p className="text-sm text-slate-500">
          POD verified — trip closed. Create invoice from the Invoices page.
        </p>
      ) : status === "INVOICED" ? (
        <p className="text-sm text-slate-500">Invoiced — billing complete.</p>
      ) : (
        <p className="text-sm text-slate-500">No further action.</p>
      )}
      {status !== "CANCELLED" && status !== "CLOSED" && status !== "INVOICED" && (
        <button
          onClick={() => update("CANCELLED")}
          disabled={busy}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Cancel trip
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
