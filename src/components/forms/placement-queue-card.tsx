"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import ReallocateVendorDialog from "@/components/forms/reallocate-vendor-dialog";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type PlacementItem = {
  id: string;
  indentNumber: string;
  client: string;
  route: string;
  vendor: string | null;
  allocatedAt: string | Date | null;
  deadlineAt: string | Date | null;
  placementStatus: string | null;
  status: string;
  placementProgress?: string;
  vehicleQuantity?: number;
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PlacementQueueCard({
  item,
  vendors,
  canAct,
  compact = false,
}: {
  item: PlacementItem;
  vendors: Array<{ id: string; name: string }>;
  canAct: boolean;
  compact?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reallocateOpen, setReallocateOpen] = useState(false);

  const deadline = item.deadlineAt ? new Date(item.deadlineAt).getTime() : null;
  const failed = item.placementStatus === "PLACEMENT_FAILED";
  const multiVehicle = (item.vehicleQuantity ?? 1) > 1;
  const vehicleReached =
    item.placementStatus === "VEHICLE_REACHED" ||
    item.status === "VEHICLE_PLACED" ||
    item.placementStatus === "PARTIALLY_REACHED";

  useEffect(() => {
    if (!deadline || failed) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline, failed]);

  async function markReached() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${item.id}/placement/vehicle-reached`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vehicle_reached" }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Action failed" });
      return;
    }
    router.refresh();
  }

  return (
    <Card className={compact ? "h-full flex flex-col" : undefined}>
      <CardHeader className={compact ? "pb-2 p-4" : "pb-2"}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className={compact ? "text-base" : undefined}>
              <Link href={`/indents/${item.id}`} className="hover:underline">
                {item.indentNumber}
              </Link>
            </CardTitle>
            <p className={`text-muted-foreground truncate ${compact ? "text-xs mt-0.5" : "text-sm"}`}>
              {item.client}
            </p>
            <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>{item.route}</p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
              failed ? "bg-red-100 text-red-700" : vehicleReached ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {vehicleReached ? "REACHED" : item.placementStatus?.replace(/_/g, " ") ?? "—"}
          </span>
        </div>
      </CardHeader>
      <CardContent className={`text-sm space-y-2 flex-1 flex flex-col ${compact ? "p-4 pt-0" : ""}`}>
        <p className={compact ? "text-xs" : undefined}>
          Vendor: <span className="font-medium">{item.vendor ?? "—"}</span>
        </p>
        <p className={compact ? "text-xs" : undefined}>
          Allocated: {item.allocatedAt ? formatDate(item.allocatedAt) : "—"}
        </p>
        {item.placementProgress && (
          <p className={compact ? "text-xs text-slate-600" : "text-sm text-slate-600"}>
            Placement: {item.placementProgress}
          </p>
        )}
        <p className={failed ? "text-red-600 font-medium text-xs" : compact ? "font-mono text-sm" : "font-mono text-lg"}>
          {failed
            ? "Deadline exceeded"
            : remaining != null
              ? formatCountdown(remaining)
              : "—"}
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="mt-auto pt-2 space-y-2">
          {canAct && !vehicleReached && (
            <div className="flex flex-col gap-1.5">
              {!multiVehicle && (
                <Button size="sm" variant="outline" disabled={busy} onClick={markReached} className="w-full">
                  Vehicle Reached
                </Button>
              )}
              {multiVehicle && (
                <Link href={`/indents/${item.id}`} className="block">
                  <Button size="sm" variant="outline" className="w-full">Manage vehicles</Button>
                </Link>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setReallocateOpen((v) => !v)} className="w-full">
                Reallocate
              </Button>
            </div>
          )}

          {canAct && vehicleReached && !multiVehicle && (
            <Link href={`/indents/${item.id}`} className="block">
              <Button size="sm" className="w-full">Create Trip</Button>
            </Link>
          )}
        </div>

        {reallocateOpen && item.vendor && (
          <ReallocateVendorDialog
            indentId={item.id}
            currentVendorName={item.vendor}
            vendors={vendors}
            open={reallocateOpen}
            onClose={() => setReallocateOpen(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
