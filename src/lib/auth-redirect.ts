import { redirect } from "next/navigation";
import type { SessionUser } from "./auth";
import { getClientDetail, getOnboardingStatus } from "./queries";
import { portalHomeForRole } from "./portal-access";

export async function resolveAuthenticatedHomePath(user: SessionUser): Promise<string> {
  const role = user.role ?? "";
  if (role === "CLIENT" && user.clientId) {
    const onboarding = await getOnboardingStatus("CLIENT", user.clientId);
    const client = await getClientDetail(user.clientId);
    return portalHomeForRole(
      "CLIENT",
      onboarding?.onboardingStatus ?? "PENDING",
      client?.onboardingPreference ?? null
    );
  }
  if (role === "VENDOR" && user.vendorId) {
    const onboarding = await getOnboardingStatus("VENDOR", user.vendorId);
    return portalHomeForRole("VENDOR", onboarding?.onboardingStatus ?? "PENDING");
  }
  return portalHomeForRole(role);
}

/** Redirect logged-in users away from login / welcome entry points. */
export async function redirectIfAuthenticated(user: SessionUser | null) {
  if (!user?.id) return;
  const path = await resolveAuthenticatedHomePath(user);
  redirect(path);
}
