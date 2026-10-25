"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Option = { id: string; label: string };

const ELECTRONIC = new Set(["Bank Transfer", "NEFT", "RTGS", "UPI"]);

const PAYMENT_TYPES = [
  { value: "PAYMENT", label: "Payment (against invoice)" },
  { value: "ADVANCE", label: "Advance" },
  { value: "OTHER", label: "Other" },
] as const;

export default function ClientPaymentForm({
  clients,
  invoices = [],
  onSuccess,
}: {
  clients: Option[];
  invoices?: { id: string; invoiceNumber: string; clientId: string; totalAmount: number; paidAmount: number }[];
  onSuccess?: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    clientId: searchParams.get("clientId") ?? clients[0]?.id ?? "",
    paymentType: "PAYMENT",
    amount: searchParams.get("amount") ?? "",
    paidAt: new Date().toISOString().slice(0, 10),
    paymentMode: "Bank Transfer",
    referenceNo: "",
    chequeNumber: "",
    notes: "",
    invoiceId: searchParams.get("invoiceId") ?? "",
    indentId: "",
    tripId: "",
  });
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const clientInvoices = invoices.filter((i) => i.clientId === form.clientId);
  const selectedInvoice = clientInvoices.find((i) => i.id === form.invoiceId);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (selectedInvoice && !form.amount) {
      const outstanding = selectedInvoice.totalAmount - selectedInvoice.paidAmount;
      if (outstanding > 0) set("amount", String(outstanding));
    }
  }, [selectedInvoice, form.amount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!proof) {
      setError("Payment proof is required");
      return;
    }
    if (ELECTRONIC.has(form.paymentMode) && !form.referenceNo.trim()) {
      setError("UTR / transaction reference is required for electronic payments");
      return;
    }
    if (form.paymentMode === "Cheque" && !form.chequeNumber.trim()) {
      setError("Cheque number is required");
      return;
    }

    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v) fd.append(k, v);
    });
    fd.append("proof", proof);

    const res = await fetch("/api/client-payments", { method: "POST", body: fd });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to record payment" });
      return;
    }
    onSuccess?.();
    router.refresh();
    setForm((f) => ({
      ...f,
      amount: "",
      referenceNo: "",
      chequeNumber: "",
      notes: "",
      invoiceId: "",
      indentId: "",
      tripId: "",
    }));
    setProof(null);
  }

  return (
    <form onSubmit={submit} className="space-y-4 border rounded-lg p-4 bg-slate-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
            value={form.clientId}
            onChange={(e) => set("clientId", e.target.value)}
            required
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Type *</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
            value={form.paymentType}
            onChange={(e) => set("paymentType", e.target.value)}
            required
          >
            {PAYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="w-full border rounded-md px-2 py-1.5 text-sm"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date *</label>
          <input
            type="date"
            className="w-full border rounded-md px-2 py-1.5 text-sm"
            value={form.paidAt}
            onChange={(e) => set("paidAt", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method *</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
            value={form.paymentMode}
            onChange={(e) => set("paymentMode", e.target.value)}
          >
            <option>Bank Transfer</option>
            <option>NEFT</option>
            <option>RTGS</option>
            <option>UPI</option>
            <option>Cheque</option>
            <option>Cash</option>
          </select>
        </div>
        {ELECTRONIC.has(form.paymentMode) && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">UTR / Transaction Reference *</label>
            <input
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={form.referenceNo}
              onChange={(e) => set("referenceNo", e.target.value)}
              placeholder="Transaction reference"
              required
            />
          </div>
        )}
        {form.paymentMode === "Cheque" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cheque Number *</label>
            <input
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={form.chequeNumber}
              onChange={(e) => set("chequeNumber", e.target.value)}
              required
            />
          </div>
        )}
        {clientInvoices.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Invoice</label>
            <select
              className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
              value={form.invoiceId}
              onChange={(e) => {
                const inv = clientInvoices.find((i) => i.id === e.target.value);
                set("invoiceId", e.target.value);
                if (inv) {
                  const outstanding = inv.totalAmount - inv.paidAmount;
                  if (outstanding > 0) set("amount", String(outstanding));
                }
              }}
            >
              <option value="">— None —</option>
              {clientInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} (₹{i.totalAmount - i.paidAmount} due)
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Proof *</label>
          <input
            type="file"
            accept="image/*,.pdf"
            className="w-full text-sm"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
          <textarea
            className="w-full border rounded-md px-2 py-1.5 text-sm"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Recording..." : "Record Payment"}
      </Button>
    </form>
  );
}
