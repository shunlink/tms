import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { vendorSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { updateVendorProfile } from "@/lib/services/profile.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.view");
  if (denied) return denied;
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { id: params.id },
      include: { vehicles: true, trips: true, payments: true, commercial: true },
    });
    if (!vendor) return notFound("Vendor not found");
    return ok(vendor);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(vendorSchema.partial(), body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const existing = await prisma.vendor.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Vendor not found");

    const vendor = await updateVendorProfile(params.id, d);
    if (!vendor) return notFound("Vendor not found");
    if (body.isActive != null) {
      await prisma.vendor.update({ where: { id: params.id }, data: { isActive: body.isActive } });
    }
    await logAudit({ user: auth!.user, action: "vendor.update", entity: "Vendor", entityId: vendor.id });
    return ok(vendor);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vendor.edit");
  if (denied) return denied;
  try {
    const existing = await prisma.vendor.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Vendor not found");
    await prisma.vendor.update({ where: { id: params.id }, data: { isActive: false, deletedAt: new Date() } });
    await logAudit({ user: auth!.user, action: "vendor.deactivate", entity: "Vendor", entityId: params.id, meta: { name: existing.name } });
    return ok({ success: true });
  } catch {
    return badRequest("Cannot deactivate vendor with linked records");
  }
}
