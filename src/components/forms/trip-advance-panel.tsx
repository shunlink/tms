"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/status-badge";
import { useToast } from "@/components/toast";
import { showWarning } from "@/lib/toast-utils";
import { maxAdvanceForVendorRate } from "@/lib/advance-limits";
import { formatINR, formatDate } from "@/lib/utils";
import { IndianRupee } from "lucide-react";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
type AdvanceRequest = {
  id: string;
  requestNumber: string;
  status: string;
  requestedAmount: number;
  negotiatedAmount: number | null;
  approvedAmount: number | null;
  requestedAt: string | Date;
  deadlineAt: string | Date;
  slaBreached: boolean;
  slaRemainingMs: number;
  negotiationRemarks: string | null;
  voucherNumber: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  utrReference: string | null;
};

const REOPEN_STATUSES = new Set(["REJECTED", "CANCELLED"]);

/** Vendor cannot submit another ShunLink advance while one of these is active. */
const ADVANCE_IN_FLIGHT_STATUSES = new Set([
  "PENDING_REVIEW",
  "NEGOTIATED",
  "VENDOR_ACCEPTED",
  "APPROVED",
  "PROCESSING",
  "SLA_BREACHED",
]);

function formatSlaRemaining(ms: number) {
  if (ms <= 0) return "SLA Breached";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `Due in ${hours}h ${minutes}m`;
}

