"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VendorForm from "@/components/forms/vendor-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { VENDOR_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
import { ONBOARDING_CASE_STATUS } from "@/lib/onboarding-case-status";
import { Button } from "@/components/ui/button";
import PortalPasswordField from "@/components/partners/portal-password-field";
import { getPortalPasswordValidationError } from "@/lib/portal-password";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Doc = { id: string; type: string; url: string; name: string | null };

const STEPS = [
  { id: "profile", label: "Profile" },
  { id: "documents", label: "Documents" },
  { id: "portal", label: "Portal access" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const FORM_ID = "partner-vendor-create-profile";

export default function PartnerVendorCreateFlow() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<StepId>("profile");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalPhone, setPortalPhone] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState("");

  async function finishWithPortal(skipPortal: boolean) {
    if (!vendorId) return;
    if (!skipPortal) {
      const pwdErr = getPortalPasswordValidationError(portalPassword);
      if (!portalEmail.trim() || pwdErr) {
        setPortalError(
          !portalEmail.trim()
            ? "Email is required."
            : pwdErr ?? "Enter a valid portal password."
        );
        return;
      }
      setPortalBusy(true);
      setPortalError("");
      const res = await fetch(`/api/partners/vendors/${vendorId}/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: portalEmail.trim(),
          password: portalPassword,
          phone: portalPhone.trim() || null,
        }),
      });
      setPortalBusy(false);
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError: setPortalError, fallback: "Failed to create portal login" });
        return;
      }
    }
    const pending = onboardingStatus === ONBOARDING_CASE_STATUS.PENDING_APPROVAL;
    router.push(
      `/vendors/${vendorId}?created=1${pending ? "&onboarding=pending" : "&onboarding=approved"}`
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm" aria-label="Create vendor steps">
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done = (s.id === "profile" && vendorId) || (s.id === "documents" && step === "portal");
          return (
            <button
              key={s.id}
              type="button"
              disabled={s.id !== "profile" && !vendorId}
              onClick={() => vendorId && setStep(s.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-[#0F172A] text-white" : done ? "text-emerald-700 bg-emerald-50" : "text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              }`}
            >
              {idx + 1}. {s.label}
            </button>
          );
        })}
      </nav>

      {step === "profile" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Payment terms type, delivery zones, bank, and KYC — same as vendor portal onboarding.
          </p>
          <VendorForm
            formId={FORM_ID}
            hideActions
            endpoint="/api/partners/vendors"
            submitLabel="Save & continue"
            onCreated={(data) => {
              const id = data.vendorId ?? data.id;
              if (!id) return;
              setVendorId(id);
              setOnboardingStatus(data.onboardingStatus ?? null);
              setStep("documents");
              toast.push({
                title:
                  data.onboardingStatus === ONBOARDING_CASE_STATUS.PENDING_APPROVAL
                    ? "Vendor saved — pending Super Admin approval."
                    : "Vendor profile saved.",
                variant: "success",
              });
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" form={FORM_ID}>Save & continue</Button>
          </div>
        </div>
      )}

      {step === "documents" && vendorId && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#0F172A]">Documents</h3>
              <p className="text-xs text-slate-500 mt-1">Vendor KYC and agreement documents.</p>
            </div>
            <div className="p-5 sm:p-6">
              <OnboardingDocuments
                ownerType="vendor"
                ownerId={vendorId}
                documents={documents}
                docTypes={VENDOR_ONBOARDING_DOCS}
                onDocumentsChange={setDocuments}
              />
            </div>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("profile")}>Back</Button>
            <Button type="button" onClick={() => setStep("portal")}>Continue</Button>
          </div>
        </div>
      )}

      {step === "portal" && vendorId && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Portal login</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Credentials for the vendor portal at <span className="font-medium">/portal/vendor</span>.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                  value={portalEmail}
                  onChange={(e) => setPortalEmail(e.target.value)}
                />
              </div>
              <div>
                <PortalPasswordField
                  value={portalPassword}
                  onChange={setPortalPassword}
                  disabled={portalBusy}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile / WhatsApp (optional)</label>
                <input
                  type="tel"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm max-w-md"
                  value={portalPhone}
                  onChange={(e) => setPortalPhone(e.target.value)}
                />
              </div>
            </div>
            {portalError && <p className="text-sm text-red-600">{portalError}</p>}
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("documents")}>Back</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={portalBusy} onClick={() => finishWithPortal(true)}>
                Skip portal login
              </Button>
              <Button type="button" disabled={portalBusy} onClick={() => finishWithPortal(false)}>
                {portalBusy ? "Creating…" : "Finish"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
