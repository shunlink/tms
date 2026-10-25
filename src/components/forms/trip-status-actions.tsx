"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

const NEXT: Record<string, { label: string; status: string }> = {
  PENDING: { label: "Mark Dispatched", status: "DISPATCHED" },
  DISPATCHED: { label: "Mark In Transit", status: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Mark Delivered", status: "DELIVERED" },
};

export default function TripStatusActions({
  tripId,
  status,
  podState = null,
}: {
  tripId: string;
  status: string;
  podState?: "PENDING_VERIFICATION" | "BAD_POD" | "VERIFIED" | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const next = NEXT[status];

  async function update(newStatus: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to update status" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {next ? (
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
