"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Option = { id: string; label: string };
type TripOption = {
  id: string;
  lrNumber: string;
  route: string;
  vendorId: string;
  vendorRate: number;
};

const ELECTRONIC = new Set(["Bank Transfer", "NEFT", "RTGS", "UPI"]);

const PAYMENT_TYPES = [
  { value: "ADVANCE", label: "Advance" },
  { value: "BALANCE", label: "Balance payment" },
  { value: "OTHER", label: "Other" },
] as const;

export default function VendorPaymentForm({
  vendors,
  trips,
}: {
  vendors: Option[];
  trips: TripOption[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    vendorId: vendors[0]?.id ?? "",
    tripId: "",
    paymentType: "BALANCE",
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    paymentMode: "Bank Transfer",
    referenceNo: "",
    chequeNumber: "",
    notes: "",
  });
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const vendorTrips = trips.filter((t) => t.vendorId === form.vendorId);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!proof) {
      setError("Payment proof is required");
      return;
    }
    if (!form.tripId) {
      setError("Select a trip");
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

    const res = await fetch("/api/payments", { method: "POST", body: fd });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to record payment" });
      return;
    }
    router.refresh();
    setForm((f) => ({
      ...f,
      amount: "",
      referenceNo: "",
      chequeNumber: "",
      notes: "",
      tripId: "",
    }));
    setProof(null);
  }

  return (
    <form onSubmit={submit} className="space-y-4 border rounded-lg p-4 bg-slate-50">
      <p className="text-sm text-slate-600">
        Record a manual vendor payout. Advances and balance payments processed through their workflows are added here automatically.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Vendor *</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
            value={form.vendorId}
            onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value, tripId: "" }))}
            required
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Trip (LR) *</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
            value={form.tripId}
            onChange={(e) => set("tripId", e.target.value)}
            required
          >
            <option value="">Select trip</option>
            {vendorTrips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.lrNumber} · {t.route} (₹{t.vendorRate})
              </option>
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
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid (₹) *</label>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">UTR / Reference *</label>
            <input
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={form.referenceNo}
              onChange={(e) => set("referenceNo", e.target.value)}
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
