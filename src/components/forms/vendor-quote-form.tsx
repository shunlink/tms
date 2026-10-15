"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function VendorQuoteForm({
  indentId,
  existingQuote,
}: {
  indentId: string;
  existingQuote?: {
    quotedRate: number;
    channel: string;
    submittedAt: string | Date;
  } | null;
}) {
  const router = useRouter();
  const [quotedRate, setQuotedRate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(existingQuote ?? null);

  if (submitted) {
    const via = submitted.channel === "WHATSAPP" ? "WhatsApp" : "portal";
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Quote submitted: ₹{submitted.quotedRate.toLocaleString("en-IN")} via {via}{" "}
        on {new Date(submitted.submittedAt).toLocaleString("en-IN")}. Only one quote per indent
        is allowed — our team will review your rate.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/indents/${indentId}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotedRate: Number(quotedRate),
        remarks: remarks || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to submit quote");
      return;
    }
    setSubmitted({
      quotedRate: data.quotedRate ?? Number(quotedRate),
      channel: data.channel ?? "PORTAL",
      submittedAt: data.submittedAt ?? new Date().toISOString(),
    });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Your rate (₹)
        </label>
        <input
          type="number"
          required
          min={1}
          className="w-full border rounded-md px-3 py-2 text-sm"
          value={quotedRate}
          onChange={(e) => setQuotedRate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Remarks (optional)
        </label>
        <input
          type="text"
          className="w-full border rounded-md px-3 py-2 text-sm"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={busy} className="bg-[#F5D33C] hover:bg-[#ebd034] text-gray-950 font-bold shadow-xs">
        {busy ? "Submitting..." : "Submit Quote"}
      </Button>
    </form>
  );
}
