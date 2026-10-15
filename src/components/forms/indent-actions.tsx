"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ReleaseVendorsDialog from "@/components/forms/release-vendors-dialog";

export default function IndentActions({
  indentId,
  indentNumber,
  status,
  advanceStatus,
  allocationMode = "BIDDING",
  hasTrip = false,
  hasVehicle = false,
  hasDriver = false,
  driverVerified = false,
  vendorAllocated = false,
  advanceClearedForTransit = true,
  canReleasePermission = true,
}: {
  indentId: string;
  indentNumber: string;
  status: string;
  advanceStatus: string;
  allocationMode?: string;
  hasTrip?: boolean;
  hasVehicle?: boolean;
  hasDriver?: boolean;
  driverVerified?: boolean;
  vendorAllocated?: boolean;
  advanceClearedForTransit?: boolean;
  canReleasePermission?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);

  const canRelease =
    canReleasePermission &&
    allocationMode !== "MANUAL" &&
    (["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING", "ADVANCE_PAID", "RELEASED_TO_VENDORS", "QUOTING"].includes(status));

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed");
      return;
    }
    router.refresh();
  }

  async function placement() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/placement/vehicle-reached`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vehicle_reached" }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed");
      return;
    }
    router.refresh();
  }

  async function createTrip() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/create-trip`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create trip");
      return;
    }
    router.refresh();
  }

  const buttons: { label: string; onClick: () => void; variant?: "default" | "outline" }[] = [];
  if (canRelease) {
    buttons.push({
      label: ["RELEASED_TO_VENDORS", "QUOTING"].includes(status) ? "Release to More Cities" : "Release to Vendors",
      onClick: () => setReleaseOpen(true),
    });
  }
  if (status === "PLACEMENT_PENDING") {
    buttons.push({ label: "Mark Vehicle Reached", onClick: placement });
  }
  const tripReady =
    status === "DRIVER_ASSIGNED" &&
    !hasTrip &&
    hasVehicle &&
    hasDriver &&
    driverVerified;

  if (tripReady) {
    buttons.push({
      label: "Create Trip & Generate LR",
      onClick: createTrip,
      variant: "default",
    });
  }
  if (status === "DRIVER_ASSIGNED") {
    const transitBlocked = vendorAllocated && !advanceClearedForTransit;
    if (!transitBlocked) {
      buttons.push({ label: "Start Transit", onClick: () => act("transition", { status: "IN_TRANSIT" }) });
    }
  }
  if (status === "IN_TRANSIT") buttons.push({ label: "Mark Delivered", onClick: () => act("transition", { status: "DELIVERED" }) });
  if (status === "DELIVERED") buttons.push({ label: "Move to POD", onClick: () => act("transition", { status: "POD_PENDING" }) });
  if (status === "POD_RECEIVED") buttons.push({ label: "Complete Indent", onClick: () => act("complete") });
  if (!["POD_RECEIVED", "COMPLETED", "CANCELLED"].includes(status)) {
    buttons.push({ label: "Cancel", onClick: () => act("cancel") });
  }

  if (buttons.length === 0 && !releaseOpen) return null;

  const transitBlocked =
    status === "DRIVER_ASSIGNED" && vendorAllocated && !advanceClearedForTransit;

  return (
    <div className="space-y-3">
      {transitBlocked && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Start Transit is blocked until the vendor submits an advance payment request.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <Button
            key={b.label}
            size="sm"
            variant={b.variant ?? "outline"}
            disabled={busy}
            onClick={b.onClick}
          >
            {b.label}
          </Button>
        ))}
      </div>
      <ReleaseVendorsDialog
        indentId={indentId}
        indentNumber={indentNumber}
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        canRelease={canRelease}
      />
    </div>
  );
}
