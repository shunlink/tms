import type { DocTypeConfig } from "@/components/forms/onboarding-documents";

export const CLIENT_ONBOARDING_DOCS: DocTypeConfig[] = [
  { type: "GST", required: true, hint: "GST registration certificate (PDF or image)" },
  { type: "PAN", required: true, hint: "Company PAN card" },
  { type: "MSME", hint: "MSME / Udyam certificate (if applicable)" },
  { type: "BANK_PROOF", hint: "Cancelled cheque or bank statement" },
  { type: "CIN", hint: "Certificate of incorporation" },
];

export const CLIENT_ONBOARDING_AGREEMENT_DOC: DocTypeConfig = {
  type: "AGREEMENT",
  hint: "Signed client agreement (PDF or image)",
};

export const VENDOR_ONBOARDING_DOCS: DocTypeConfig[] = [
  { type: "GST", required: true, hint: "GST registration certificate" },
  { type: "PAN", required: true, hint: "Business PAN card" },
  { type: "MSME", hint: "MSME / Udyam (if applicable)" },
  { type: "BANK_PROOF", hint: "Cancelled cheque or bank proof" },
  { type: "AGREEMENT", hint: "Transporter agreement" },
];

export const CLIENT_REQUIRED_DOCS = CLIENT_ONBOARDING_DOCS.filter((d) => d.required).map((d) => d.type);
export const VENDOR_REQUIRED_DOCS = VENDOR_ONBOARDING_DOCS.filter((d) => d.required).map((d) => d.type);
