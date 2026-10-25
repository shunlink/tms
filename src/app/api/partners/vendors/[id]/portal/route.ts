import { requireAuth, authorize, created, badRequest, serverError, notFound } from "@/lib/api";
import { partnerPortalCredentialsOnlySchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { attachVendorPortalUser } from "@/lib/services/partner-provisioning.service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.edit");
  if (denied) return denied;
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
    if (!vendor) return notFound("Vendor not found");

    const body = await req.json();
    const parsed = validate(partnerPortalCredentialsOnlySchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const result = await attachVendorPortalUser(
      params.id,
      parsed.data,
      vendor.contactName ?? vendor.name
    );
    await logAudit({
      user: auth!.user,
      action: "employee.created",
      entity: "User",
      entityId: result.userId,
      meta: { role: "VENDOR", vendorId: params.id },
    });
    return created(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create portal user";
    if (message.includes("already exists") || message.includes("portal user")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
