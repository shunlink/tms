"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type VendorOption = { id: string; name: string };

export default function ReallocateVendorDialog({
  indentId,
  currentVendorName,
  vendors,
  open,
  onClose,
}: {
  indentId: string;
  currentVendorName: string;
  vendors: VendorOption[];
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [vendorRate, setVendorRate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function confirm() {
    if (!vendorId || !reason.trim()) {
      setError("Select a new vendor and provide a reason");
      return;
    }
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/allocate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        vendorRate: vendorRate ? Number(vendorRate) : undefined,
        reason,
      }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Reallocation failed" });
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg border p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Reallocate Vendor</h3>

        <div className="text-sm space-y-2 text-slate-600">
          <p>
            <span className="text-slate-500">Current vendor:</span>{" "}
            <span className="font-medium text-slate-900">{currentVendorName}</span>
          </p>
          <p className="text-xs text-slate-500">What happens:</p>
          <ul className="text-xs list-disc pl-4 space-y-1">
            <li>Current vendor allocation will be closed</li>
            <li>Current placement will be closed</li>
            <li>Current vehicle/driver assignment will be cleared</li>
            <li>A new placement will be created for the new vendor</li>
            <li>Vehicle/driver details unlock only after the new vehicle reaches placement</li>
          </ul>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Select new vendor</label>
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
            <label className="text-xs text-slate-500 block mb-1">Vendor rate (INR)</label>
            <input
              type="number"
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. 45000"
              value={vendorRate}
              onChange={(e) => setVendorRate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reason for reallocation</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Vendor did not provide vehicle"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={confirm}>
            {busy ? "Reallocating..." : "Confirm Reallocation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
