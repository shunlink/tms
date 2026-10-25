import { describe, expect, it } from "vitest";
import {
  CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS,
  evaluateClientOnboardingSubmission,
  missingClientOnboardingSubmissionFields,
} from "./client-onboarding-submission";
import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";

const fullProfile = {
  name: "Acme Logistics Pvt Ltd",
  businessType: "PRIVATE_LIMITED",
  industry: "Logistics",
  website: "https://acme.example",
  gstin: "27AABCU9603R1ZM",
  pan: "AABCU9603R",
  cin: "U12345MH2020PTC123456",
  msme: "UDYAM-MH-12-1234567",
  contactName: "Jane Doe",
  phone: "919820012345",
  altPhone: "919820099999",
  email: "jane@acme.example",
  accountsEmail: "accounts@acme.example",
  billingAddress: "Line 1, Mumbai",
  addressLine1: "Plot 1",
  addressLine2: "Sector 2",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "India",
  bankName: "HDFC Bank",
  bankAccount: "1234567890",
  bankIfsc: "HDFC0001234",
  bankBranch: "Andheri",
  accountHolder: "Acme Logistics Pvt Ltd",
};

const fullDocs = [
  { type: "GST", url: "https://files/gst.pdf" },
  { type: "PAN", url: "https://files/pan.pdf" },
  { type: "MSME", url: "https://files/msme.pdf" },
  { type: "BANK_PROOF", url: "https://files/bank.pdf" },
  { type: "CIN", url: "https://files/cin.pdf" },
  { type: "AGREEMENT", url: "https://files/agreement.pdf" },
];

describe("CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS", () => {
  it("includes profile, documents, and agreement", () => {
    expect(CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS).toContain("name");
    expect(CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS).toContain("doc:GST");
    expect(CLIENT_ONBOARDING_SUBMISSION_FIELD_KEYS).toContain("agreement");
  });
});

describe("evaluateClientOnboardingSubmission", () => {
  it("returns PENDING_APPROVAL when every expected field is present", () => {
    const result = evaluateClientOnboardingSubmission({
      profile: fullProfile,
      documents: fullDocs,
    });
    expect(result.status).toBe(ONBOARDING_CASE_STATUS.PENDING_APPROVAL);
    expect(result.fullyFilled).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns PARTIAL_SUBMISSION when optional profile or agreement is missing", () => {
    const missingAgreement = evaluateClientOnboardingSubmission({
      profile: fullProfile,
      documents: fullDocs.filter((d) => d.type !== "AGREEMENT"),
    });
    expect(missingAgreement.status).toBe(ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION);
    expect(missingAgreement.missing).toContain("agreement");

    const missingIndustry = evaluateClientOnboardingSubmission({
      profile: { ...fullProfile, industry: "" },
      documents: fullDocs,
    });
    expect(missingIndustry.status).toBe(ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION);
    expect(missingClientOnboardingSubmissionFields({
      profile: { ...fullProfile, industry: "" },
      documents: fullDocs,
    })).toContain("industry");
  });
});
