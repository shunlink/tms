/** Configurable finance policy for formal notes — not scattered magic numbers in routes. */

export type FinancialNotePolicy = {
  /** Amount above which a second approver tier would be required (future); stored for reporting. */
  elevatedApprovalThresholdInr: number;
  /** Notes at or above this total require explicit approval before issuance. */
  approvalRequiredAboveInr: number;
  /** When true, creator cannot approve their own note. */
  prohibitSelfApproval: boolean;
  /** When true, issuer must be different from approver (separation of duties). */
  separateIssuerFromApprover: boolean;
  /** Default tax jurisdiction label — statutory rules remain finance-owned. */
  defaultTaxJurisdiction: string;
};

const envNum = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const envBool = (key: string, fallback: boolean) => {
  const raw = process.env[key]?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
};

export function getFinancialNotePolicy(): FinancialNotePolicy {
  return {
    elevatedApprovalThresholdInr: envNum("FINANCIAL_NOTE_ELEVATED_APPROVAL_INR", 500_000),
    approvalRequiredAboveInr: envNum("FINANCIAL_NOTE_APPROVAL_THRESHOLD_INR", -1),
    prohibitSelfApproval: envBool("FINANCIAL_NOTE_PROHIBIT_SELF_APPROVAL", true),
    separateIssuerFromApprover: envBool("FINANCIAL_NOTE_SEPARATE_ISSUER", true),
    defaultTaxJurisdiction: process.env.FINANCIAL_NOTE_TAX_JURISDICTION?.trim() || "IN-CONFIGURE",
  };
}

export function noteRequiresApproval(totalAmountInr: number): boolean {
  const policy = getFinancialNotePolicy();
  if (policy.approvalRequiredAboveInr < 0) return false;
  return totalAmountInr > policy.approvalRequiredAboveInr;
}
