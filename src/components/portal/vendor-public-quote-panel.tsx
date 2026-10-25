"use client";

import { useState } from "react";
import { Calendar, MapPin, Truck, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
import { formatDate, formatINR } from "@/lib/utils";
import type { PublicVendorQuoteIndent } from "@/lib/services/vendor-quote-access.service";

type ExistingQuote = {
  quotedRate: number;
  channel: string;
  submittedAt: string;
};

export default function VendorPublicQuotePanel({
  accessToken,
  vendorName,
  indent,
  canSubmit,
  existingQuote,
  closedReason,
}: {
  accessToken: string;
  vendorName: string;
  indent: PublicVendorQuoteIndent;
  canSubmit: boolean;
  existingQuote: ExistingQuote | null;
  closedReason: string | null;
}) {
  const toast = useToast();
  const [quotedRate, setQuotedRate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<ExistingQuote | null>(existingQuote);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/public/vendor-quotes/${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotedRate: Number(quotedRate),
        remarks: remarks || undefined,
      }),
    });
    const data = await readJsonBody(res);
    setBusy(false);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to submit quote" });
      return;
    }
    const body = data as { quotedRate?: number; channel?: string; submittedAt?: string };
    setSubmitted({
      quotedRate: body.quotedRate ?? Number(quotedRate),
      channel: body.channel ?? "WHATSAPP",
      submittedAt: body.submittedAt ?? new Date().toISOString(),
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF9E6] to-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-10">
        <header className="mb-6">
          <p className="text-sm font-semibold text-orange-700">ShunLink</p>
          <h1 className="text-2xl font-extrabold text-gray-950 mt-1">Hello, {vendorName}</h1>
          <p className="text-sm text-gray-600 mt-2">
            Review the load below and submit your best freight rate. No login required.
          </p>
        </header>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-950">{indent.indentNumber}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{indent.client}</p>
            <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
              {indent.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {indent.advanceAmount != null && indent.advanceAmount > 0 && (
              <div className="text-sm text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-4 py-3">
                Advance for this load: <strong>{formatINR(indent.advanceAmount)}</strong>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Route
                </p>
                <p className="font-bold text-gray-950 mt-1">{indent.route}</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-3 w-3" /> Vehicle
                </p>
                <p className="font-bold text-gray-950 mt-1">{indent.vehicleType.replace(/_/g, " ")}</p>
              </div>
              {indent.pickupAt && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Pickup
                  </p>
                  <p className="font-bold text-gray-950 mt-1">{formatDate(indent.pickupAt)}</p>
                </div>
              )}
              {indent.weightLabel && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Weight className="h-3 w-3" /> Weight
                  </p>
                  <p className="font-bold text-gray-950 mt-1">{indent.weightLabel}</p>
                </div>
              )}
            </div>

            {indent.cargoLabel && (
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">Cargo:</span> {indent.cargoLabel}
              </p>
            )}

            {submitted ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Quote submitted: {formatINR(submitted.quotedRate)} on{" "}
                {new Date(submitted.submittedAt).toLocaleString("en-IN")}. Our team will review your
                rate.
              </div>
            ) : canSubmit ? (
              <form onSubmit={submit} className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Your rate (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C]"
                    value={quotedRate}
                    onChange={(e) => setQuotedRate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Remarks (optional)
                  </label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C]"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[#F5D33C] hover:bg-[#e6c435] text-gray-950 font-bold"
                >
                  {busy ? "Submitting…" : "Submit quote"}
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {closedReason ?? "You cannot submit a quote on this link right now."}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          One quote per load. You can also sign in to the vendor portal anytime for more loads.
        </p>
      </div>
    </div>
  );
}
