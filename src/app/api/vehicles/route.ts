import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, created, badRequest, serverError, safeOk } from "@/lib/api";
import { vehicleSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

function complianceData(d: ReturnType<typeof vehicleSchema.parse>) {
  return {
    rcNumber: d.rcNumber,
    rcExpiry: d.rcExpiry,
    ownerName: d.ownerName,
    ownerPan: d.ownerPan,
    insuranceNumber: d.insuranceNumber,
    insuranceCompany: d.insuranceCompany,
    insuranceExpiry: d.insuranceExpiry,
    insuranceValue: d.insuranceValue,
    fitnessExpiry: d.fitnessExpiry,
    pucNumber: d.pucNumber,
    pucExpiry: d.pucExpiry,
    permitType: d.permitType,
    permitNumber: d.permitNumber,
    permitExpiry: d.permitExpiry,
  };
}

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.view");
  if (denied) return denied;
  return safeOk(
    "vehicles.list",
    () =>
      prisma.vehicle.findMany({
        orderBy: { createdAt: "desc" },
        include: { vendor: { select: { name: true } }, compliance: true, telematics: true },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "vehicle.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(vehicleSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const registrationNumber = (d.registrationNumber ?? d.number)?.replace(/\s+/g, "").toUpperCase();
    const vehicleTypeCode = d.vehicleTypeCode ?? d.type ?? "TRUCK_17FT";
    if (!registrationNumber) return badRequest("Vehicle number is required");

    const vehicle = await prisma.vehicle.create({
      data: {
        vendorId: d.vendorId ?? null,
        registrationNumber,
        vehicleTypeCode,
        bodyTypeCode: d.bodyType,
        capacityTons: d.capacityTons ?? (d.capacity ? Number(d.capacity) : undefined),
        make: d.make,
        model: d.model,
        year: d.year,
        ownership: d.ownership,
        remarks: d.remarks,
        compliance: { create: { ...complianceData(d), verificationStatus: "SUBMITTED" } },
        ...(d.gpsEnabled != null || d.gpsDeviceId || d.fastagId
          ? { telematics: { create: { gpsEnabled: d.gpsEnabled ?? false, gpsDeviceId: d.gpsDeviceId, fastagId: d.fastagId } } }
          : {}),
      },
      include: { compliance: true, telematics: true },
    });
    await logAudit({ user: auth!.user, action: "vehicle.create", entity: "Vehicle", entityId: vehicle.id, meta: { registrationNumber: vehicle.registrationNumber } });
    return created(vehicle);
  } catch {
    return badRequest("Vehicle number may already exist");
  }
}
