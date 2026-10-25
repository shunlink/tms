"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatINR } from "@/lib/utils";
import { Truck } from "lucide-react";
import ReallocateVendorDialog from "@/components/forms/reallocate-vendor-dialog";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type VendorOption = { id: string; name: string };

export default function VendorAllocationPanel({
  indentId,
  indentStatus,
  allocationMode,
  vendorAllocated,
  vendor,
  allocatedAt,
  allocatedBy,
  placementStatus,
  placementDeadlineAt,
  agreedVendorRate,
  vendors,
  canAllocate,
  canReallocate = false,
  allocatedVendorId,
  vehicleQuantity = 1,
}: {
  indentId: string;
  indentStatus: string;
  allocationMode: string;
  vendorAllocated: boolean;
  vendor?: { name: string; phone?: string | null } | null;
  allocatedAt?: string | Date | null;
  allocatedBy?: { name: string | null } | null;
  placementStatus?: string | null;
  placementDeadlineAt?: string | Date | null;
  agreedVendorRate?: number | null;
  vendors: VendorOption[];
  canAllocate: boolean;
  canReallocate?: boolean;
  allocatedVendorId?: string | null;
  vehicleQuantity?: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState(allocationMode === "MANUAL" ? "MANUAL" : "BIDDING");
  useEffect(() => {
    setMode(allocationMode === "MANUAL" ? "MANUAL" : "BIDDING");
  }, [allocationMode]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [quotedRate, setQuotedRate] = useState("");
  const [reallocateOpen, setReallocateOpen] = useState(false);

  const canEditMode =
    canAllocate &&
    !vendorAllocated &&
    ["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING", "ADVANCE_PAID"].includes(indentStatus);

  const showManualForm =
    canAllocate && mode === "MANUAL" && !vendorAllocated;

  async function toggleMode(next: "BIDDING" | "MANUAL") {
    if (next === mode) return;
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/allocation-mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to update allocation mode" });
      return;
    }
    setMode(next);
    router.refresh();
  }

  async function manualAllocate() {
    if (!vendorId || !quotedRate) {
      setError("Select a vendor and enter a quoted rate");
      return;
    }
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        vendorRate: Number(quotedRate),
      }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to allocate vendor" });
      return;
    }
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-600" /> Vendor Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEditMode && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">Allocation mode:</span>
            <div className="inline-flex rounded-lg border p-0.5 bg-slate-50">
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleMode("BIDDING")}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  mode === "BIDDING"
                    ? "bg-white shadow text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Bidding
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleMode("MANUAL")}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  mode === "MANUAL"
                    ? "bg-white shadow text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Manual
              </button>
            </div>
            <span className="text-xs text-slate-500">
              {mode === "BIDDING"
                ? "Release to vendors and collect quotes"
                : "Assign vendor and quoted rate directly"}
            </span>
            {vehicleQuantity > 1 && (
              <span className="text-xs text-slate-500">
                Allocates the same vendor to all {vehicleQuantity} vehicle slots.
              </span>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {vendorAllocated ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Vendor</p>
              <p className="font-medium">{vendor?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Contact</p>
              <p className="font-medium">{vendor?.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Allocated At</p>
              <p className="font-medium">{allocatedAt ? formatDate(allocatedAt) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Allocated By</p>
              <p className="font-medium">{allocatedBy?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Placement</p>
              <p className="font-medium">{placementStatus?.replace(/_/g, " ") ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Placement Deadline</p>
              <p className="font-medium">
                {placementDeadlineAt ? formatDate(placementDeadlineAt) : "—"}
              </p>
            </div>
          </div>
        ) : showManualForm ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Vendor</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Quoted rate (₹)</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. 45000"
                  value={quotedRate}
                  onChange={(e) => setQuotedRate(e.target.value)}
                />
              </div>
              <Button disabled={busy} onClick={manualAllocate}>
                Allocate Vendor
              </Button>
            </div>
          </div>
        ) : mode === "BIDDING" && !vendorAllocated ? (
          <p className="text-sm text-slate-500">
            Release this indent to vendors to collect quotes, then allocate the winning bid.
          </p>
        ) : null}

        {vendorAllocated && agreedVendorRate != null && agreedVendorRate > 0 && (
          <p className="text-sm text-slate-600">
            Agreed rate: <span className="font-semibold text-green-700">{formatINR(agreedVendorRate)}</span>
          </p>
        )}

        {vendorAllocated && canReallocate && vendor?.name && (
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setReallocateOpen(true)}>
              Reallocate Vendor
            </Button>
          </div>
        )}

        {reallocateOpen && vendor?.name && (
          <ReallocateVendorDialog
            indentId={indentId}
            currentVendorName={vendor.name}
            vendors={vendors.filter((v) => v.id !== allocatedVendorId)}
            open={reallocateOpen}
            onClose={() => setReallocateOpen(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
