import { requireAuth, ok, badRequest, forbidden, unauthorized, serverError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOnboardingStatus } from "@/lib/services/onboarding.service";
import { submitClientShunlinkAssist } from "@/lib/services/onboarding.service";
import { clientShunlinkAssistSchema, validate } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  if (user.role !== "CLIENT" || !user.clientId) return forbidden();

  try {
    const status = await getOnboardingStatus("CLIENT", user.clientId);
    if (status !== "PENDING") {
      return badRequest("This onboarding step is not available in the current state");
    }

    const client = await prisma.client.findFirst({
      where: { id: user.clientId },
      select: { onboardingPreference: true },
    });
    if (client?.onboardingPreference !== "SHUNLINK") {
      return badRequest("Shunlink-assisted onboarding was not selected");
    }

    const body = await req.json();
    const parsed = validate(clientShunlinkAssistSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    await submitClientShunlinkAssist(user.clientId, parsed.data);
    await logAudit({
      user,
      action: "portal.client.shunlink_assist",
      entity: "Client",
      entityId: user.clientId,
    });
    return ok({ status: "PENDING_OPS_ONBOARDING" });
  } catch (e) {
    return serverError(e);
  }
}
