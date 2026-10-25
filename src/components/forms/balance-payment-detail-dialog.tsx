"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import { formatINR, formatDate } from "@/lib/utils";
import GatewayPaySection, { type GatewayTransfer } from "@/components/payments/gateway-pay-section";
import { PermissionAction } from "@/components/permission-action";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Charge = { id: string; chargeType: string; amount: number; description: string | null };

type FinancialNoteSummary = {
  id: string;
  noteNumber: string | null;
  noteType: string;
  businessPurpose: string;
  purposeLabel: string;
  totalAmount: number;
  issuedAt: string | Date | null;
  reason: string | null;
};

type BalancePaymentRow = {
  id: string;
  vendorId: string;
  status: string;
  freightAmount: number;
  additionalChargesAmount: number;
  deductionsAmount: number;
  finalPayableAmount: number;
  advanceAmount: number;
  tdsAmount: number;
  balanceAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  podVerifiedAt: string | Date;
  deadlineAt: string | Date;
  slaBreached: boolean;
  slaRemainingMs: number;
  paymentMode: string | null;
  voucherNumber: string | null;
  voucherFile: { url: string; fileName: string | null } | null;
  vendor: { name: string };
  trip: {
    id: string;
    lrNumber: string;
    route: string;
    charges?: Charge[];
  } | null;
  indent: { indentNumber: string } | null;
  processedAt: string | Date | null;
  processedBy: { name: string | null } | null;
  approvedAt: string | Date | null;
  approvedBy: { name: string | null } | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string | Date;
    paymentMode: string | null;
    utrReference: string | null;
    chequeNumber: string | null;
    recordedBy: { name: string | null } | null;
    proof: { url: string; fileName: string | null } | null;
  }>;
  events: Array<{
    action: string;
    amount: number | null;
    remarks: string | null;
    createdAt: string | Date;
    actor: { name: string | null } | null;
  }>;
  gatewayTransfers?: GatewayTransfer[];
  financialNotes?: FinancialNoteSummary[];
};

function noteAmountLabel(note: FinancialNoteSummary) {
  if (note.businessPurpose === "VENDOR_FREIGHT_REDUCTION") {
    return `− ${formatINR(note.totalAmount)} (deduction)`;
  }
  if (note.businessPurpose === "VENDOR_FREIGHT_INCREASE") {
    return `+ ${formatINR(note.totalAmount)} (additional)`;
  }
  return formatINR(note.totalAmount);
}

const ELECTRONIC = new Set(["Bank Transfer", "NEFT", "RTGS", "UPI"]);

function formatSlaRemaining(ms: number) {
  if (ms <= 0) return "SLA Breached";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `Due in ${hours}h ${minutes}m`;
}

