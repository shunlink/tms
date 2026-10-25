import {
  CLIENT_ONBOARDING_AGREEMENT_DOCUMENT_TYPE,
  CLIENT_ONBOARDING_FULL_PROFILE_KEYS,
  CLIENT_ONBOARDING_MANDATORY_DOCUMENT_TYPES,
  CLIENT_ONBOARDING_MANDATORY_PROFILE_KEYS,
  CLIENT_ONBOARDING_OPTIONAL_DOCUMENT_TYPES,
  validateClientOnboardingMandatoryDocuments,
  validateClientOnboardingMandatoryProfile,
} from "./client-onboarding-fields";
import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";

/**
 * Every expected onboarding field key (profile columns, document slots, agreement).
 * Used to decide PENDING_APPROVAL vs PARTIAL_SUBMISSION.
 */
export const CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS = [
  ...CLIENT_ONBOARDING_FULL_PROFILE_KEYS,
  ...CLIENT_ONBOARDING_MANDATORY_DOCUMENT_TYPES.map((t) => `doc:${t}`),
  ...CLIENT_ONBOARDING_OPTIONAL_DOCUMENT_TYPES.map((t) => `doc:${t}`),
  "agreement",
] as const;

export type ClientOnboardingSubmissionFieldKey =
  (typeof CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS)[number];

export type ClientOnboardingSubmissionSnapshot = {
  profile: Record<string, string | null | undefined>;
  documents: { type: string; url?: string | null }[];
};

function filled(v: string | null | undefined) {
  return Boolean(v && String(v).trim());
}

function agreementFilled(snapshot: ClientOnboardingSubmissionSnapshot) {
  return snapshot.documents.some((d) => d.type === CLIENT_ONBOARDING_AGREEMENT_DOCUMENT_TYPE);
}

export function isClientOnboardingSubmissionFieldFilled(
  key: ClientOnboardingSubmissionFieldKey,
  snapshot: ClientOnboardingSubmissionSnapshot
): boolean {
  if (key === "agreement") return agreementFilled(snapshot);
  if (key.startsWith("doc:")) {
    const docType = key.slice(4);
    return snapshot.documents.some((d) => d.type === docType);
  }
  return filled(snapshot.profile[key]);
}

export function missingClientOnboardingSubmissionFields(
  snapshot: ClientOnboardingSubmissionSnapshot
): ClientOnboardingSubmissionFieldKey[] {
  return CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS.filter(
    (key) => !isClientOnboardingSubmissionFieldFilled(key, snapshot)
  );
}

export type ClientOnboardingSubmissionEvaluation = {
  status:
    | typeof ONBOARDING_CASE_STATUS.PENDING_APPROVAL
    | typeof ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION;
  fullyFilled: boolean;
  missing: ClientOnboardingSubmissionFieldKey[];
};

export function evaluateClientOnboardingSubmission(
  snapshot: ClientOnboardingSubmissionSnapshot
): ClientOnboardingSubmissionEvaluation {
  const missing = missingClientOnboardingSubmissionFields(snapshot);
  if (missing.length === 0) {
    return {
      status: ONBOARDING_CASE_STATUS.PENDING_APPROVAL,
      fullyFilled: true,
      missing: [],
    };
  }
  return {
    status: ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
    fullyFilled: false,
    missing,
  };
}

export function assertClientOnboardingMandatorySubmission(
  snapshot: ClientOnboardingSubmissionSnapshot
): void {
  const profileValues = Object.fromEntries(
    CLIENT_ONBOARDING_MANDATORY_PROFILE_KEYS.map((k) => [k, snapshot.profile[k] ?? ""])
  );
  const profileCheck = validateClientOnboardingMandatoryProfile(profileValues);
  if (!profileCheck.ok) {
    throw new Error(profileCheck.errors[0] ?? "Complete GST, PAN, and bank details before submitting.");
  }

  const docCheck = validateClientOnboardingMandatoryDocuments(snapshot.documents);
  if (!docCheck.ok) {
    throw new Error(`Missing required documents: ${docCheck.missing.join(", ")}`);
  }
}

export function resolveClientAgreementUrl(
  snapshot: ClientOnboardingSubmissionSnapshot
): string | null {
  const agreement = snapshot.documents.find(
    (d) => d.type === CLIENT_ONBOARDING_AGREEMENT_DOCUMENT_TYPE
  );
  return agreement?.url?.trim() || null;
}

/** Map DB client + documents into a submission snapshot. */
export function buildClientOnboardingSubmissionSnapshot(input: {
  client: {
    name: string;
    legalName?: string | null;
    businessType?: string | null;
    industry?: string | null;
    website?: string | null;
    gstin?: string | null;
    pan?: string | null;
    cin?: string | null;
    msme?: string | null;
    contactName?: string | null;
    phone?: string | null;
    altPhone?: string | null;
    email?: string | null;
    accountsEmail?: string | null;
    billingAddress?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    bankIfsc?: string | null;
    bankBranch?: string | null;
    accountHolder?: string | null;
  };
  documents: { type: string; url?: string | null }[];
}): ClientOnboardingSubmissionSnapshot {
  const { client, documents } = input;
  const profile: Record<string, string | null | undefined> = {};
  for (const key of CLIENT_ONBOARDING_FULL_PROFILE_KEYS) {
    profile[key] = (client as Record<string, string | null | undefined>)[key] ?? null;
  }
  return { profile, documents };
}
