import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { denySuperAdminOnboardingOps } from "@/lib/onboarding-ops-access";
import { logAudit } from "@/lib/audit";
import { submitOnboardingByOps } from "@/lib/services/onboarding.service";
import { clientOpsCompletionSchema, validate } from "@/lib/validation";
import { getOnboardingCase } from "@/lib/services/onboarding.service";
import { ONBOARDING_CASE_STATUS } from "@/lib/onboarding-case-status";
import {
  canCompleteClientOnboardingRequest,
  isOnboardingRequestsSuperAdmin,
} from "@/lib/onboarding-request-access";
import { forbidden } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  req: Request,
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
    if (!canCompleteClientOnboardingRequest(auth!.user.id, isSuperAdmin, case_)) {
      if (!case_) return notFound("Onboarding request not found");
      return forbidden("You cannot complete this onboarding request");
    }

    const body = await req.json();
    const parsed = validate(clientOpsCompletionSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    await submitOnboardingByOps(params.clientId, auth!.user.id, parsed.data);
    await logAudit({
      user: auth!.user,
      action: "onboarding.ops.complete",
      entity: "Client",
      entityId: params.clientId,
    });
    const updated = await getOnboardingCase("CLIENT", params.clientId);
    return ok({ status: updated?.status ?? ONBOARDING_CASE_STATUS.PENDING_APPROVAL });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to complete onboarding";
    if (message.includes("Missing required documents")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
