"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";

export default function AdvancePanel({
  indentId,
  indentStatus,
  advanceStatus,
  advancePaid,
  vendorRate,
  clientRate,
  remainingVendorPayable,
  advancePaidAt,
  canConfirm,
}: {
  indentId: string;
  indentStatus: string;
  advanceStatus: string;
  advancePaid: number;
  vendorRate: number;
  clientRate: number;
  remainingVendorPayable: number;
  advancePaidAt?: string | Date | null;
  canConfirm: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPaid = advanceStatus === "PAID";
  const vendorPayable = vendorRate > 0 ? vendorRate : 0;
  const payableLabel =
    vendorPayable > 0 ? formatINR(vendorPayable) : clientRate > 0 ? `${formatINR(clientRate)} (client rate)` : "—";
  const canEnter =
    canConfirm &&
    !isPaid &&
    ["DRAFT", "WAITING_FOR_ADVANCE", "ADVANCE_PENDING"].includes(indentStatus);

  async function confirm() {
    setError("");
    const value = amount === "" ? 0 : Number(amount);
    if (Number.isNaN(value) || value < 0) {
      setError("Enter a valid amount (0 or more)");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", amount: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to confirm advance");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vendor payable</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{payableLabel}</p>
          {vendorPayable === 0 && clientRate > 0 && (
            <p className="text-xs text-slate-500 mt-1">Final vendor payable is set after allocation.</p>
          )}
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining payable</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {vendorPayable > 0 ? formatINR(remainingVendorPayable) : "—"}
          </p>
        </div>
      </div>

      {isPaid ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm space-y-1">
          <p className="font-medium text-green-900">Advance confirmed — {formatINR(advancePaid)}</p>
          {advancePaidAt && <p className="text-green-800">Confirmed on {formatDate(advancePaidAt)}</p>}
          <p className="text-green-800 text-xs mt-2">
            This amount is visible to vendors when the indent is released or allocated.
          </p>
        </div>
      ) : canEnter ? (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <p className="text-sm text-slate-600">
            Enter the advance amount to pay the vendor. Use 0 if no advance is needed.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 mb-1">Advance amount (₹)</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button disabled={busy} onClick={confirm}>Proceed</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Advance cannot be changed at this stage.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
