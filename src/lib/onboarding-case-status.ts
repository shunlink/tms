/** OnboardingCase.status values (string column; shared across app and migrations). */
export const ONBOARDING_CASE_STATUS = {
  PENDING: "PENDING",
  /** Client submitted mandatory fields only (or any optional field missing). */
  PARTIAL_SUBMISSION: "PARTIAL_SUBMISSION",
  /** Admin assigned to an employee; 24h SLA may apply. */
  ASSIGNED_TO_EMPLOYEE: "ASSIGNED_TO_EMPLOYEE",
  /** Full application ready for admin approval. */
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  /** @deprecated Use PARTIAL_SUBMISSION */
  PENDING_OPS_ONBOARDING: "PENDING_OPS_ONBOARDING",
  /** @deprecated Use PENDING_APPROVAL */
  SUBMITTED: "SUBMITTED",
} as const;

export type OnboardingCaseStatus =
  (typeof ONBOARDING_CASE_STATUS)[keyof typeof ONBOARDING_CASE_STATUS];

export const CLIENT_ONBOARDING_TERMINAL_STATUSES: OnboardingCaseStatus[] = [
  ONBOARDING_CASE_STATUS.APPROVED,
  ONBOARDING_CASE_STATUS.REJECTED,
];

export const CLIENT_ONBOARDING_ADMIN_REQUESTS_STATUSES: OnboardingCaseStatus[] = [
  ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION,
  ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE,
];

export const CLIENT_ONBOARDING_ADMIN_APPROVALS_STATUSES: OnboardingCaseStatus[] = [
  ONBOARDING_CASE_STATUS.PENDING_APPROVAL,
];
