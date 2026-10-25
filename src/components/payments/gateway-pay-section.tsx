"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionAction } from "@/components/permission-action";
import { formatINR } from "@/lib/utils";

import { readJsonBody, reportApiFailure, resolveApiError } from "@/lib/api-client";
import { useToast } from "@/components/toast";
export type GatewayTransfer = {
  id: string;
  paymentNumber: string;
  status: string;
  amount: number;
  providerTransferRef: string | null;
  createdById: string | null;
  failureMessage: string | null;
};

type Beneficiary = {
  id: string;
  maskedDisplay: string;
  verificationStatus: string;
  method: string;
};

export default function GatewayPaySection({
  vendorId,
  contextType,
  contextId,
  maxAmount,
  canProcess,
  canApprove = false,
  currentUserId,
  activeTransfers,
  disabled,
  onWorkflowComplete,
}: {
  vendorId: string;
  contextType: "balance" | "advance";
  contextId: string;
  maxAmount: number;
  canProcess: boolean;
  canApprove?: boolean;
  currentUserId?: string | null;
  activeTransfers: GatewayTransfer[];
  disabled?: boolean;
  /** Close parent detail dialog after a successful approve & pay (no auto-advance to next item). */
  onWorkflowComplete?: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [gatewayOn, setGatewayOn] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [amount, setAmount] = useState(String(maxAmount));
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transfers, setTransfers] = useState(activeTransfers);

  const loadBeneficiaries = useCallback(async () => {
    const res = await fetch(`/api/vendors/${vendorId}/beneficiaries`);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { silent: true });
      return;
    }
    const list = (Array.isArray(data) ? data : []) as Beneficiary[];
    setBeneficiaries(list);
    const verified = list.find((b) => b.verificationStatus === "VERIFIED");
    if (verified) setBeneficiaryId(verified.id);
  }, [vendorId]);

  useEffect(() => {
    setAmount(String(maxAmount));
    setTransfers(activeTransfers);
  }, [maxAmount, activeTransfers]);

  useEffect(() => {
    fetch("/api/payments/gateway-config")
      .then((r) => r.json())
      .then((j) => setGatewayOn(Boolean(j.executionEnabled)))
      .catch(() => setGatewayOn(false));
    loadBeneficiaries();
  }, [loadBeneficiaries]);

  const pending = transfers.find((t) =>
    ["PENDING_APPROVAL", "APPROVED", "PROCESSING", "REQUIRES_REVIEW"].includes(t.status)
  );

  useEffect(() => {
    if (!pending || !["PROCESSING", "REQUIRES_REVIEW", "APPROVED"].includes(pending.status)) return;
    const id = pending.id;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/outbound-payments/${id}/refresh`, { method: "POST" });
      const j = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, j, { silent: true });
        return;
      }
      const p = (j as { data?: GatewayTransfer }).data ?? (j as GatewayTransfer);
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: p.status, providerTransferRef: p.providerTransferRef } : t
        )
      );
      if (p.status === "SUCCEEDED") {
        clearInterval(timer);
        onWorkflowComplete?.();
        router.refresh();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [pending?.id, pending?.status, router, onWorkflowComplete]);

  async function addBeneficiary() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/vendors/${vendorId}/beneficiaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountHolder,
        accountNumber,
        ifsc,
        method: "BANK_TRANSFER",
        isDefault: true,
      }),
    });
    const created = await readJsonBody(res);
    if (!res.ok) {
      setBusy(false);
      reportApiFailure(res, created, { toast, setError, fallback: "Failed to add bank account" });
      return;
    }
    const b = ((created as { data?: { id: string } }).data ?? created) as { id: string };
    const verifyRes = await fetch(`/api/vendors/${vendorId}/beneficiaries/${b.id}/verify`, { method: "POST" });
    setBusy(false);
    const verifyData = await readJsonBody(verifyRes);
    if (!verifyRes.ok) {
      reportApiFailure(verifyRes, verifyData, { toast, setError, fallback: "Account saved but verification failed" });
      return;
    }
    await loadBeneficiaries();
    setBeneficiaryId(b.id);
  }

  async function payNow() {
    setError("");
    setBusy(true);
    const action = contextType === "balance" ? "gateway_initiate" : "gateway_initiate";
    const url =
      contextType === "balance"
        ? `/api/balance-payments/${contextId}`
        : `/api/advance-requests/${contextId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        beneficiaryId,
        amount: Number(amount),
      }),
    });
    const data = await readJsonBody(res);
    setBusy(false);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Could not start bank transfer" });
      return;
    }
    const body = data as { gatewayPayment?: GatewayTransfer; data?: { gatewayPayment?: GatewayTransfer } };
    const transfer = body.gatewayPayment ?? body.data?.gatewayPayment;
    if (transfer) {
      setTransfers((prev) => [transfer, ...prev]);
    }
    router.refresh();
  }

  async function approveAndPay(paymentId: string) {
    setError("");
    setBusy(true);
    const url =
      contextType === "balance"
        ? `/api/balance-payments/${contextId}`
        : `/api/advance-requests/${contextId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gateway_approve_execute", paymentId }),
    });
    const data = await readJsonBody(res);
    setBusy(false);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Approval or transfer failed" });
      return;
    }
    const body = data as { gatewayPayment?: GatewayTransfer; data?: { gatewayPayment?: GatewayTransfer } };
    const transfer = body.gatewayPayment ?? body.data?.gatewayPayment;
    if (transfer) {
      setTransfers((prev) => prev.map((t) => (t.id === paymentId ? transfer : t)));
    }
    onWorkflowComplete?.();
    router.refresh();
  }

  if (!gatewayOn) {
    return (
      <p className="text-xs text-slate-500 rounded-md border border-dashed p-3">
        Bank transfer via payment gateway is not enabled in this environment. Use manual recording below, or set{" "}
        <code className="text-[11px]">PAYMENT_GATEWAY_PROVIDER</code> for automated transfers (non-production mock).
      </p>
    );
  }

  const verified = beneficiaries.filter((b) => b.verificationStatus === "VERIFIED");
  const showApprovePending = pending?.status === "PENDING_APPROVAL";
  const makerCheckerOk =
    Boolean(pending?.createdById && currentUserId && pending.createdById !== currentUserId);
  const canApprovePending = canApprove && showApprovePending && makerCheckerOk;

  return (
    <div className="border rounded-md p-3 space-y-3 bg-emerald-50/50 border-emerald-200">
      <div>
        <p className="text-sm font-semibold text-slate-900">Pay now (bank transfer)</p>
        <p className="text-xs text-slate-600">
          Initiates a verified transfer through the payment gateway. UTR and settlement are recorded automatically on success.
        </p>
      </div>

      {transfers.length > 0 && (
        <div className="text-xs space-y-1">
          {transfers.map((t) => (
            <div key={t.id} className="flex justify-between gap-2 bg-white rounded px-2 py-1 border">
              <span>{t.paymentNumber} · {formatINR(t.amount)}</span>
              <span className="font-medium">{t.status}</span>
              {t.providerTransferRef && <span className="text-slate-500 truncate">UTR/ref: {t.providerTransferRef}</span>}
            </div>
          ))}
        </div>
      )}

      {showApprovePending && (
        <PermissionAction
          size="sm"
          allowed={canApprovePending}
          disabled={busy}
          deniedMessage={
            !canApprove
              ? "You are not allowed to perform this action"
              : !makerCheckerOk
                ? "You cannot approve a payment you initiated"
                : "You are not allowed to perform this action"
          }
          onClick={() => approveAndPay(pending!.id)}
        >
          Approve &amp; transfer
        </PermissionAction>
      )}

      {pending && ["PROCESSING", "REQUIRES_REVIEW"].includes(pending.status) && (
        <p className="text-xs text-amber-800">Transfer in progress or awaiting confirmation — this updates automatically.</p>
      )}

      {!pending && canProcess && !disabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Amount *</label>
              <input
                type="number"
                className="w-full border rounded-md px-2 py-1.5 text-sm"
                value={amount}
                max={maxAmount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Pay to *</label>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
              >
                <option value="">Select account</option>
                {verified.map((b) => (
                  <option key={b.id} value={b.id}>{b.maskedDisplay}</option>
                ))}
              </select>
            </div>
          </div>

          {verified.length === 0 && (
            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
              <p className="col-span-2 text-xs font-medium">Add vendor bank account</p>
              <input className="border rounded px-2 py-1 text-sm" placeholder="Account holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              <input className="border rounded px-2 py-1 text-sm col-span-2" placeholder="IFSC" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
              <Button size="sm" variant="outline" disabled={busy} onClick={addBeneficiary}>Save &amp; verify account</Button>
            </div>
          )}

          <Button size="sm" disabled={busy || !beneficiaryId || Number(amount) <= 0} onClick={payNow}>
            Pay now
          </Button>
        </>
      )}

      {pending?.status === "PENDING_APPROVAL" && pending.createdById === currentUserId && (
        <p className="text-xs text-slate-600">Transfer submitted — waiting for another finance user to approve and execute.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
