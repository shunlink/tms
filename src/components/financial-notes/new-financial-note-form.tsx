"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FinancialNoteFormOptions = {
  vendors: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  trips: {
    id: string;
    lrNumber: string;
    vendorId: string;
    clientId: string;
    route: string;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    clientId: string;
    totalAmount: number;
    status: string;
  }[];
};

const PURPOSE_BY_COUNTERPARTY: Record<
  string,
  { value: string; label: string; suggestedNoteType: "DEBIT_NOTE" | "CREDIT_NOTE" }[]
> = {
  VENDOR: [
    { value: "VENDOR_FREIGHT_INCREASE", label: "Freight / charges increase (we pay vendor more)", suggestedNoteType: "DEBIT_NOTE" },
    { value: "VENDOR_FREIGHT_REDUCTION", label: "Freight / deduction (we pay vendor less)", suggestedNoteType: "CREDIT_NOTE" },
    { value: "OTHER", label: "Other (finance review)", suggestedNoteType: "DEBIT_NOTE" },
  ],
  CLIENT: [
    { value: "CLIENT_BILLING_INCREASE", label: "Bill client more", suggestedNoteType: "DEBIT_NOTE" },
    { value: "CLIENT_BILLING_REDUCTION", label: "Bill client less / credit", suggestedNoteType: "CREDIT_NOTE" },
  ],
};

export default function NewFinancialNoteForm({ options }: { options: FinancialNoteFormOptions }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [counterpartyType, setCounterpartyType] = useState<"VENDOR" | "CLIENT">("VENDOR");
  const [vendorId, setVendorId] = useState("");
  const [clientId, setClientId] = useState("");
  const [tripId, setTripId] = useState("");
  const [clientInvoiceId, setClientInvoiceId] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("VENDOR_FREIGHT_INCREASE");
  const [noteType, setNoteType] = useState<"DEBIT_NOTE" | "CREDIT_NOTE">("DEBIT_NOTE");

  const purposes = PURPOSE_BY_COUNTERPARTY[counterpartyType] ?? [];

  const filteredTrips = useMemo(() => {
    return options.trips.filter((t) => {
      if (counterpartyType === "VENDOR" && vendorId && t.vendorId !== vendorId) return false;
      if (counterpartyType === "CLIENT" && clientId && t.clientId !== clientId) return false;
      return true;
    });
  }, [options.trips, counterpartyType, vendorId, clientId]);

  const filteredInvoices = useMemo(() => {
    if (counterpartyType !== "CLIENT") return [];
    return options.invoices.filter((inv) => !clientId || inv.clientId === clientId);
  }, [options.invoices, counterpartyType, clientId]);

  function onCounterpartyChange(next: "VENDOR" | "CLIENT") {
    setCounterpartyType(next);
    setTripId("");
    setClientInvoiceId("");
    const firstPurpose = PURPOSE_BY_COUNTERPARTY[next][0];
    setBusinessPurpose(firstPurpose.value);
    setNoteType(firstPurpose.suggestedNoteType);
  }

  function onPurposeChange(value: string) {
    setBusinessPurpose(value);
    const match = purposes.find((p) => p.value === value);
    if (match) setNoteType(match.suggestedNoteType);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const reason = fd.get("reason")?.toString() || null;

    if (counterpartyType === "VENDOR" && !vendorId) {
      setError("Select a vendor");
      setLoading(false);
      return;
    }
    if (counterpartyType === "CLIENT" && !clientId) {
      setError("Select a client");
      setLoading(false);
      return;
    }
    if (
      counterpartyType === "VENDOR" &&
      ["VENDOR_FREIGHT_INCREASE", "VENDOR_FREIGHT_REDUCTION"].includes(businessPurpose) &&
      !tripId
    ) {
      setError("Select the trip this vendor adjustment applies to");
      setLoading(false);
      return;
    }
    if (
      counterpartyType === "CLIENT" &&
      ["CLIENT_BILLING_INCREASE", "CLIENT_BILLING_REDUCTION"].includes(businessPurpose) &&
      !clientInvoiceId
    ) {
      setError("Select the client invoice to adjust");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/financial-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteType,
          counterpartyType,
          vendorId: counterpartyType === "VENDOR" ? vendorId : null,
          clientId: counterpartyType === "CLIENT" ? clientId : null,
          tripId: tripId || null,
          clientInvoiceId: counterpartyType === "CLIENT" ? clientInvoiceId || null : null,
          businessPurpose,
          reason,
          lines: [{ description: reason ?? businessPurpose, amount }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Create failed");
      router.push(`/financial-notes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-500">
            Issued notes update vendor payables or client invoice totals (after approval/issue). Trip charges
            already in freight use &quot;from trip charge&quot; instead of duplicating here.
          </p>
          <div>
            <Label>Counterparty</Label>
            <select
              name="counterpartyType"
              className="w-full border rounded-md h-10 px-3"
              value={counterpartyType}
              onChange={(e) => onCounterpartyChange(e.target.value as "VENDOR" | "CLIENT")}
            >
              <option value="VENDOR">Vendor</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>
          {counterpartyType === "VENDOR" ? (
            <div>
              <Label>Vendor</Label>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={vendorId}
                onChange={(e) => {
                  setVendorId(e.target.value);
                  setTripId("");
                }}
                required
              >
                <option value="">Select vendor…</option>
                {options.vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label>Client</Label>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setTripId("");
                  setClientInvoiceId("");
                }}
                required
              >
                <option value="">Select client…</option>
                {options.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Business purpose</Label>
            <select
              name="businessPurpose"
              className="w-full border rounded-md h-10 px-3"
              value={businessPurpose}
              onChange={(e) => onPurposeChange(e.target.value)}
            >
              {purposes.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Note type</Label>
            <select
              name="noteType"
              className="w-full border rounded-md h-10 px-3"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as "DEBIT_NOTE" | "CREDIT_NOTE")}
            >
              <option value="DEBIT_NOTE">Debit note</option>
              <option value="CREDIT_NOTE">Credit note</option>
            </select>
          </div>
          <div>
            <Label>Trip (optional)</Label>
            <select
              className="w-full border rounded-md h-10 px-3"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
            >
              <option value="">—</option>
              {filteredTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.lrNumber} — {t.route}
                </option>
              ))}
            </select>
          </div>
          {counterpartyType === "CLIENT" && (
            <div>
              <Label>Client invoice</Label>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={clientInvoiceId}
                onChange={(e) => setClientInvoiceId(e.target.value)}
              >
                <option value="">Select invoice (recommended)…</option>
                {filteredInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — ₹{inv.totalAmount} ({inv.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Amount (INR)</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Reason</Label>
            <Input name="reason" placeholder="Short description for audit trail" />
          </div>
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Create draft"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
