"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatINR, formatDate } from "@/lib/utils";
import { ADVANCE_PAYMENT_METHODS } from "@/lib/advance-payment-methods";
import GatewayPaySection, { type GatewayTransfer } from "@/components/payments/gateway-pay-section";
import { PermissionAction } from "@/components/permission-action";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type AdvanceRequestRow = {
  id: string;
  vendorId: string;
  requestNumber: string;
  status: string;
  requestedAmount: number;
  negotiatedAmount: number | null;
  approvedAmount: number | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  paymentDate: string | Date | null;
  utrReference: string | null;
  bankAccountUsed: string | null;
  voucherNumber: string | null;
  requestedAt: string | Date;
  deadlineAt: string | Date;
  slaBreached: boolean;
  slaRemainingMs: number;
  source?: string;
  sourceLabel?: string;
  raisedByLabel?: string;
  vendor: { name: string };
  trip: {
    id: string;
    lrNumber: string;
    route: string;
    client: string;
    indentId: string | null;
    indentNumber: string | null;
  } | null;
  paymentProof: { url: string; fileName: string | null } | null;
  voucher: { url: string; fileName: string | null } | null;
  events: Array<{
    action: string;
    amount: number | null;
    remarks: string | null;
    createdAt: string | Date;
    actor: { name: string | null } | null;
  }>;
  gatewayTransfers?: GatewayTransfer[];
};

