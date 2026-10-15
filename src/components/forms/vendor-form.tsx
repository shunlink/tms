"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGNUP_LOCKED_PROFILE_FIELDS } from "@/lib/portal-access";
import GstVerificationField from "@/components/integrations/gst-verification-field";

const FIELDS = [
  "name", "type", "contactName", "phone", "altPhone", "email", "whatsapp",
  "gstin", "pan", "msme",
  "addressLine1", "addressLine2", "city", "state", "pincode",
  "bankName", "bankAccount", "bankIfsc", "bankBranch", "accountHolder", "upiId",
  "paymentTerms", "notes",
] as const;

type Field = (typeof FIELDS)[number];

const SIGNUP_LOCKED_FIELDS = SIGNUP_LOCKED_PROFILE_FIELDS as readonly Field[];

export default function VendorForm({
  initial,
  vendorId,
  endpoint,
  submitLabel,
  lockSignupFields = false,
  gstVerificationMeta,
  formId,
  hideActions = false,
  presentation = "default",
  onValuesChange,
}: {
  initial?: Partial<Record<Field, string>>;
  vendorId?: string;
  endpoint?: string;
  submitLabel?: string;
  /** Lock name, contact, phone, and email collected during account creation */
  lockSignupFields?: boolean;
  gstVerificationMeta?: {
    verificationStatus?: string | null;
    verifiedAt?: string | null;
    provider?: string | null;
  };
  formId?: string;
  hideActions?: boolean;
  presentation?: "default" | "portal";
  onValuesChange?: (values: Record<string, string>) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const shouldLockSignupFields = lockSignupFields || pathname.startsWith("/onboard/");
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const base = {} as Record<Field, string>;
    for (const f of FIELDS) base[f] = initial?.[f] ?? "";
    if (!base.type) base.type = "FLEET_OWNER";
    return base;
  });
  const [tdsApplicable, setTdsApplicable] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    onValuesChange?.(form);
  }, [form, onValuesChange]);

  const cardClass =
    presentation === "portal"
      ? "portal-onboard-card border-slate-200/80 shadow-sm rounded-2xl"
      : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = shouldLockSignupFields
      ? Object.fromEntries(
          Object.entries(form).filter(([k]) => !SIGNUP_LOCKED_FIELDS.includes(k as Field))
        )
      : form;
    const res = await fetch(endpoint ?? (vendorId ? `/api/vendors/${vendorId}` : "/api/vendors"), {
      method: endpoint || vendorId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, tdsApplicable }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save vendor");
      return;
    }
    if (endpoint) {
      router.refresh();
    } else {
      const data = await res.json();
      router.push(`/vendors/${vendorId ?? data.id}`);
      router.refresh();
    }
  }

  const input = (k: Field, label: string, type = "text", required = false) => {
    const locked = shouldLockSignupFields && SIGNUP_LOCKED_FIELDS.includes(k);
    return (
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
          <span>{label}{required ? " *" : ""}</span>
          {locked && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-400">
              <Lock className="h-3 w-3" aria-hidden />
              Set during registration
            </span>
          )}
        </label>
        <input
          name={k}
          type={type}
          className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-amber-400/50${locked ? " bg-slate-100 text-slate-500 cursor-not-allowed opacity-80" : ""}`}
          value={form[k]}
          onChange={(e) => {
            if (locked) return;
            set(k, e.target.value);
          }}
          required={required && !locked}
          disabled={locked}
          aria-disabled={locked}
        />
      </div>
    );
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-6">
      <Card className={cardClass}>
        <CardHeader><CardTitle>Business details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("name", "Vendor / Business Name", "text", true)}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
            <select name="type" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-[#F8FAFC]" value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="FLEET_OWNER">Fleet Owner</option>
              <option value="BROKER">Broker</option>
            </select>
          </div>
          {input("contactName", "Contact Person")}
          {input("phone", "Phone", "text", true)}
          {input("altPhone", "Alternate Phone")}
          {input("email", "Email")}
          {input("whatsapp", "WhatsApp")}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader><CardTitle>Compliance details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <GstVerificationField
              gstin={form.gstin}
              onGstinChange={(v) => set("gstin", v)}
              entityType="VENDOR"
              entityId={vendorId}
              initialMeta={gstVerificationMeta}
              onVerified={(data) => {
                if (data.tradeName) set("name", String(data.tradeName));
                else if (data.legalName) set("name", String(data.legalName));
                if (data.pan) set("pan", String(data.pan));
                if (data.principalAddress) set("addressLine1", String(data.principalAddress));
                if (data.city) set("city", String(data.city));
                if (data.state) set("state", String(data.state));
                if (data.pincode) set("pincode", String(data.pincode));
              }}
            />
          </div>
          {input("pan", "PAN")}
          {input("msme", "MSME / Udyam No.")}
          {presentation === "portal" && (
            <div className="md:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 leading-relaxed">
              Your GST details will be verified automatically. This helps us keep our platform compliant and secure.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader><CardTitle>Address</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("addressLine1", "Address Line 1")}
          {input("addressLine2", "Address Line 2")}
          {input("city", "City")}
          {input("state", "State")}
          {input("pincode", "Pincode")}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader><CardTitle>Bank & settlement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("bankName", "Bank Name")}
          {input("bankAccount", "Account Number")}
          {input("bankIfsc", "IFSC")}
          {input("bankBranch", "Branch")}
          {input("accountHolder", "Account Holder")}
          {input("upiId", "UPI ID")}
          {input("paymentTerms", "Payment Terms (days)", "number")}
          <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
            <input type="checkbox" checked={tdsApplicable} onChange={(e) => setTdsApplicable(e.target.checked)} />
            TDS applicable on payments
          </label>
        </CardContent>
      </Card>

      {presentation !== "portal" && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hideActions && (
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : submitLabel ?? (vendorId ? "Update Vendor" : "Save Vendor")}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      )}
    </form>
  );
}
