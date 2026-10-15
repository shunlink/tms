import { requireAuth, ok, badRequest, forbidden, unauthorized, serverError } from "@/lib/api";
import { onboardingSubmitSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { submitOnboarding } from "@/lib/services/onboarding.service";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(onboardingSubmitSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    if (user.role === "CLIENT" && user.clientId) {
      await submitOnboarding("CLIENT", user.clientId, parsed.data.remarks);
    } else if (user.role === "VENDOR" && user.vendorId) {
      await submitOnboarding("VENDOR", user.vendorId, parsed.data.remarks);
    } else {
      return forbidden("No onboarding record linked to this account");
    }

    await logAudit({ user, action: "portal.onboarding.submit", entity: user.role ?? "User", entityId: user.clientId ?? user.vendorId ?? null });
    return ok({ status: "SUBMITTED" });
  } catch (e) {
    return serverError(e);
  }
}
