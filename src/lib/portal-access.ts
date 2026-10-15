export type OnboardingGate = {
  onboardingStatus: string;
  onboardingRemarks?: string | null;
};

export function shouldCompleteOnboarding(status: string) {
  return status === "PENDING" || status === "REJECTED";
}

export function onboardPathForRole(role: string) {
  if (role === "CLIENT") return "/onboard/client";
  if (role === "VENDOR") return "/onboard/vendor";
  return "/login";
}

export function portalHomeForRole(role?: string, onboardingStatus?: string) {
  if (role === "CLIENT") {
    if (!onboardingStatus || onboardingStatus === "PENDING") return "/onboard/client";
    if (onboardingStatus === "APPROVED") return "/portal/client";
    return "/portal/client/profile";
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

export function isProfileOnlyStatus(status: string) {
  return status === "SUBMITTED" || status === "REJECTED";
}

/** Profile fields collected at signup; locked during onboarding until approved. */
export const SIGNUP_LOCKED_PROFILE_FIELDS = ["name", "contactName", "phone", "email"] as const;

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
