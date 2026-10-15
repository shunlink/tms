"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import VendorForm from "@/components/forms/vendor-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import OnboardingSubmit from "@/components/forms/onboarding-submit";
import { Button } from "@/components/ui/button";
import PortalOnboardingHero from "./portal-onboarding-hero";
import PortalOnboardingSidebar from "./portal-onboarding-sidebar";
import {
  vendorOnboardingSteps,
  computeOnboardingPercent,
} from "@/lib/onboarding-progress";
import { VENDOR_ONBOARDING_DOCS, VENDOR_REQUIRED_DOCS } from "@/lib/onboarding-docs";

const FORM_ID = "portal-onboard-vendor-form";
const HERO = "/portal/portal-onboarding-hero-vendor.webp";

type Doc = { id: string; type: string; url: string; name: string | null };

export default function PortalOnboardingVendorContent({
  vendorId,
  entityName,
  onboardingStatus,
  onboardingRemarks,
  initial,
  documents: initialDocuments,
  gstVerificationMeta,
}: {
  vendorId: string;
  entityName: string;
  onboardingStatus: string;
  onboardingRemarks?: string | null;
  initial: Record<string, string>;
  documents: Doc[];
  gstVerificationMeta?: {
    verificationStatus?: string | null;
    verifiedAt?: string | null;
    provider?: string | null;
  };
}) {
  const [values, setValues] = useState(initial);
  const [documents, setDocuments] = useState(initialDocuments);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const steps = useMemo(
    () => vendorOnboardingSteps(values, documents, VENDOR_REQUIRED_DOCS, onboardingStatus),
    [values, documents, onboardingStatus]
  );
  const percent = useMemo(
    () =>
      computeOnboardingPercent("vendor", values, documents, VENDOR_REQUIRED_DOCS, onboardingStatus),
    [values, documents, onboardingStatus]
  );
  const currentStep = steps.find((s) => s.state === "current");
  const progressCaption = currentStep
    ? `${currentStep.label} in progress. Complete the remaining steps to get started.`
    : "Complete the remaining steps to get started.";

  return (
    <div className="max-w-[1280px] mx-auto space-y-6 pb-24">
      <PortalOnboardingHero kind="vendor" entityName={entityName} heroImage={HERO} steps={steps} />

      {onboardingStatus === "REJECTED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <strong>Submission rejected.</strong>
          {onboardingRemarks ? ` ${onboardingRemarks}` : " Please update and re-submit."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <VendorForm
            formId={FORM_ID}
            presentation="portal"
            hideActions
            initial={initial}
            vendorId={vendorId}
            endpoint="/api/portal/profile"
            submitLabel="Save & Continue"
            lockSignupFields
            gstVerificationMeta={gstVerificationMeta}
            onValuesChange={setValues}
          />

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#0F172A]">Documents</h3>
              <p className="text-xs text-slate-500 mt-1">
                GST certificate, PAN card, MSME/Udyam, and transport permit (PDF, JPG — max 5 MB).
              </p>
            </div>
            <div className="p-5 sm:p-6 portal-onboarding-docs [&_.portal-onboarding-doc-grid]:lg:grid-cols-2 [&_.portal-onboarding-doc-grid]:xl:grid-cols-4">
              <OnboardingDocuments
                endpoint="/api/portal/documents"
                documents={documents}
                docTypes={VENDOR_ONBOARDING_DOCS}
                onDocumentsChange={setDocuments}
              />
            </div>
          </div>

          <OnboardingSubmit
            status={onboardingStatus}
            documents={documents}
            requiredDocTypes={VENDOR_REQUIRED_DOCS}
            variant="portal"
          />
        </div>

        <div className="xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-4.5rem)] xl:overflow-hidden">
          <PortalOnboardingSidebar
            kind="vendor"
            percent={percent}
            steps={steps}
            progressCaption={progressCaption}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 lg:left-[220px] bg-[#F4F6F9]/95 backdrop-blur border-t border-slate-200/80 px-4 sm:px-8 py-4 flex justify-end gap-3">
        <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => window.history.back()}>
          Save & Exit
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          className="rounded-xl bg-amber-500 hover:bg-amber-600 text-[#0F172A] font-semibold gap-2 px-6"
        >
          Save & Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