export default function TripAdvancePanel({
  tripId,
  vendorRate,
  initialRequest,
  advanceWindowOpen = true,
  advanceWindowClosedReason = null,
}: {
  tripId: string;
  vendorRate: number;
  initialRequest: AdvanceRequest | null;
  advanceWindowOpen?: boolean;
  advanceWindowClosedReason?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [request, setRequest] = useState(initialRequest);
  const [mode, setMode] = useState<"choose" | "shunlink" | "external">("choose");
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("NAVI");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const maxAdvance = maxAdvanceForVendorRate(vendorRate);

  useEffect(() => {
    setRequest(initialRequest);
  }, [initialRequest]);

  const canRequestNew =
    advanceWindowOpen && (!request || REOPEN_STATUSES.has(request.status));
  const showActiveRequest = request && !canRequestNew;
  const showNegotiation = request?.status === "NEGOTIATED" && request.negotiatedAmount != null;
  const isUnderFinanceReview = request?.status === "PENDING_REVIEW" || request?.status === "SLA_BREACHED";
  const isAdvanceProcessing =
    request != null &&
    ["APPROVED", "VENDOR_ACCEPTED", "PROCESSING"].includes(request.status);
  const isAdvanceInFlight =
    request != null && ADVANCE_IN_FLIGHT_STATUSES.has(request.status);

  async function submitShunLink() {
    setError("");
    const value = Number(amount);
    if (!value || value <= 0) {
      showWarning(toast, "Enter a valid amount greater than zero");
      return;
    }
    if (vendorRate > 0 && value > maxAdvance) {
      showWarning(
        toast,
        "Amount exceeds limit",
        `You can request up to 85% of your trip freight (${formatINR(maxAdvance)}). Please enter a lesser amount.`
      );
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/portal/vendor/trips/${tripId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "SHUNLINK", requestedAmount: value }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to submit advance request" });
      return;
    }
    const body = data as { request?: AdvanceRequest };
    setRequest(body.request ?? (data as AdvanceRequest));
    setMode("choose");
    router.refresh();
  }

  async function submitExternal() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/portal/vendor/trips/${tripId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "EXTERNAL", externalProvider: provider }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to record external provider choice" });
      return;
    }
    const body = data as { request?: AdvanceRequest };
    setRequest(body.request ?? (data as AdvanceRequest));
    setMode("choose");
    router.refresh();
  }

  async function acceptNegotiation() {
    if (!request) return;
    setError("");
    setBusy(true);
    const res = await fetch(`/api/portal/vendor/trips/${tripId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept_negotiation", requestId: request.id }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to accept negotiated amount" });
      return;
    }
    const body = data as { request?: AdvanceRequest };
    setRequest(body.request ?? (data as AdvanceRequest));
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-amber-600" /> Advance Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {request?.status === "EXTERNAL" ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
            <p className="font-medium text-blue-900">External finance provider selected</p>
            <p className="text-blue-800 mt-1">
              You chose to request advance through an external provider. This is not processed by ShunLink Finance.
            </p>
          </div>
        ) : showActiveRequest ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">{request.requestNumber}</span>
              <StatusBadge status={request.status} />
              {request.slaBreached && <StatusBadge status="SLA_BREACHED" />}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Requested</p>
                <p className="font-medium">{formatINR(request.requestedAmount)}</p>
              </div>
              {request.negotiatedAmount != null && (
                <div>
                  <p className="text-xs text-slate-500">Offered by ShunLink</p>
                  <p className="font-medium text-amber-700">{formatINR(request.negotiatedAmount)}</p>
                </div>
              )}
              {request.approvedAmount != null && request.status !== "NEGOTIATED" && (
                <div>
                  <p className="text-xs text-slate-500">Approved</p>
                  <p className="font-medium text-green-700">{formatINR(request.approvedAmount)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">Requested at</p>
                <p className="font-medium">{formatDate(request.requestedAt)}</p>
              </div>
              {!["PROCESSED", "REJECTED"].includes(request.status) && (
                <div>
                  <p className="text-xs text-slate-500">SLA</p>
                  <p className={`font-medium ${request.slaBreached ? "text-red-600" : "text-slate-900"}`}>
                    {request.slaBreached ? "SLA Breached" : formatSlaRemaining(request.slaRemainingMs)}
                  </p>
                </div>
              )}
            </div>

            {isUnderFinanceReview && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-1">
                <p className="font-medium">Advance under review</p>
                <p>
                  Your request for {formatINR(request.requestedAmount)} is with ShunLink Finance. You cannot
                  submit another advance on this trip until this request is paid or rejected.
                </p>
                <p className="text-xs text-amber-800">
                  You may still run the trip while Finance reviews your request.
                </p>
              </div>
            )}

            {isAdvanceProcessing && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 space-y-1">
                <p className="font-medium">Advance payment processing</p>
                <p>
                  Your advance of{" "}
                  {formatINR(request.approvedAmount ?? request.negotiatedAmount ?? request.requestedAmount)}{" "}
                  is approved.
                  {request.status === "PROCESSING"
                    ? " Finance is completing the bank transfer now."
                    : " Finance will release payment shortly."}
                </p>
                <p className="text-xs text-blue-800">Another advance request is not allowed on this trip.</p>
              </div>
            )}

            {request.status === "NEGOTIATED" && !showNegotiation && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                ShunLink has proposed a revised advance amount. Accept the offer below to continue.
              </div>
            )}

            {showNegotiation && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm text-amber-900">
                  Advance amount offered by ShunLink: <strong>{formatINR(request.negotiatedAmount!)}</strong>
                </p>
                {request.negotiationRemarks && (
                  <p className="text-xs text-amber-800">{request.negotiationRemarks}</p>
                )}
                <Button size="sm" disabled={busy} onClick={acceptNegotiation}>
                  Accept &amp; proceed
                </Button>
              </div>
            )}

            {request.status === "PROCESSED" && (
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  Your advance of {request.paidAmount != null ? formatINR(request.paidAmount) : "the approved amount"} has been processed.
                </p>
                {request.voucherNumber && (
                  <Link href={`/portal/vendor/advances/${request.id}/voucher`}>
                    <Button size="sm" variant="outline">Download Payment Voucher</Button>
                  </Link>
                )}
                {request.paymentMethod && request.utrReference && (
                  <p className="text-xs text-slate-500">
                    Paid via {request.paymentMethod} · Ref {request.utrReference}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : !advanceWindowOpen && !showActiveRequest ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
            <p className="font-medium">Advance request window closed</p>
            <p>{advanceWindowClosedReason ?? "This trip has been marked delivered."}</p>
            <p className="text-xs text-slate-600">
              If you did not take an advance during the trip, your full balance freight will be paid after POD
              verification.
            </p>
            <Link href="/portal/vendor/payments">
              <Button size="sm" variant="outline">View payments</Button>
            </Link>
          </div>
        ) : canRequestNew && !isAdvanceInFlight ? (
          <>
            {mode === "choose" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Optional: request an advance anytime while this trip is not yet delivered. You do not need an
                  advance to run the load. Your freight: {formatINR(vendorRate)} · Max advance (85%):{" "}
                  {formatINR(maxAdvance)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setMode("shunlink")}>Request from ShunLink</Button>
                  <Button size="sm" variant="outline" onClick={() => setMode("external")}>
                    Request from Finance Provider
                  </Button>
                </div>
              </div>
            )}

            {mode === "shunlink" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Enter the advance amount you need from ShunLink (max {formatINR(maxAdvance)} — 85% of your freight).
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      max={maxAdvance > 0 ? maxAdvance : undefined}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <Button disabled={busy} onClick={submitShunLink}>Submit Request</Button>
                  <Button variant="outline" disabled={busy} onClick={() => setMode("choose")}>Back</Button>
                </div>
              </div>
            )}

            {mode === "external" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Choose an external finance provider. This will not create a ShunLink advance payment request.
                </p>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm max-w-xs"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option value="NAVI">Navi</option>
                    <option value="OTHER">Other provider</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={submitExternal}>Confirm External Provider</Button>
                  <Button variant="outline" disabled={busy} onClick={() => setMode("choose")}>Back</Button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
