import { requireAuth, authorize, created, badRequest, serverError } from "@/lib/api";
import { provisionClientPartnerSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { provisionClientPartner } from "@/lib/services/partner-provisioning.service";

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(provisionClientPartnerSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const { portal, ...profile } = parsed.data;

    const result = await provisionClientPartner(auth!.user, profile, portal ?? null);
    await logAudit({
      user: auth!.user,
      action: "client.create",
      entity: "Client",
      entityId: result.clientId,
      meta: { name: profile.name, onboardingStatus: result.onboardingStatus },
    });
    if (result.userId) {
      await logAudit({
        user: auth!.user,
        action: "employee.created",
        entity: "User",
        entityId: result.userId,
        meta: { role: "CLIENT", clientId: result.clientId },
      });
    }
    return created(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create client";
    if (message.includes("already exists")) return badRequest(message);
    return serverError(e);
  }
}
