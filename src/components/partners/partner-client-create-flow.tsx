"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientForm from "@/components/forms/client-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import ClientOnboardingAgreementPanel from "@/components/onboarding/client-onboarding-agreement-panel";
import { CLIENT_ONBOARDING_DOCS } from "@/lib/onboarding-docs";
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
  { id: "agreement", label: "Agreement" },
  { id: "portal", label: "Portal access" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const FORM_ID = "partner-client-create-profile";

export default function PartnerClientCreateFlow() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<StepId>("profile");
  const [clientId, setClientId] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalPhone, setPortalPhone] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState("");

  async function finishWithPortal(skipPortal: boolean) {
    if (!clientId) return;
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
      const res = await fetch(`/api/partners/clients/${clientId}/portal`, {
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
      `/clients/${clientId}?created=1${pending ? "&onboarding=pending" : "&onboarding=approved"}`
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm" aria-label="Create client steps">
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done =
            (s.id === "profile" && clientId) ||
            (s.id === "documents" && (step === "agreement" || step === "portal")) ||
            (s.id === "agreement" && step === "portal");
          return (
            <button
              key={s.id}
              type="button"
              disabled={s.id !== "profile" && !clientId}
              onClick={() => clientId && setStep(s.id)}
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
            Collect the same KYC and commercial details as client self-service onboarding. Save to continue to documents.
          </p>
          <ClientForm
            formId={FORM_ID}
            variant="partner-admin"
            hideActions
            endpoint="/api/partners/clients"
            submitLabel="Save & continue"
            onCreated={(data) => {
              const id = data.clientId ?? data.id;
              if (!id) return;
              setClientId(id);
              setOnboardingStatus(data.onboardingStatus ?? null);
              setStep("documents");
              toast.push({
                title:
                  data.onboardingStatus === ONBOARDING_CASE_STATUS.PENDING_APPROVAL
                    ? "Client saved — pending Super Admin approval."
                    : "Client profile saved.",
                variant: "success",
              });
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" form={FORM_ID}>Save & continue</Button>
          </div>
        </div>
      )}

      {step === "documents" && clientId && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#0F172A]">Documents</h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload client KYC documents (same types as portal onboarding).
              </p>
            </div>
            <div className="p-5 sm:p-6">
              <OnboardingDocuments
                ownerType="client"
                ownerId={clientId}
                documents={documents.filter((d) => d.type !== "AGREEMENT")}
                docTypes={CLIENT_ONBOARDING_DOCS}
                onDocumentsChange={(next) => {
                  const agreement = documents.filter((d) => d.type === "AGREEMENT");
                  setDocuments([...next, ...agreement]);
                }}
              />
            </div>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("profile")}>Back</Button>
            <Button type="button" onClick={() => setStep("agreement")}>Continue</Button>
          </div>
        </div>
      )}

      {step === "agreement" && clientId && (
        <div className="space-y-4">
          <ClientOnboardingAgreementPanel
            documents={documents}
            ownerType="client"
            ownerId={clientId}
            onDocumentsChange={setDocuments}
          />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("documents")}>Back</Button>
            <Button type="button" onClick={() => setStep("portal")}>Continue</Button>
          </div>
        </div>
      )}

      {step === "portal" && clientId && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Portal login</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Create credentials for the client portal at{" "}
                <span className="font-medium">/portal/client</span>. They sign in with email and password.
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
                  autoComplete="off"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile (optional)</label>
                <input
                  type="tel"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm max-w-md"
                  value={portalPhone}
                  onChange={(e) => setPortalPhone(e.target.value)}
                  placeholder="10-digit Indian mobile"
                />
              </div>
            </div>
            {portalError && <p className="text-sm text-red-600">{portalError}</p>}
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("agreement")}>Back</Button>
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
