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
    ["name", "legalName", "industry", "website"],
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

export function computeVendorFieldProgress(values: Record<string, string>) {
  const business = sectionRatio(
    ["name", "type", "contactName", "phone", "email", "whatsapp", "altPhone"],
    values
  );
  const compliance = sectionRatio(["gstin", "pan", "msme"], values);
  const address = sectionRatio(["addressLine1", "city", "state", "pincode"], values);
  return {
    business: (business * 0.7 + address * 0.3),
    compliance,
    overallFields: (business * 0.5 + compliance * 0.35 + address * 0.15),
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
  if (onboardingStatus === "APPROVED") return 100;
  if (onboardingStatus === "SUBMITTED") return 92;

  const docP = documentProgress(documents, requiredDocTypes);

  if (kind === "client") {
    const { profile, compliance } = computeClientFieldProgress(values);
    const raw = profile * 0.35 + compliance * 0.25 + docP * 0.4;
    return Math.min(88, Math.round(raw * 100));
  }

  const { business, compliance } = computeVendorFieldProgress(values);
  const raw = business * 0.35 + compliance * 0.25 + docP * 0.4;
  return Math.min(88, Math.round(raw * 100));
}

export function clientOnboardingSteps(
  values: Record<string, string>,
  documents: Doc[],
  requiredDocTypes: string[],
  onboardingStatus: string
): OnboardingStep[] {
  const { profile, compliance } = computeClientFieldProgress(values);
  const docP = documentProgress(documents, requiredDocTypes);

  let current = "company";
  if (profile >= 0.85) current = "compliance";
  if (profile >= 0.85 && compliance >= 0.8) current = "documents";
  if (profile >= 0.85 && compliance >= 0.8 && docP >= 1) current = "admin";
  if (onboardingStatus === "SUBMITTED" || onboardingStatus === "APPROVED") current = "admin";

  const state = (id: string): OnboardingStepState => {
    const order = ["company", "compliance", "documents", "admin"];
    const ci = order.indexOf(current);
    const i = order.indexOf(id);
    if (onboardingStatus === "APPROVED") return "complete";
    if (i < ci) return "complete";
    if (i === ci) return "current";
    return "pending";
  };

  return [
    { id: "company", label: "Company Profile", state: state("company") },
    { id: "compliance", label: "Business & Compliance", state: state("compliance") },
    { id: "documents", label: "Documents", state: state("documents") },
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
