export type ClientOnboardingPreference = "SELF" | "SHUNLINK";

export function onboardingCreatedByLabel(
  preference: string | null | undefined,
  submitterRole?: string | null
): "Client" | "Team" {
  if (preference === "SHUNLINK") return "Team";
  if (preference === "SELF") return "Client";
  if (submitterRole === "CLIENT") return "Client";
  return "Team";
}

/** Next onboard path for a client after login/signup (before page-specific guards). */
export function clientOnboardEntryPath(
  onboardingStatus: string,
  _onboardingPreference?: string | null
): string {
  if (onboardingStatus === "APPROVED") return "/portal/client";
  if (onboardingStatus === "PENDING" || onboardingStatus === "REJECTED") {
    return "/onboard/client";
  }
  return "/portal/client";
}
