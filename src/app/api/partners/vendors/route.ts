import { requireAuth, authorize, created, badRequest, serverError } from "@/lib/api";
import { provisionVendorPartnerSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { provisionVendorPartner } from "@/lib/services/partner-provisioning.service";

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(provisionVendorPartnerSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const { portal, ...profile } = parsed.data;

    const result = await provisionVendorPartner(auth!.user, profile, portal ?? null);
    await logAudit({
      user: auth!.user,
      action: "vendor.create",
      entity: "Vendor",
      entityId: result.vendorId,
      meta: { name: profile.name, onboardingStatus: result.onboardingStatus },
    });
    if (result.userId) {
      await logAudit({
        user: auth!.user,
        action: "employee.created",
        entity: "User",
        entityId: result.userId,
        meta: { role: "VENDOR", vendorId: result.vendorId },
      });
    }
    return created(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create vendor";
    if (message.includes("already exists") || message.includes("portal user")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
