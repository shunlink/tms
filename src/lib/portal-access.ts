import { clientOnboardEntryPath } from "./client-onboarding";
import { ONBOARDING_CASE_STATUS } from "./onboarding-case-status";

export type OnboardingGate = {
  onboardingStatus: string;
  onboardingRemarks?: string | null;
  onboardingPreference?: string | null;
};

export function shouldCompleteOnboarding(status: string) {
  return (
    status === ONBOARDING_CASE_STATUS.PENDING || status === ONBOARDING_CASE_STATUS.REJECTED
  );
}

export function onboardPathForRole(role: string) {
  if (role === "CLIENT") return "/onboard/client";
  if (role === "VENDOR") return "/onboard/vendor";
  return "/login";
}

export function portalHomeForRole(
  role?: string,
  onboardingStatus?: string,
  onboardingPreference?: string | null
) {
  if (role === "CLIENT") {
    return clientOnboardEntryPath(onboardingStatus ?? ONBOARDING_CASE_STATUS.PENDING);
  }
  if (role === "VENDOR") {
    if (!onboardingStatus || onboardingStatus === "PENDING") return "/onboard/vendor";
    if (onboardingStatus === "APPROVED") return "/portal/vendor";
    return "/portal/vendor/profile";
  }
  if (role === "DRIVER") return "/driver";
  return "/";
}

export function profilePathForRole(role: string) {
  if (role === "CLIENT") return "/portal/client/profile";
  if (role === "VENDOR") return "/portal/vendor/profile";
  if (role === "DRIVER") return "/driver/profile";
  return "/login";
}

/** Client may change portal data only when approved or while completing onboarding. */
export function canClientPerformPortalMutations(status: string) {
  if (status === ONBOARDING_CASE_STATUS.APPROVED) return true;
  if (
    status === ONBOARDING_CASE_STATUS.PENDING ||
    status === ONBOARDING_CASE_STATUS.REJECTED
  ) {
    return true;
  }
  return false;
}

/** Browse portal after submit, but no create/edit/delete until admin approval. */
export function isClientPortalViewOnly(status: string) {
  return !canClientPerformPortalMutations(status);
}

/** @deprecated Use isClientPortalViewOnly */
export function isProfileOnlyStatus(status: string) {
  return isClientPortalViewOnly(status);
}

/** Portal profile/doc edits allowed only during onboarding (not after submit/approval). */
export function canSelfServiceEditPortalProfile(status: string) {
  return (
    status === ONBOARDING_CASE_STATUS.PENDING || status === ONBOARDING_CASE_STATUS.REJECTED
  );
}

export function isOnboardingFormReadOnly(status: string) {
  return !canSelfServiceEditPortalProfile(status);
}

/** Profile fields collected at signup; locked during onboarding until approved. */
export const SIGNUP_LOCKED_PROFILE_FIELDS = ["name", "phone", "email"] as const;

export function stripSignupLockedProfileFields<T extends Record<string, unknown>>(
  data: T,
  onboardingStatus: string
): T {
  if (onboardingStatus === "APPROVED") return data;
  const result = { ...data };
  for (const key of SIGNUP_LOCKED_PROFILE_FIELDS) {
    delete result[key];
  }
  return result;
}
