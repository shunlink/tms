import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { vehicleSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

const COMPLIANCE_FIELDS = [
  "rcNumber", "rcExpiry", "ownerName", "ownerPan",
  "insuranceNumber", "insuranceCompany", "insuranceExpiry", "insuranceValue",
  "fitnessExpiry", "pucNumber", "pucExpiry", "permitType", "permitNumber", "permitExpiry",
] as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.view");
  if (denied) return denied;
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: params.id },
      include: { vendor: true, trips: true, compliance: true, telematics: true },
    });
    if (!vehicle) return notFound("Vehicle not found");
    return ok(vehicle);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(vehicleSchema.partial(), body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const vehicleData: Record<string, unknown> = { isActive: body.isActive };
    if (d.registrationNumber ?? d.number) {
      vehicleData.registrationNumber = (d.registrationNumber ?? d.number)?.replace(/\s+/g, "").toUpperCase();
    }
    if (d.vehicleTypeCode ?? d.type) vehicleData.vehicleTypeCode = d.vehicleTypeCode ?? d.type;
    if (d.bodyType !== undefined) vehicleData.bodyTypeCode = d.bodyType;
    if (d.capacityTons !== undefined) vehicleData.capacityTons = d.capacityTons;
    if (d.make !== undefined) vehicleData.make = d.make;
    if (d.model !== undefined) vehicleData.model = d.model;
    if (d.year !== undefined) vehicleData.year = d.year;
    if (d.ownership !== undefined) vehicleData.ownership = d.ownership;
    if (d.remarks !== undefined) vehicleData.remarks = d.remarks;
    if (d.vendorId !== undefined) vehicleData.vendorId = d.vendorId;

    const complianceUpdate: Record<string, unknown> = {};
    for (const f of COMPLIANCE_FIELDS) {
      if (d[f] !== undefined) complianceUpdate[f] = d[f];
    }

    const existing = await prisma.vehicle.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Vehicle not found");

    const vehicle = await prisma.vehicle.update({
      where: { id: params.id },
      data: {
        ...vehicleData,
        ...(Object.keys(complianceUpdate).length > 0
          ? { compliance: { upsert: { create: complianceUpdate, update: complianceUpdate } } }
          : {}),
      },
      include: { compliance: true, telematics: true },
    });
    await logAudit({ user: auth!.user, action: "vehicle.update", entity: "Vehicle", entityId: vehicle.id });
    return ok(vehicle);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.edit");
  if (denied) return denied;
  try {
    const existing = await prisma.vehicle.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Vehicle not found");
    await prisma.vehicle.update({ where: { id: params.id }, data: { isActive: false, deletedAt: new Date() } });
    await logAudit({ user: auth!.user, action: "vehicle.deactivate", entity: "Vehicle", entityId: params.id, meta: { registrationNumber: existing.registrationNumber } });
    return ok({ success: true });
  } catch {
    return badRequest("Cannot deactivate vehicle with linked trips");
  }
}
