import { requireAuth, ok, badRequest, forbidden, unauthorized, serverError } from "@/lib/api";
import { getOnboardingStatus, setClientOnboardingPreference } from "@/lib/services/onboarding.service";
import { clientOnboardingPreferenceSchema, validate } from "@/lib/validation";
import { canSelfServiceEditPortalProfile } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  if (user.role !== "CLIENT" || !user.clientId) return forbidden();

  try {
    const status = await getOnboardingStatus("CLIENT", user.clientId);
    if (!canSelfServiceEditPortalProfile(status)) {
      return forbidden("Onboarding preference cannot be changed in the current state");
    }

    const client = await prisma.client.findFirst({
      where: { id: user.clientId },
      select: { onboardingPreference: true },
    });
    if (client?.onboardingPreference) {
      return badRequest("Onboarding path is already selected");
    }

    const body = await req.json();
    const parsed = validate(clientOnboardingPreferenceSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    await setClientOnboardingPreference(user.clientId, parsed.data.preference);
    return ok({ preference: parsed.data.preference });
  } catch (e) {
    return serverError(e);
  }
}
