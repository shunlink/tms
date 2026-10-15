"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const NEXT: Record<string, { label: string; status: string }> = {
  PENDING: { label: "Start Trip (Dispatch)", status: "DISPATCHED" },
  DISPATCHED: { label: "Mark In Transit", status: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Mark Delivered", status: "DELIVERED" },
};

export default function DriverStatusActions({
  tripId,
  status,
}: {
  tripId: string;
  status: string;
}) {
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not update status");
      return;
    }
    router.refresh();
  }

  if (!next) {
    return (
      <p className="text-sm text-slate-500">
        {status === "DELIVERED" || status === "POD_RECEIVED" || status === "INVOICED" || status === "CLOSED"
          ? "Delivery complete — thank you."
          : "No action available."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full h-12 text-base" onClick={() => update(next.status)} disabled={busy}>
        {busy ? "Updating..." : next.label}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
