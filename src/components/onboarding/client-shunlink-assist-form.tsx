"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GstVerificationField from "@/components/integrations/gst-verification-field";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/client-business-types";
import { clientShunlinkAssistSchema } from "@/lib/validation";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

export default function ClientShunlinkAssistForm({
  clientId,
  initial,
  gstVerificationMeta,
}: {
  clientId: string;
  initial: {
    pan: string;
    gstin: string;
    businessType: string;
    bankName: string;
    bankAccount: string;
    bankIfsc: string;
    bankBranch: string;
    accountHolder: string;
  };
  gstVerificationMeta?: {
    verificationStatus?: string | null;
    verifiedAt?: string | null;
    provider?: string | null;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = clientShunlinkAssistSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/portal/onboarding/shunlink-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Submission failed" });
      return;
    }
    router.push("/onboard/client/assisted/waiting");
    router.refresh();
  }

  const inputClass =
    "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quick details for our team</h1>
        <p className="text-sm text-slate-600 mt-2">
          Share compliance and bank information so operations can complete your onboarding with you.
        </p>
      </div>

      <Card className="portal-onboard-card border-slate-200/80 shadow-sm rounded-2xl">
        <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <GstVerificationField
            gstin={form.gstin}
            onGstinChange={(v) => set("gstin", v)}
            entityType="CLIENT"
            entityId={clientId}
            initialMeta={gstVerificationMeta}
            required
            onVerified={(data) => {
              if (data.pan) set("pan", String(data.pan));
            }}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PAN *</label>
            <input className={inputClass} value={form.pan} onChange={(e) => set("pan", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Business type *</label>
            <select
              className={inputClass}
              value={form.businessType}
              onChange={(e) => set("businessType", e.target.value)}
              required
            >
              <option value="">Select business type</option>
              {BUSINESS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="portal-onboard-card border-slate-200/80 shadow-sm rounded-2xl">
        <CardHeader><CardTitle>Bank details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bank name *</label>
            <input className={inputClass} value={form.bankName} onChange={(e) => set("bankName", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account number *</label>
            <input className={inputClass} value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IFSC *</label>
            <input className={inputClass} value={form.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <input className={inputClass} value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Account holder name *</label>
            <input className={inputClass} value={form.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} required />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit details"}</Button>
    </form>
  );
}
