import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { denySuperAdminOnboardingOps } from "@/lib/onboarding-ops-access";
import { canAssignClientOnboardingRequests } from "@/lib/onboarding-request-access";
import {
  listAdminOnboardingRequests,
  listEmployeeOnboardingRequests,
} from "@/lib/services/onboarding.service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  const superAdminDenied = denySuperAdminOnboardingOps(auth);
  if (superAdminDenied) return superAdminDenied;
  const denied = await authorize(auth, "onboarding.ops");
  if (denied) return denied;

  try {
    const canAssign = canAssignClientOnboardingRequests(auth!.user.role);
    const requests = canAssign
      ? await listAdminOnboardingRequests()
      : await listEmployeeOnboardingRequests(auth!.user.id);
    return ok({ requests, canAssign });
  } catch (e) {
    return serverError(e);
  }
}