export default function BalancePaymentDetailDialog({
  task,
  canProcess,
  canApprove,
  currentUserId,
  open,
  onClose,
}: {
  task: BalancePaymentRow;
  canProcess: boolean;
  canApprove: boolean;
  currentUserId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paymentMode, setPaymentMode] = useState(task.paymentMode ?? "Bank Transfer");
  const [utrReference, setUtrReference] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [amount, setAmount] = useState(String(task.outstandingBalance));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [chargeType, setChargeType] = useState("DETENTION");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDesc, setChargeDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [liveTask, setLiveTask] = useState(task);

  useEffect(() => {
    setLiveTask(task);
  }, [task]);

  useEffect(() => {
    if (!open) return;
    setAmount(String(liveTask.outstandingBalance));
    setPaymentMode(liveTask.paymentMode ?? "Bank Transfer");
  }, [open, liveTask.id, liveTask.outstandingBalance, liveTask.paymentMode, liveTask.deductionsAmount, liveTask.balanceAmount]);

  async function refreshTaskFromServer() {
    const res = await fetch(`/api/balance-payments/${liveTask.id}`);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { silent: true });
      return;
    }
    const row = data as BalancePaymentRow;
    setLiveTask(row);
    setAmount(String(row.outstandingBalance));
  }

  if (!open) return null;

  const view = liveTask;

  async function act(action: string, extra?: Record<string, string>) {
    setError("");
    setBusy(true);

    if (action === "record_payment") {
      const proof = fileRef.current?.files?.[0];
      if (!proof) {
        setError("Payment proof is required");
        setBusy(false);
        return;
      }
      const fd = new FormData();
      fd.append("action", action);
      fd.append("paymentMode", paymentMode);
      fd.append("amount", amount);
      fd.append("paidAt", paidAt);
      fd.append("utrReference", utrReference);
      fd.append("chequeNumber", chequeNumber);
      fd.append("remarks", remarks);
      fd.append("proof", proof);
      const res = await fetch(`/api/balance-payments/${view.id}`, { method: "POST", body: fd });
      setBusy(false);
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Action failed" });
        return;
      }
      onClose();
      router.refresh();
      return;
    }

    const res = await fetch(`/api/balance-payments/${view.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, paymentMode, remarks, ...extra }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Action failed" });
      return;
    }
    if (action === "approve" || action === "process") {
      onClose();
      router.refresh();
      return;
    }
    await refreshTaskFromServer();
    router.refresh();
  }

  async function addCharge() {
    if (!view.trip || !chargeAmount) return;
    setBusy(true);
    const res = await fetch(`/api/trips/${view.trip.id}/charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chargeType,
        amount: Number(chargeAmount),
        description: chargeDesc || null,
      }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to add charge" });
      return;
    }
    setChargeAmount("");
    setChargeDesc("");
    await refreshTaskFromServer();
    router.refresh();
  }

  const showApproveAction = ["PENDING_REVIEW", "SLA_BREACHED"].includes(view.status);
  const mayApprove = canApprove && showApproveAction;
  const canStartProcessing = canProcess && ["APPROVED", "PARTIALLY_PAID", "SLA_BREACHED"].includes(view.status);
  const canPay = canProcess && ["PROCESSING", "APPROVED", "PARTIALLY_PAID"].includes(view.status) && view.outstandingBalance > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Vendor Balance Payment</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusBadge status={view.status} />
              {view.slaBreached && <StatusBadge status="SLA_BREACHED" />}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-slate-500">Vendor</p><p className="font-medium">{view.vendor.name}</p></div>
            <div>
              <p className="text-xs text-slate-500">Trip</p>
              {view.trip ? (
                <Link href={`/trips/${view.trip.id}`} className="font-medium text-blue-600 hover:underline">{view.trip.lrNumber}</Link>
              ) : "—"}
            </div>
            <div><p className="text-xs text-slate-500">Original Freight</p><p className="font-medium">{formatINR(view.freightAmount)}</p></div>
            <div><p className="text-xs text-slate-500">Additional Charges</p><p className="font-medium text-green-700">+ {formatINR(view.additionalChargesAmount)}</p></div>
            <div><p className="text-xs text-slate-500">Deductions</p><p className="font-medium text-red-600">- {formatINR(view.deductionsAmount)}</p></div>
            <div><p className="text-xs text-slate-500">TDS</p><p className="font-medium">- {formatINR(view.tdsAmount)}</p></div>
            <div><p className="text-xs text-slate-500">Final Payable</p><p className="font-medium">{formatINR(view.finalPayableAmount)}</p></div>
            <div>
              <p className="text-xs text-slate-500">Advance Paid</p>
              <p className="font-medium">- {formatINR(view.advanceAmount)}</p>
              {view.advanceAmount <= 0 && (
                <p className="text-xs text-slate-500 mt-0.5">No advance requested — paying full balance.</p>
              )}
            </div>
            <div><p className="text-xs text-slate-500">Balance Payable</p><p className="font-medium text-emerald-700">{formatINR(view.balanceAmount)}</p></div>
            <div><p className="text-xs text-slate-500">Amount Paid</p><p className="font-medium">{formatINR(view.paidAmount)}</p></div>
            <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-semibold text-amber-700">{formatINR(view.outstandingBalance)}</p></div>
            <div><p className="text-xs text-slate-500">SLA</p><p className="font-medium">{formatSlaRemaining(view.slaRemainingMs)}</p></div>
          </div>

          {view.financialNotes && view.financialNotes.length > 0 && (
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm">
              <p className="font-medium mb-2 text-blue-950">Issued debit / credit notes (included in totals above)</p>
              <ul className="space-y-2">
                {view.financialNotes.map((note) => (
                  <li key={note.id} className="text-blue-900">
                    <Link href={`/financial-notes/${note.id}`} className="font-medium text-blue-700 hover:underline">
                      {note.noteNumber ?? note.id}
                    </Link>
                    <span className="text-blue-800">
                      {" "}
                      · {note.purposeLabel} · {noteAmountLabel(note)}
                    </span>
                    {note.reason && <p className="text-xs text-blue-700/80 mt-0.5">{note.reason}</p>}
                    {note.issuedAt && (
                      <p className="text-xs text-blue-700/70">Issued {formatDate(note.issuedAt)}</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-blue-800 mt-2">
                Do not re-enter the same amount under trip charges — deductions and additional charges above already
                include these notes.
              </p>
            </div>
          )}

          {view.trip?.charges && view.trip.charges.length > 0 && (
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="font-medium mb-2">Trip charges (on load)</p>
              {view.trip.charges.map((c) => (
                <p key={c.id} className="text-slate-600">
                  {c.chargeType}: {formatINR(c.amount)}{c.description ? ` — ${c.description}` : ""}
                </p>
              ))}
            </div>
          )}

          {canProcess && ["PENDING_REVIEW", "SLA_BREACHED", "APPROVED"].includes(view.status) && view.trip && (
            <div className="border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium">Add trip charge / deduction</p>
              <p className="text-xs text-slate-500">
                Use only for adjustments not already covered by an issued note or existing trip charge.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <select className="border rounded-md px-2 py-1.5 text-sm" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
                  <option value="DETENTION">Detention</option>
                  <option value="DEDUCTION">Deduction</option>
                  <option value="OTHER">Other</option>
                </select>
                <input type="number" className="border rounded-md px-2 py-1.5 text-sm" placeholder="Amount" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
                <input className="border rounded-md px-2 py-1.5 text-sm" placeholder="Description" value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" disabled={busy || !chargeAmount} onClick={addCharge}>Add</Button>
            </div>
          )}

          {(view.payments ?? []).length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Balance Payments</p>
              {(view.payments ?? []).map((p) => (
                <div key={p.id} className="text-sm border-b py-2 last:border-0 flex justify-between">
                  <div>
                    <p>{formatINR(p.amount)} · {p.paymentMode}</p>
                    <p className="text-xs text-slate-500">{formatDate(p.paidAt)} · {p.utrReference ?? p.chequeNumber ?? "—"}</p>
                  </div>
                  {p.proof && <a href={p.proof.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600">Proof</a>}
                </div>
              ))}
            </div>
          )}

          {view.voucherFile && (
            <a href={view.voucherFile.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Download Payment Voucher {view.voucherNumber}
            </a>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {showApproveAction && (
              <PermissionAction
                size="sm"
                allowed={mayApprove}
                disabled={busy}
                onClick={() => act("approve")}
              >
                Approve Payable
              </PermissionAction>
            )}
            {canStartProcessing && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act("process")}>Start Processing</Button>
            )}
          </div>

          {canPay && (
            <GatewayPaySection
              vendorId={view.vendorId}
              contextType="balance"
              contextId={view.id}
              maxAmount={view.outstandingBalance}
              canProcess={canProcess}
              canApprove={canApprove}
              currentUserId={currentUserId}
              activeTransfers={view.gatewayTransfers ?? []}
              onWorkflowComplete={onClose}
            />
          )}

          {canPay && (
            <div className="border rounded-md p-3 space-y-3 bg-slate-50">
              <p className="text-sm font-medium">Record manual payment (offline / cheque)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount to Pay *</label>
                  <input type="number" className="w-full border rounded-md px-2 py-1.5 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Payment Date *</label>
                  <input type="date" className="w-full border rounded-md px-2 py-1.5 text-sm" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Payment Method *</label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm bg-white" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    <option>Bank Transfer</option><option>UPI</option><option>NEFT</option><option>RTGS</option><option>Cheque</option>
                  </select>
                </div>
                {ELECTRONIC.has(paymentMode) && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">UTR / Reference *</label>
                    <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={utrReference} onChange={(e) => setUtrReference(e.target.value)} />
                  </div>
                )}
                {paymentMode === "Cheque" && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Cheque Number *</label>
                    <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">Payment Proof *</label>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">Remarks</label>
                  <textarea className="w-full border rounded-md px-2 py-1.5 text-sm" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </div>
              <Button size="sm" disabled={busy} onClick={() => act("record_payment")}>Record Payment</Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
