import { requireAuth, ok, forbidden, serverError } from "@/lib/api";
import { denySuperAdminOnboardingOps } from "@/lib/onboarding-ops-access";
import { listOnboardingAssignees } from "@/lib/services/onboarding.service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  const superAdminDenied = denySuperAdminOnboardingOps(auth);
  if (superAdminDenied) return superAdminDenied;
  if (auth!.user.role !== "SUPER_ADMIN") {
    return forbidden("Only Super Admin can assign onboarding requests");
  }

  try {
    const assignees = await listOnboardingAssignees();
    return ok({ assignees });
  } catch (e) {
    return serverError(e);
  }
}
