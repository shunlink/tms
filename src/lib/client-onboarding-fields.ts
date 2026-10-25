import { clientOnboardingMandatorySchema } from "./validation";

/** Profile keys required before a client can submit onboarding. */
export const CLIENT_ONBOARDING_MANDATORY_PROFILE_KEYS = [
  "gstin",
  "pan",
  "bankName",
  "bankAccount",
  "bankIfsc",
  "accountHolder",
] as const;

/** Profile keys counted toward a “fully filled” application (step 3 backend). */
export const CLIENT_ONBOARDING_FULL_PROFILE_KEYS = [
  "name",
  "businessType",
  "industry",
  "website",
  "gstin",
  "pan",
  "cin",
  "msme",
  "contactName",
  "phone",
  "altPhone",
  "email",
  "accountsEmail",
  "billingAddress",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "pincode",
  "country",
  "bankName",
  "bankAccount",
  "bankIfsc",
  "bankBranch",
  "accountHolder",
] as const;

export const CLIENT_ONBOARDING_MANDATORY_DOCUMENT_TYPES = ["GST", "PAN"] as const;

export const CLIENT_ONBOARDING_OPTIONAL_DOCUMENT_TYPES = ["MSME", "BANK_PROOF", "CIN"] as const;

export const CLIENT_ONBOARDING_AGREEMENT_DOCUMENT_TYPE = "AGREEMENT";

export const CLIENT_ONBOARDING_AGREEMENT_TEMPLATE_URL =
  "/documents/shunlink-client-agreement-placeholder.pdf";

function filled(v: string | undefined | null) {
  return Boolean(v && String(v).trim());
}

export function validateClientOnboardingMandatoryProfile(values: Record<string, string>) {
  const parsed = clientOnboardingMandatorySchema.safeParse({
    gstin: values.gstin ?? "",
    pan: values.pan ?? "",
    bankName: values.bankName ?? "",
    bankAccount: values.bankAccount ?? "",
    bankIfsc: values.bankIfsc ?? "",
    accountHolder: values.accountHolder ?? "",
    bankBranch: values.bankBranch ?? null,
  });
  if (parsed.success) return { ok: true as const, errors: [] as string[] };
  const errors = parsed.error.issues.map((i) => i.message);
  return { ok: false as const, errors };
}

export function validateClientOnboardingMandatoryDocuments(
  documents: { type: string }[],
  requiredTypes: readonly string[] = CLIENT_ONBOARDING_MANDATORY_DOCUMENT_TYPES
) {
  const uploaded = new Set(documents.map((d) => d.type));
  const missing = requiredTypes.filter((t) => !uploaded.has(t));
  return { ok: missing.length === 0, missing };
}

export function clientOnboardingMandatoryProfileComplete(values: Record<string, string>) {
  return validateClientOnboardingMandatoryProfile(values).ok;
}

export function clientOnboardingAgreementUploaded(documents: { type: string }[]) {
  return documents.some((d) => d.type === CLIENT_ONBOARDING_AGREEMENT_DOCUMENT_TYPE);
}

export function clientOnboardingFullProfileComplete(values: Record<string, string>) {
  return CLIENT_ONBOARDING_FULL_PROFILE_KEYS.every((k) => filled(values[k]));
}