function formatSlaRemaining(ms: number) {
  if (ms <= 0) return "SLA Breached";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `Due in ${hours}h ${minutes}m`;
}

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export default function AdvanceRequestDetailDialog({
  request,
  canDecide,
  canProcess,
  canMarkPaid,
  currentUserId,
  open,
  onClose,
}: {
  request: AdvanceRequestRow;
  canDecide: boolean;
  canProcess: boolean;
  canMarkPaid: boolean;
  currentUserId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const proofRef = useRef<HTMLInputElement>(null);
  const [liveRequest, setLiveRequest] = useState(request);
  const [negotiateAmount, setNegotiateAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [paidAmount, setPaidAmount] = useState(
    String(request.paidAmount ?? request.approvedAmount ?? request.negotiatedAmount ?? request.requestedAmount)
  );
  const [paymentMethod, setPaymentMethod] = useState(request.paymentMethod ?? "NEFT");
  const [paymentDate, setPaymentDate] = useState(toDateInput(request.paymentDate));
  const [utrReference, setUtrReference] = useState(request.utrReference ?? "");
  const [bankAccountUsed, setBankAccountUsed] = useState(request.bankAccountUsed ?? "");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNegotiate, setShowNegotiate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLiveRequest(request);
    setPaidAmount(
      String(request.paidAmount ?? request.approvedAmount ?? request.negotiatedAmount ?? request.requestedAmount)
    );
    setPaymentMethod(request.paymentMethod ?? "NEFT");
    setPaymentDate(toDateInput(request.paymentDate));
    setUtrReference(request.utrReference ?? "");
    setBankAccountUsed(request.bankAccountUsed ?? "");
    setRemarks("");
    setPaymentNotes("");
    setShowNegotiate(false);
    setError("");
  }, [open, request]);

  if (!open) return null;

  const approvedCap =
    liveRequest.approvedAmount ?? liveRequest.negotiatedAmount ?? liveRequest.requestedAmount;

  async function actJson(action: string, extra: Record<string, unknown> = {}) {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/advance-requests/${liveRequest.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, remarks, ...extra }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Action failed" });
      return;
    }
    onClose();
    router.refresh();
  }

  async function submitPayment(action: "process" | "mark_processed") {
    setError("");
    const proof = proofRef.current?.files?.[0];
    if (action === "mark_processed" && !proof && !liveRequest.paymentProof) {
      setError("Payment proof is required");
      return;
    }

    setBusy(true);
    const form = new FormData();
    form.append("action", action);
    form.append("paidAmount", paidAmount);
    form.append("paymentMethod", paymentMethod);
    form.append("paymentDate", paymentDate);
    form.append("utrReference", utrReference);
    if (bankAccountUsed) form.append("bankAccountUsed", bankAccountUsed);
    if (paymentNotes) form.append("remarks", paymentNotes);
    if (proof) form.append("proof", proof);

    const res = await fetch(`/api/advance-requests/${liveRequest.id}`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Payment action failed" });
      return;
    }
    onClose();
    router.refresh();
  }

  const showDecideActions = ["PENDING_REVIEW", "SLA_BREACHED"].includes(liveRequest.status);
  const showRejectAction = ["PENDING_REVIEW", "NEGOTIATED", "SLA_BREACHED"].includes(liveRequest.status);
  const canEnterPayment = ["APPROVED", "VENDOR_ACCEPTED", "SLA_BREACHED", "PROCESSING"].includes(liveRequest.status);
  const isProcessed = liveRequest.status === "PROCESSED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          </div>
        )}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{liveRequest.requestNumber}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusBadge status={liveRequest.status} />
              {liveRequest.slaBreached && <StatusBadge status="SLA_BREACHED" />}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Vendor</p>
              <p className="font-medium">{liveRequest.vendor.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Source</p>
              <p className="font-medium">{liveRequest.sourceLabel ?? (liveRequest.source === "INTERNAL" ? "Internal" : "Vendor")}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Raised by</p>
              <p className="font-medium">{liveRequest.raisedByLabel ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Trip</p>
              {liveRequest.trip ? (
                <Link href={`/trips/${liveRequest.trip.id}`} className="font-medium text-blue-600 hover:underline">
                  {liveRequest.trip.lrNumber}
                </Link>
              ) : "—"}
              {liveRequest.trip && <p className="text-xs text-slate-500">{liveRequest.trip.route} · {liveRequest.trip.client}</p>}
            </div>
            {liveRequest.trip?.indentNumber && (
              <div>
                <p className="text-xs text-slate-500">Indent</p>
                <Link href={`/indents/${liveRequest.trip.indentId}`} className="font-medium text-blue-600 hover:underline">
                  {liveRequest.trip.indentNumber}
                </Link>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500">Requested</p>
              <p className="font-medium">{formatINR(liveRequest.requestedAmount)}</p>
            </div>
            {liveRequest.negotiatedAmount != null && (
              <div>
                <p className="text-xs text-slate-500">Negotiated</p>
                <p className="font-medium text-amber-700">{formatINR(liveRequest.negotiatedAmount)}</p>
              </div>
            )}
            {liveRequest.approvedAmount != null && (
              <div>
                <p className="text-xs text-slate-500">Approved</p>
                <p className="font-medium text-green-700">{formatINR(liveRequest.approvedAmount)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500">Requested at</p>
              <p className="font-medium">{formatDate(liveRequest.requestedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">SLA deadline</p>
              <p className={`font-medium ${liveRequest.slaBreached ? "text-red-600" : ""}`}>
                {formatDate(liveRequest.deadlineAt)}
              </p>
              <p className="text-xs text-slate-500">
                {liveRequest.slaBreached ? "SLA Breached" : formatSlaRemaining(liveRequest.slaRemainingMs)}
              </p>
            </div>
          </div>

          {isProcessed && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2 text-sm">
              <p className="font-medium text-green-900">Payment completed</p>
              <p>Amount paid: {formatINR(liveRequest.paidAmount ?? 0)}</p>
              <p>Method: {liveRequest.paymentMethod ?? "—"} · UTR: {liveRequest.utrReference ?? "—"}</p>
              <p>Payment date: {liveRequest.paymentDate ? formatDate(liveRequest.paymentDate) : "—"}</p>
              {liveRequest.voucherNumber && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/advance-payments/${liveRequest.id}/voucher`}>
                    <Button size="sm" variant="outline">View / Download Voucher</Button>
                  </Link>
                  {liveRequest.paymentProof?.url && (
                    <a href={liveRequest.paymentProof.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">View Payment Proof</Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {showNegotiate ? (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Negotiate amount</p>
              <input
                type="number"
                min={1}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Negotiated amount (₹)"
                value={negotiateAmount}
                onChange={(e) => setNegotiateAmount(e.target.value)}
              />
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Remarks (optional)"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => actJson("negotiate", { negotiatedAmount: Number(negotiateAmount) })}
                >
                  Submit Negotiation
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowNegotiate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {showDecideActions && (
                <>
                  <PermissionAction
                    size="sm"
                    allowed={canDecide}
                    disabled={busy}
                    onClick={() => actJson("approve")}
                  >
                    Approve
                  </PermissionAction>
                  <PermissionAction
                    size="sm"
                    variant="outline"
                    allowed={canDecide}
                    disabled={busy}
                    onClick={() => setShowNegotiate(true)}
                  >
                    Negotiate
                  </PermissionAction>
                </>
              )}
              {showRejectAction && (
                <PermissionAction
                  size="sm"
                  variant="outline"
                  allowed={canDecide}
                  disabled={busy}
                  onClick={() => actJson("reject")}
                >
                  Reject
                </PermissionAction>
              )}
            </div>
          )}

          {canEnterPayment && !isProcessed && (canProcess || canMarkPaid) && (
            <GatewayPaySection
              vendorId={liveRequest.vendorId}
              contextType="advance"
              contextId={liveRequest.id}
              maxAmount={approvedCap}
              canProcess={canProcess || canMarkPaid}
              canApprove={canDecide}
              currentUserId={currentUserId}
              activeTransfers={liveRequest.gatewayTransfers ?? []}
              onWorkflowComplete={onClose}
            />
          )}

          {canEnterPayment && !isProcessed && (canProcess || canMarkPaid) && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Record manual payment (offline)</p>
              <p className="text-xs text-slate-500">Approved cap: {formatINR(approvedCap)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount to Pay *</label>
                  <input
                    type="number"
                    min={1}
                    max={approvedCap}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method *</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {ADVANCE_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">UTR / Transaction Reference *</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={utrReference}
                    onChange={(e) => setUtrReference(e.target.value)}
                    placeholder="UTR1234567890"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bank / Account Used</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={bankAccountUsed}
                    onChange={(e) => setBankAccountUsed(e.target.value)}
                    placeholder="e.g. HDFC Current A/C"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Proof *</label>
                  <input ref={proofRef} type="file" accept="image/*,.pdf" className="w-full text-sm" />
                  {liveRequest.paymentProof?.url && (
                    <a href={liveRequest.paymentProof.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                      Current proof on file
                    </a>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canProcess && liveRequest.status !== "PROCESSING" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => submitPayment("process")}>
                    Save & Start Processing
                  </Button>
                )}
                {canMarkPaid && (
                  <Button size="sm" disabled={busy} onClick={() => submitPayment("mark_processed")}>
                    Mark Payment as Processed
                  </Button>
                )}
              </div>
            </div>
          )}

          {liveRequest.events.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">History</p>
              <ul className="space-y-2 text-sm">
                {liveRequest.events.map((e, i) => (
                  <li key={i} className="border-l-2 border-slate-200 pl-3">
                    <p className="font-medium">{e.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(e.createdAt)}
                      {e.actor?.name ? ` · ${e.actor.name}` : ""}
                      {e.amount != null ? ` · ${formatINR(e.amount)}` : ""}
                    </p>
                    {e.remarks && <p className="text-xs text-slate-600">{e.remarks}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
