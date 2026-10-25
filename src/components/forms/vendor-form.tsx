"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGNUP_LOCKED_PROFILE_FIELDS } from "@/lib/portal-access";
import GstVerificationField from "@/components/integrations/gst-verification-field";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { DELIVERY_ZONE_OPTIONS, type DeliveryZone } from "@/lib/delivery-zones";
import { VENDOR_PAYMENT_TERMS_TYPE_OPTIONS } from "@/lib/vendor-payment-terms";
import { useToast } from "@/components/toast";

const FIELDS = [
  "name", "type", "contactName", "phone", "altPhone", "email", "whatsapp",
  "gstin", "pan", "msme",
  "addressLine1", "addressLine2", "city", "state", "pincode",
  "bankName", "bankAccount", "bankIfsc", "bankBranch", "accountHolder", "upiId",
  "paymentTerms", "paymentTermsType", "notes",
] as const;

type Field = (typeof FIELDS)[number];

const SIGNUP_LOCKED_FIELDS = SIGNUP_LOCKED_PROFILE_FIELDS as readonly Field[];

export default function VendorForm({
  initial,
  initialDeliveryZones = [],
  vendorId,
  endpoint,
  submitLabel,
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
  initialDeliveryZones?: string[];
  vendorId?: string;
  endpoint?: string;
  submitLabel?: string;
  /** Lock business name, phone, and email collected during account creation */
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
  onCreated?: (data: { id?: string; vendorId?: string; onboardingStatus?: string }) => void;
}) {
  const toast = useToast();
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
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(() =>
    initialDeliveryZones.filter((z): z is DeliveryZone =>
      DELIVERY_ZONE_OPTIONS.some((o) => o.value === z)
    )
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function toggleDeliveryZone(zone: DeliveryZone) {
    if (readOnly) return;
    setDeliveryZones((prev) => {
      if (zone === "ALL") {
        return prev.includes("ALL") ? [] : ["ALL"];
      }
      const withoutAll = prev.filter((z) => z !== "ALL");
      if (withoutAll.includes(zone)) {
        return withoutAll.filter((z) => z !== zone);
      }
      return [...withoutAll, zone];
    });
  }

  useEffect(() => {
    onValuesChange?.({
      ...form,
      tdsApplicable: tdsApplicable ? "true" : "false",
      deliveryZones: deliveryZones.join(","),
    });
  }, [form, tdsApplicable, deliveryZones, onValuesChange]);

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
    const url = endpoint ?? (vendorId ? `/api/vendors/${vendorId}` : "/api/vendors");
    const method = vendorId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, tdsApplicable, deliveryZones }),
    });
    setSaving(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to save vendor" });
      return;
    }
    const saved = data as { id?: string; vendorId?: string; onboardingStatus?: string };
    if (onCreated) {
      onCreated(saved);
      return;
    }
    if (endpoint && vendorId) {
      router.refresh();
      return;
    }
    if (endpoint && !vendorId) {
      router.refresh();
      return;
    }
    router.push(`/vendors/${vendorId ?? saved.id ?? saved.vendorId}`);
    router.refresh();
  }

  const input = (k: Field, label: string, type = "text", required = false) => {
    const locked = readOnly || (shouldLockSignupFields && SIGNUP_LOCKED_FIELDS.includes(k));
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
            <select
              name="type"
              className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-[#F8FAFC]${readOnly ? " opacity-80 cursor-not-allowed" : ""}`}
              value={form.type}
              onChange={(e) => !readOnly && set("type", e.target.value)}
              disabled={readOnly}
            >
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
              disabled={readOnly}
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
        <CardHeader>
          <CardTitle>Delivery zones</CardTitle>
          <p className="text-sm text-slate-500 font-normal mt-1">
            Regions of India where you deliver loads (you can select more than one).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DELIVERY_ZONE_OPTIONS.map((opt) => {
              const checked = deliveryZones.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer ${
                    checked ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:bg-slate-50"
                  } ${readOnly ? "opacity-80 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => toggleDeliveryZone(opt.value)}
                  />
                  <span className="font-medium text-slate-800">{opt.label}</span>
                </label>
              );
            })}
          </div>
          {presentation === "portal" && deliveryZones.length === 0 && (
            <p className="text-xs text-amber-700 mt-3">Select at least one delivery zone before submitting.</p>
          )}
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Payment terms type{presentation === "portal" ? " *" : ""}
            </label>
            <select
              name="paymentTermsType"
              className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm ${
                presentation === "portal" ? "bg-[#F8FAFC]" : "bg-slate-50/50"
              }${readOnly ? " opacity-80 cursor-not-allowed" : ""}`}
              value={form.paymentTermsType}
              onChange={(e) => !readOnly && set("paymentTermsType", e.target.value)}
              disabled={readOnly}
              required={presentation === "portal"}
            >
              <option value="">Select payment terms</option>
              {VENDOR_PAYMENT_TERMS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Credit vendors are typically paid on due date; adhoc vendors are settled per trip or immediately.
            </p>
          </div>
          {input("paymentTerms", "Payment terms (days)", "number")}
          <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
            <input
              type="checkbox"
              checked={tdsApplicable}
              onChange={(e) => !readOnly && setTdsApplicable(e.target.checked)}
              disabled={readOnly}
            />
            TDS applicable on payments
          </label>
        </CardContent>
      </Card>

      {presentation !== "portal" && !endpoint?.includes("/partners/") && (
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
