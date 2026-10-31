import { requireAuth, ok, badRequest, forbidden, unauthorized, notFound, serverError } from "@/lib/api";
import { clientSchema, vendorSchema, driverSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { updateClientProfile, updateVendorProfile } from "@/lib/services/profile.service";
import { getOnboardingStatus } from "@/lib/services/onboarding.service";
import { denyUnapprovedClientMutation } from "@/lib/client-portal-mutation-guard";
import { canSelfServiceEditPortalProfile, stripSignupLockedProfileFields } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const user = auth.user;
  try {
    const body = await req.json();

    if (user.role === "CLIENT") {
      if (!user.clientId) return forbidden("No client account linked");
      const viewOnlyDenied = await denyUnapprovedClientMutation(auth);
      if (viewOnlyDenied) return viewOnlyDenied;
      const onboardingStatus = await getOnboardingStatus("CLIENT", user.clientId);
      if (!canSelfServiceEditPortalProfile(onboardingStatus)) {
        return forbidden("Profile is read-only. Contact your administrator to make changes.");
      }
      const parsed = validate(clientSchema.partial(), body);
      if (!parsed.success) return badRequest(parsed.error);
      const data = stripSignupLockedProfileFields(parsed.data, onboardingStatus);
      const record = await updateClientProfile(user.clientId, data);
      if (!record) return notFound("Client not found");
      await logAudit({ user, action: "portal.client.update", entity: "Client", entityId: record.id });
      return ok({ id: record.id, name: record.name });
    }

    if (user.role === "VENDOR") {
      if (!user.vendorId) return forbidden("No vendor account linked");
      const onboardingStatus = await getOnboardingStatus("VENDOR", user.vendorId);
      if (!canSelfServiceEditPortalProfile(onboardingStatus)) {
        return forbidden("Profile is read-only. Contact your administrator to make changes.");
      }
      const parsed = validate(vendorSchema.partial(), body);
      if (!parsed.success) return badRequest(parsed.error);
      const data = stripSignupLockedProfileFields(parsed.data, onboardingStatus);
      const record = await updateVendorProfile(user.vendorId, data);
      if (!record) return notFound("Vendor not found");
      await logAudit({ user, action: "portal.vendor.update", entity: "Vendor", entityId: record.id });
      return ok({ id: record.id, name: record.name });
    }

    if (user.role === "DRIVER") {
      if (!user.driverId) return forbidden("No driver account linked");
      const parsed = validate(driverSchema.partial(), body);
      if (!parsed.success) return badRequest(parsed.error);
      const existing = await prisma.driver.findFirst({ where: { id: user.driverId } });
      if (!existing) return notFound("Driver not found");

      const record = await prisma.driver.update({
        where: { id: user.driverId },
        data: {
          ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
          ...(parsed.data.dlNumber !== undefined ? { dlNumber: parsed.data.dlNumber.replace(/\s+/g, "").toUpperCase() } : {}),
          ...(parsed.data.dlExpiry !== undefined ? { dlExpiry: parsed.data.dlExpiry } : {}),
          ...(parsed.data.dateOfBirth !== undefined ? { dateOfBirth: parsed.data.dateOfBirth } : {}),
          ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
          ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
          ...(parsed.data.state !== undefined ? { state: parsed.data.state } : {}),
          ...(parsed.data.pincode !== undefined ? { pincode: parsed.data.pincode } : {}),
        },
      });
      await logAudit({ user, action: "portal.driver.update", entity: "Driver", entityId: record.id });
      return ok({ id: record.id, name: record.name });
    }

    return forbidden("Not a portal user");
  } catch (e) {
    return serverError(e);
  }
}
