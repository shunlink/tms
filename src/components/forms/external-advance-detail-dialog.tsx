"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatINR, formatDate } from "@/lib/utils";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type ExternalAdvanceRow = {
  id: string;
  requestNumber: string;
  status: string;
  externalProvider: string | null;
  requestedAmount: number;
  approvedAmount: number | null;
  requestedAt: string | Date;
  externalReference: string | null;
  processingRemarks: string | null;
  vendor: { name: string };
  trip: { id: string; lrNumber: string; route: string } | null;
};

export default function ExternalAdvanceDetailDialog({
  request,
  canEdit,
  open,
  onClose,
}: {
  request: ExternalAdvanceRow;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [requestedAmount, setRequestedAmount] = useState(
    request.requestedAmount > 0 ? String(request.requestedAmount) : ""
  );
  const [approvedAmount, setApprovedAmount] = useState(
    request.approvedAmount != null ? String(request.approvedAmount) : ""
  );
  const [externalReference, setExternalReference] = useState(request.externalReference ?? "");
  const [remarks, setRemarks] = useState(request.processingRemarks ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRequestedAmount(request.requestedAmount > 0 ? String(request.requestedAmount) : "");
    setApprovedAmount(request.approvedAmount != null ? String(request.approvedAmount) : "");
    setExternalReference(request.externalReference ?? "");
    setRemarks(request.processingRemarks ?? "");
  }, [open, request.id, request.requestedAmount, request.approvedAmount, request.externalReference, request.processingRemarks]);

  if (!open) return null;

  async function save() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/advance-requests/${request.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_external",
        requestedAmount: requestedAmount ? Number(requestedAmount) : undefined,
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        externalReference,
        remarks,
      }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Update failed" });
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{request.requestNumber}</h3>
            <StatusBadge status={request.status} />
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Vendor</p>
              <p className="font-medium">{request.vendor.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Trip</p>
              {request.trip ? (
                <Link href={`/trips/${request.trip.id}`} className="font-medium text-blue-600 hover:underline">
                  {request.trip.lrNumber}
                </Link>
              ) : "—"}
            </div>
            <div>
              <p className="text-xs text-slate-500">Provider</p>
              <p className="font-medium">{request.externalProvider ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Request Date</p>
              <p className="font-medium">{formatDate(request.requestedAt)}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-md p-3">
            External provider advances are not processed by ShunLink. Record amounts and references for visibility only.
          </p>

          {canEdit && (
            <div className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount Requested (₹)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount Approved/Raised (₹)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">External Reference / Details</label>
                <input
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="Provider reference, loan ID, etc."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              <Button size="sm" disabled={busy} onClick={save}>Save</Button>
            </div>
          )}

          {!canEdit && (
            <div className="border-t pt-4 space-y-1">
              <p><span className="text-slate-500">Requested:</span> {request.requestedAmount > 0 ? formatINR(request.requestedAmount) : "—"}</p>
              <p><span className="text-slate-500">Approved/Raised:</span> {request.approvedAmount != null ? formatINR(request.approvedAmount) : "—"}</p>
              <p><span className="text-slate-500">Reference:</span> {request.externalReference ?? "—"}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
