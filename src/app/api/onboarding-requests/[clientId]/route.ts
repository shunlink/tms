import { requireAuth, authorize, ok, notFound, forbidden, serverError } from "@/lib/api";
import { denySuperAdminOnboardingOps } from "@/lib/onboarding-ops-access";
import { getOnboardingCase } from "@/lib/services/onboarding.service";
import { getClientDetail } from "@/lib/queries";
import {
  canAccessClientOnboardingRequest,
  isOnboardingRequestsSuperAdmin,
} from "@/lib/onboarding-request-access";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const auth = await requireAuth();
  const superAdminDenied = denySuperAdminOnboardingOps(auth);
  if (superAdminDenied) return superAdminDenied;
  const denied = await authorize(auth, "onboarding.ops");
  if (denied) return denied;

  try {
    const case_ = await getOnboardingCase("CLIENT", params.clientId);
    const isSuperAdmin = isOnboardingRequestsSuperAdmin(auth!.user.role);
    if (!canAccessClientOnboardingRequest(auth!.user.id, isSuperAdmin, case_)) {
      if (!case_) return notFound("Onboarding request not found");
      return forbidden("You do not have access to this onboarding request");
    }
    const client = await getClientDetail(params.clientId);
    if (!client) return notFound("Client not found");
    return ok({ client, case: case_ });
  } catch (e) {
    return serverError(e);
  }
}
