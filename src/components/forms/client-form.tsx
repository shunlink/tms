"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGNUP_LOCKED_PROFILE_FIELDS } from "@/lib/portal-access";
import GstVerificationField from "@/components/integrations/gst-verification-field";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/client-business-types";
import { useToast } from "@/components/toast";

const FIELDS = [
  "name", "businessType", "industry", "website",
  "gstin", "pan", "cin", "msme",
  "contactName", "phone", "altPhone", "email", "accountsEmail",
  "billingAddress", "addressLine1", "addressLine2", "city", "state", "pincode", "country",
  "shippingAddress", "shippingCity", "shippingState", "shippingPincode",
  "creditLimit", "paymentTerms", "securityDeposit",
  "bankName", "bankAccount", "bankIfsc", "bankBranch", "accountHolder",
  "notes",
] as const;

type Field = (typeof FIELDS)[number];

const SIGNUP_LOCKED_FIELDS = SIGNUP_LOCKED_PROFILE_FIELDS as readonly Field[];

export default function ClientForm({
  initial,
  clientId,
  endpoint,
  submitLabel,
  variant = "full",
  lockSignupFields = false,
  gstVerificationMeta,
  formId,
  hideActions = false,
  presentation = "default",
  readOnly = false,
  onValuesChange,
  onCreated,
}: {
  initial?: Partial<Record<Field, string>>;
  clientId?: string;
  endpoint?: string;
  submitLabel?: string;
  /** onboarding = hide credit/commercial fields (client self-service KYC) */
  variant?: "full" | "onboarding" | "ops-completion" | "partner-admin";
  /** Lock company name, phone, and email collected during account creation */
  lockSignupFields?: boolean;
  gstVerificationMeta?: {
    verificationStatus?: string | null;
    verifiedAt?: string | null;
    provider?: string | null;
  };
  formId?: string;
  hideActions?: boolean;
  presentation?: "default" | "portal";
  readOnly?: boolean;
  onValuesChange?: (values: Record<string, string>) => void;
  onCreated?: (data: { id?: string; clientId?: string; onboardingStatus?: string }) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const shouldLockSignupFields = lockSignupFields || pathname.startsWith("/onboard/");
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const base = {} as Record<Field, string>;
    for (const f of FIELDS) base[f] = initial?.[f] ?? "";
    if (!base.country) base.country = "India";
    return base;
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    onValuesChange?.(form);
  }, [form, onValuesChange]);

  const cardClass =
    presentation === "portal"
      ? "portal-onboard-card border-slate-200/80 shadow-sm rounded-2xl"
      : "border-slate-200/80 shadow-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = shouldLockSignupFields
      ? Object.fromEntries(
          Object.entries(form).filter(([k]) => !SIGNUP_LOCKED_FIELDS.includes(k as Field))
        )
      : form;
    const url = endpoint ?? (clientId ? `/api/clients/${clientId}` : "/api/clients");
    const method = clientId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to save client" });
      return;
    }
    const saved = data as { id?: string; clientId?: string; onboardingStatus?: string };
    if (onCreated) {
      onCreated(saved);
      return;
    }
    if (endpoint && clientId) {
      router.refresh();
      return;
    }
    if (endpoint && !clientId) {
      router.refresh();
      return;
    }
    router.push(`/clients/${clientId ?? saved.id ?? saved.clientId}`);
    router.refresh();
  }

  const inputClass =
    presentation === "portal"
      ? "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white"
      : "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white";

  const input = (k: Field, label: string, type = "text", required = false) => {
    const locked = readOnly || (shouldLockSignupFields && SIGNUP_LOCKED_FIELDS.includes(k));
    return (
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
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
          className={`${inputClass}${locked ? " bg-slate-100 text-slate-500 cursor-not-allowed opacity-80" : ""}`}
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("name", "Company Name", "text", true)}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business type{variant === "ops-completion" ? " *" : ""}
            </label>
            <select
              name="businessType"
              className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-[#F8FAFC]${readOnly ? " opacity-80 cursor-not-allowed" : ""}`}
              value={form.businessType}
              onChange={(e) => !readOnly && set("businessType", e.target.value)}
              disabled={readOnly}
              required={variant === "ops-completion"}
            >
              <option value="">Select business type</option>
              {BUSINESS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {input("industry", "Industry")}
          {input("website", "Website")}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compliance & tax</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <GstVerificationField
              gstin={form.gstin}
              onGstinChange={(v) => set("gstin", v)}
              entityType="CLIENT"
              entityId={clientId}
              initialMeta={gstVerificationMeta}
              required={variant === "onboarding" || variant === "partner-admin"}
              disabled={readOnly}
              onVerified={(data) => {
                if (data.tradeName) set("name", String(data.tradeName));
                else if (data.legalName) set("name", String(data.legalName));
                if (data.pan) set("pan", String(data.pan));
                if (data.principalAddress) set("billingAddress", String(data.principalAddress));
                if (data.city) set("city", String(data.city));
                if (data.state) set("state", String(data.state));
                if (data.pincode) set("pincode", String(data.pincode));
              }}
            />
          </div>
          {input("pan", "PAN", "text", variant === "onboarding" || variant === "partner-admin")}
          {input("cin", "CIN")}
          {input("msme", "MSME / Udyam No.")}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader><CardTitle>Primary contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("contactName", "Contact Person")}
          {input("phone", "Phone")}
          {input("altPhone", "Alternate Phone")}
          {input("email", "Email")}
          {input("accountsEmail", "Accounts Email")}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader><CardTitle>Billing address</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Address</label>
            <textarea
              className={`w-full border rounded-md px-3 py-2 text-sm${readOnly ? " bg-slate-100 cursor-not-allowed" : ""}`}
              rows={2}
              value={form.billingAddress}
              onChange={(e) => !readOnly && set("billingAddress", e.target.value)}
              disabled={readOnly}
            />
          </div>
          {input("addressLine1", "Address Line 1")}
          {input("addressLine2", "Address Line 2")}
          {input("city", "City")}
          {input("state", "State")}
          {input("pincode", "Pincode")}
          {input("country", "Country")}
        </CardContent>
      </Card>

      {variant === "full" && (
        <Card>
          <CardHeader><CardTitle>Shipping Address</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Address</label>
              <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={form.shippingAddress} onChange={(e) => set("shippingAddress", e.target.value)} />
            </div>
            {input("shippingCity", "City")}
            {input("shippingState", "State")}
            {input("shippingPincode", "Pincode")}
          </CardContent>
        </Card>
      )}

      {(variant === "full" || variant === "partner-admin") && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Commercials</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {input("creditLimit", "Credit Limit (₹)", "number")}
            {input("paymentTerms", "Payment Terms (days)", "number")}
            {input("securityDeposit", "Security Deposit (₹)", "number")}
          </CardContent>
        </Card>
      )}

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle>Bank details{variant === "onboarding" || variant === "partner-admin" ? " *" : ""}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("bankName", "Bank Name", "text", variant === "onboarding" || variant === "partner-admin")}
          {input("bankAccount", "Account Number", "text", variant === "onboarding" || variant === "partner-admin")}
          {input("bankIfsc", "IFSC", "text", variant === "onboarding" || variant === "partner-admin")}
          {input("bankBranch", "Branch")}
          {input("accountHolder", "Account Holder", "text", variant === "onboarding" || variant === "partner-admin")}
        </CardContent>
      </Card>

      {presentation !== "portal" && variant !== "partner-admin" && (
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
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : submitLabel ?? (clientId ? "Update Client" : "Save Client")}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      )}
    </form>
  );
}
