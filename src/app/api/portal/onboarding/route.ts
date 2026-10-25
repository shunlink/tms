import { requireAuth, ok, badRequest, forbidden, unauthorized, serverError } from "@/lib/api";
import { onboardingSubmitSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { denyUnapprovedClientMutation } from "@/lib/client-portal-mutation-guard";
import { submitOnboarding } from "@/lib/services/onboarding.service";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  if (user.role === "CLIENT") {
    const viewOnlyDenied = await denyUnapprovedClientMutation(auth);
    if (viewOnlyDenied) return viewOnlyDenied;
  }
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(onboardingSubmitSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    let submittedStatus = "SUBMITTED";
    if (user.role === "CLIENT" && user.clientId) {
      const case_ = await submitOnboarding("CLIENT", user.clientId, parsed.data.remarks, user.id);
      submittedStatus = case_.status;
    } else if (user.role === "VENDOR" && user.vendorId) {
      const case_ = await submitOnboarding("VENDOR", user.vendorId, parsed.data.remarks);
      submittedStatus = case_.status;
    } else {
      return forbidden("No onboarding record linked to this account");
    }

    await logAudit({ user, action: "portal.onboarding.submit", entity: user.role ?? "User", entityId: user.clientId ?? user.vendorId ?? null });
    return ok({ status: submittedStatus });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to submit onboarding";
    if (
      message.includes("Missing required documents") ||
      message.includes("Complete GST") ||
      message.includes("cannot be submitted")
    ) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
