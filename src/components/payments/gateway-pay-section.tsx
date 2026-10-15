"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

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
  currentUserId,
  activeTransfers,
  disabled,
}: {
  vendorId: string;
  contextType: "balance" | "advance";
  contextId: string;
  maxAmount: number;
  canProcess: boolean;
  currentUserId?: string | null;
  activeTransfers: GatewayTransfer[];
  disabled?: boolean;
}) {
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
    if (!res.ok) return;
    const data = await res.json();
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
      if (!res.ok) return;
      const j = await res.json();
      const p = j.data ?? j;
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: p.status, providerTransferRef: p.providerTransferRef } : t)));
      if (p.status === "SUCCEEDED") {
        clearInterval(timer);
        router.refresh();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [pending?.id, pending?.status, router]);

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
    const created = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(created.error || "Failed to add bank account");
      return;
    }
    const b = created.data ?? created;
    const verifyRes = await fetch(`/api/vendors/${vendorId}/beneficiaries/${b.id}/verify`, { method: "POST" });
    setBusy(false);
    if (!verifyRes.ok) {
      setError("Account saved but verification failed");
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
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not start bank transfer");
      return;
    }
    const transfer = data.gatewayPayment ?? data.data?.gatewayPayment;
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
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Approval or transfer failed");
      return;
    }
    const transfer = data.gatewayPayment ?? data.data?.gatewayPayment;
    if (transfer) {
      setTransfers((prev) => prev.map((t) => (t.id === paymentId ? transfer : t)));
    }
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
  const canApprovePending =
    canProcess &&
    pending?.status === "PENDING_APPROVAL" &&
    pending.createdById &&
    currentUserId &&
    pending.createdById !== currentUserId;

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

      {pending?.status === "PENDING_APPROVAL" && canApprovePending && (
        <Button size="sm" disabled={busy} onClick={() => approveAndPay(pending.id)}>
          Approve &amp; transfer
        </Button>
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
