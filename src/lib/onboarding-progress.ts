import {
  clientOnboardingAgreementUploaded,
  clientOnboardingMandatoryProfileComplete,
} from "./client-onboarding-fields";
import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";

export type OnboardingPortalKind = "client" | "vendor";

export type OnboardingStepState = "complete" | "current" | "pending";

export type OnboardingStep = {
  id: string;
  label: string;
  state: OnboardingStepState;
};

type Doc = { type: string };

function filled(v: string | undefined | null) {
  return Boolean(v && String(v).trim());
}

function sectionRatio(keys: string[], values: Record<string, string>) {
  if (!keys.length) return 0;
  const done = keys.filter((k) => filled(values[k])).length;
  return done / keys.length;
}

export function computeClientFieldProgress(values: Record<string, string>) {
  const company = sectionRatio(
    ["name", "businessType", "industry", "website"],
    values
  );
  const contact = sectionRatio(
    ["contactName", "phone", "email", "accountsEmail", "altPhone"],
    values
  );
  const address = sectionRatio(
    ["addressLine1", "city", "state", "pincode", "country"],
    values
  );
  const compliance = sectionRatio(["gstin", "pan"], values);
  const profile = (company + contact + address) / 3;
  return {
    profile,
    compliance,
    overallFields: (profile * 0.55 + compliance * 0.45),
  };
}

function deliveryZonesFilled(values: Record<string, string>) {
  const raw = values.deliveryZones?.trim();
  if (!raw) return 0;
  return raw.split(",").filter(Boolean).length > 0 ? 1 : 0;
}

export function computeVendorFieldProgress(values: Record<string, string>) {
  const business = sectionRatio(
    ["name", "type", "contactName", "phone", "email", "whatsapp", "altPhone"],
    values
  );
  const compliance = sectionRatio(["gstin", "pan", "msme"], values);
  const address = sectionRatio(["addressLine1", "city", "state", "pincode"], values);
  const zones = deliveryZonesFilled(values);
  const settlement = sectionRatio(
    ["paymentTermsType", "bankName", "bankAccount", "bankIfsc", "accountHolder"],
    values
  );
  const businessWithZones = business * 0.55 + address * 0.2 + zones * 0.1 + settlement * 0.15;
  return {
    business: businessWithZones,
    compliance,
    overallFields: (businessWithZones * 0.5 + compliance * 0.35 + address * 0.1 + zones * 0.05),
  };
}

export function documentProgress(
  documents: Doc[],
  requiredTypes: string[]
): number {
  if (!requiredTypes.length) return 1;
  const uploaded = new Set(documents.map((d) => d.type));
  const done = requiredTypes.filter((t) => uploaded.has(t)).length;
  return done / requiredTypes.length;
}

export function computeOnboardingPercent(
  kind: OnboardingPortalKind,
  values: Record<string, string>,
  documents: Doc[],
  requiredDocTypes: string[],
  onboardingStatus: string
): number {
  if (onboardingStatus === ONBOARDING_CASE_STATUS.APPROVED) return 100;
  if (
    onboardingStatus === ONBOARDING_CASE_STATUS.SUBMITTED ||
    onboardingStatus === ONBOARDING_CASE_STATUS.PENDING_APPROVAL ||
    onboardingStatus === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION
  ) {
    return 92;
  }

  const docP = documentProgress(documents, requiredDocTypes);

  if (kind === "client") {
    const mandatoryProfile = clientOnboardingMandatoryProfileComplete(values) ? 1 : 0;
    const agreement = clientOnboardingAgreementUploaded(documents) ? 1 : 0;
    const raw = mandatoryProfile * 0.35 + docP * 0.45 + agreement * 0.1 + 0.1;
    return Math.min(88, Math.round(raw * 100));
  }

  const { business, compliance } = computeVendorFieldProgress(values);
  const raw = business * 0.35 + compliance * 0.25 + docP * 0.4;
  return Math.min(88, Math.round(raw * 100));
}

function clientSubmittedForReview(onboardingStatus: string) {
  return (
    onboardingStatus === ONBOARDING_CASE_STATUS.SUBMITTED ||
    onboardingStatus === ONBOARDING_CASE_STATUS.PENDING_APPROVAL ||
    onboardingStatus === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION ||
    onboardingStatus === ONBOARDING_CASE_STATUS.APPROVED
  );
}

export function clientOnboardingSteps(
  values: Record<string, string>,
  documents: Doc[],
  requiredDocTypes: string[],
  onboardingStatus: string
): OnboardingStep[] {
  const docP = documentProgress(documents, requiredDocTypes);
  const kycDone = clientOnboardingMandatoryProfileComplete(values);
  const agreementDone = clientOnboardingAgreementUploaded(documents);

  let current = "kyc";
  if (kycDone) current = "documents";
  if (kycDone && docP >= 1) current = "agreement";
  if (kycDone && docP >= 1 && agreementDone) current = "admin";
  if (clientSubmittedForReview(onboardingStatus)) current = "admin";

  const state = (id: string): OnboardingStepState => {
    const order = ["kyc", "documents", "agreement", "admin"];
    const ci = order.indexOf(current);
    const i = order.indexOf(id);
    if (onboardingStatus === ONBOARDING_CASE_STATUS.APPROVED) return "complete";
    if (id === "agreement" && agreementDone) return "complete";
    if (i < ci) return "complete";
    if (i === ci) return "current";
    return "pending";
  };

  return [
    { id: "kyc", label: "GST, PAN & Bank", state: state("kyc") },
    { id: "documents", label: "Documents", state: state("documents") },
    { id: "agreement", label: "Agreement", state: state("agreement") },
    { id: "admin", label: "Admin Review", state: state("admin") },
  ];
}

export function vendorOnboardingSteps(
  values: Record<string, string>,
  documents: Doc[],
  requiredDocTypes: string[],
  onboardingStatus: string
): OnboardingStep[] {
  const { business, compliance } = computeVendorFieldProgress(values);
  const docP = documentProgress(documents, requiredDocTypes);

  let current = "business";
  if (business >= 0.8) current = "compliance";
  if (business >= 0.8 && compliance >= 0.75) current = "documents";
  if (business >= 0.8 && compliance >= 0.75 && docP >= 1) current = "admin";
  if (onboardingStatus === "SUBMITTED" || onboardingStatus === "APPROVED") current = "admin";

  const state = (id: string): OnboardingStepState => {
    const order = ["account", "business", "compliance", "documents", "admin"];
    const ci = order.indexOf(current);
    const i = order.indexOf(id);
    if (id === "account") return "complete";
    if (onboardingStatus === "APPROVED") return "complete";
    if (i < ci) return "complete";
    if (i === ci) return "current";
    return "pending";
  };

  return [
    { id: "account", label: "Account created", state: state("account") },
    { id: "business", label: "Business & compliance", state: state("business") },
    { id: "documents", label: "Document verification", state: state("documents") },
    { id: "admin", label: "Admin review", state: state("admin") },
  ];
}
