"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientForm from "@/components/forms/client-form";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import OnboardingSubmit from "@/components/forms/onboarding-submit";
import ClientOnboardingAgreementPanel from "./client-onboarding-agreement-panel";
import PortalOnboardingHero from "./portal-onboarding-hero";
import PortalOnboardingSidebar from "./portal-onboarding-sidebar";
import {
  clientOnboardingSteps,
  computeOnboardingPercent,
} from "@/lib/onboarding-progress";
import { CLIENT_ONBOARDING_DOCS, CLIENT_REQUIRED_DOCS } from "@/lib/onboarding-docs";
import { isOnboardingFormReadOnly } from "@/lib/portal-access";
import { ONBOARDING_CASE_STATUS } from "@/lib/onboarding-case-status";

const FORM_ID = "portal-onboard-client-form";
const HERO = "/portal/portal-onboarding-hero-client.webp";

type Doc = { id: string; type: string; url: string; name: string | null };

type OnboardingTab = "profile" | "documents" | "agreement";

const TABS: { id: OnboardingTab; label: string }[] = [
  { id: "profile", label: "Company profile" },
  { id: "documents", label: "Documents" },
  { id: "agreement", label: "Agreement" },
];

const TAB_FLOW: OnboardingTab[] = ["profile", "documents", "agreement"];

function tabNav(activeTab: OnboardingTab) {
  const index = TAB_FLOW.indexOf(activeTab);
  return {
    prev: index > 0 ? TAB_FLOW[index - 1] : null,
    next: index < TAB_FLOW.length - 1 ? TAB_FLOW[index + 1] : null,
  };
}

function OnboardingTabNav({
  activeTab,
  onChange,
  readOnly,
}: {
  activeTab: OnboardingTab;
  onChange: (tab: OnboardingTab) => void;
  readOnly?: boolean;
}) {
  if (readOnly) return null;
  const { prev, next } = tabNav(activeTab);
  const nextLabel = TABS.find((t) => t.id === next)?.label;
  const prevLabel = TABS.find((t) => t.id === prev)?.label;
  if (!prev && !next) return null;

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      {prev ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-xl gap-2"
          onClick={() => onChange(prev)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {prevLabel}
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button type="button" className="rounded-xl gap-2 sm:ml-auto" onClick={() => onChange(next)}>
          Next: {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export default function PortalOnboardingClientContent({
  clientId,
  entityName,
  onboardingStatus,
  onboardingRemarks,
  initial,
  documents: initialDocuments,
  gstVerificationMeta,
}: {
  clientId: string;
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
  const [activeTab, setActiveTab] = useState<OnboardingTab>("profile");
  const readOnly = isOnboardingFormReadOnly(onboardingStatus);
  const canSubmit =
    onboardingStatus === ONBOARDING_CASE_STATUS.PENDING ||
    onboardingStatus === ONBOARDING_CASE_STATUS.REJECTED;

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const steps = useMemo(
    () => clientOnboardingSteps(values, documents, CLIENT_REQUIRED_DOCS, onboardingStatus),
    [values, documents, onboardingStatus]
  );
  const percent = useMemo(
    () =>
      computeOnboardingPercent("client", values, documents, CLIENT_REQUIRED_DOCS, onboardingStatus),
    [values, documents, onboardingStatus]
  );
  const currentStep = steps.find((s) => s.state === "current");
  const progressCaption = currentStep
    ? `${currentStep.label} in progress. Complete the remaining steps to get started.`
    : "Complete the remaining steps to get started.";

  const postSubmit =
    onboardingStatus === ONBOARDING_CASE_STATUS.SUBMITTED ||
    onboardingStatus === ONBOARDING_CASE_STATUS.PENDING_APPROVAL ||
    onboardingStatus === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION;

  return (
    <div className={`max-w-[1280px] mx-auto space-y-6 ${canSubmit ? "pb-24" : "pb-8"}`}>
      <PortalOnboardingHero kind="client" entityName={entityName} heroImage={HERO} steps={steps} />

      {onboardingStatus === ONBOARDING_CASE_STATUS.REJECTED && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <strong>Submission rejected.</strong>
          {onboardingRemarks ? ` ${onboardingRemarks}` : " Please update your details and re-submit."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <nav
            className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm"
            aria-label="Onboarding sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#0F172A] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="space-y-6 min-w-0 [&_.portal-onboard-card]:rounded-2xl [&_.portal-onboard-card]:border-slate-200/80 [&_.portal-onboard-card]:shadow-sm">
            {activeTab === "profile" && (
              <>
                <ClientForm
                  formId={FORM_ID}
                  presentation="portal"
                  hideActions
                  readOnly={readOnly}
                  initial={initial}
                  clientId={clientId}
                  endpoint="/api/portal/profile"
                  variant="onboarding"
                  lockSignupFields
                  gstVerificationMeta={gstVerificationMeta}
                  onValuesChange={setValues}
                />
                <OnboardingTabNav
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  readOnly={readOnly}
                />
              </>
            )}

            {activeTab === "documents" && (
              <>
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Documents</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    GST certificate and PAN card are required. Other documents are optional (PDF, JPG — max 5 MB).
                  </p>
                </div>
                <div className="p-5 sm:p-6 portal-onboarding-docs">
                  <OnboardingDocuments
                    endpoint="/api/portal/documents"
                    documents={documents.filter((d) => d.type !== "AGREEMENT")}
                    docTypes={CLIENT_ONBOARDING_DOCS}
                    onDocumentsChange={(next) => {
                      const agreement = documents.filter((d) => d.type === "AGREEMENT");
                      setDocuments([...next, ...agreement]);
                    }}
                    readOnly={readOnly}
                  />
                </div>
              </div>
              <OnboardingTabNav
                activeTab={activeTab}
                onChange={setActiveTab}
                readOnly={readOnly}
              />
              </>
            )}

            {activeTab === "agreement" && (
              <>
                <ClientOnboardingAgreementPanel
                  documents={documents}
                  readOnly={readOnly}
                  onDocumentsChange={setDocuments}
                />
                <OnboardingTabNav
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  readOnly={readOnly}
                />
              </>
            )}

            {postSubmit && (
              <OnboardingSubmit
                status={onboardingStatus}
                documents={documents}
                requiredDocTypes={CLIENT_REQUIRED_DOCS}
              />
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-4.5rem)] xl:overflow-hidden">
          <PortalOnboardingSidebar
            kind="client"
            percent={percent}
            steps={steps}
            progressCaption={progressCaption}
          />
        </div>
      </div>

      {canSubmit && (
        <OnboardingSubmit
          status={onboardingStatus}
          documents={documents}
          requiredDocTypes={CLIENT_REQUIRED_DOCS}
          placement="footer"
          profileValues={values}
        />
      )}
    </div>
  );
}
