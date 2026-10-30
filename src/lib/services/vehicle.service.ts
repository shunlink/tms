import { prisma } from "../prisma";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import { normalizeVehicleReg } from "../field-validators";
import { assertVehicleDriverAssignableForLine } from "../indent-placement";
import { assertVehicleAvailableForIndentLine } from "../resource-assignment-eligibility";
import { resolveTargetLine, syncIndentHeaderFromLines } from "../indent-line-rollup";

export type VehicleAssignmentInput = {
  registrationNumber: string;
  vehicleTypeCode?: string | null;
  bodyTypeCode?: string | null;
  capacityTons?: number | null;
  capacityCbm?: number | null;
  remarks?: string | null;
  indentLineId?: string | null;
};

export type VehicleComplianceLookup = {
  ownerName: string | null;
  ownerPan: string | null;
  rcNumber: string | null;
  rcExpiry: string | null;
  insuranceNumber: string | null;
  insuranceCompany: string | null;
  insuranceExpiry: string | null;
  fitnessExpiry: string | null;
  pucNumber: string | null;
  pucExpiry: string | null;
  permitType: string | null;
  permitNumber: string | null;
  permitExpiry: string | null;
  rcVerified: boolean;
  rcVerificationStatus: string | null;
  rcVerifiedAt: string | null;
  rcVerificationProvider: string | null;
  complianceState: string | null;
  fuelType: string | null;
  vehicleClass: string | null;
};

export type VehicleLookupResult = {
  id: string;
  registrationNumber: string;
  vehicleTypeCode: string;
  bodyTypeCode: string | null;
  capacityTons: number | null;
  capacityCbm: number | null;
  make: string | null;
  model: string | null;
  year: number | null;
  ownership: string | null;
  remarks: string | null;
  compliance: VehicleComplianceLookup | null;
};

function toIsoDate(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function toNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapComplianceLookup(compliance: {
  ownerName: string | null;
  ownerPan: string | null;
  rcNumber: string | null;
  rcExpiry: Date | null;
  insuranceNumber: string | null;
  insuranceCompany: string | null;
  insuranceExpiry: Date | null;
  fitnessExpiry: Date | null;
  pucNumber: string | null;
  pucExpiry: Date | null;
  permitType: string | null;
  permitNumber: string | null;
  permitExpiry: Date | null;
  rcVerified: boolean;
  rcVerificationStatus: string | null;
  rcVerifiedAt: Date | null;
  rcVerificationProvider: string | null;
  complianceState: string | null;
  fuelType: string | null;
  vehicleClass: string | null;
}): VehicleComplianceLookup {
  return {
    ownerName: compliance.ownerName,
    ownerPan: compliance.ownerPan,
    rcNumber: compliance.rcNumber,
    rcExpiry: toIsoDate(compliance.rcExpiry),
    insuranceNumber: compliance.insuranceNumber,
    insuranceCompany: compliance.insuranceCompany,
    insuranceExpiry: toIsoDate(compliance.insuranceExpiry),
    fitnessExpiry: toIsoDate(compliance.fitnessExpiry),
    pucNumber: compliance.pucNumber,
    pucExpiry: toIsoDate(compliance.pucExpiry),
    permitType: compliance.permitType,
    permitNumber: compliance.permitNumber,
    permitExpiry: toIsoDate(compliance.permitExpiry),
    rcVerified: compliance.rcVerified,
    rcVerificationStatus: compliance.rcVerificationStatus,
    rcVerifiedAt: toIsoDate(compliance.rcVerifiedAt),
    rcVerificationProvider: compliance.rcVerificationProvider,
    complianceState: compliance.complianceState,
    fuelType: compliance.fuelType,
    vehicleClass: compliance.vehicleClass,
  };
}

/** Look up a vehicle in Vehicle Master by registration number. */
export async function lookupVehicleByRegistration(
  registrationNumber: string
): Promise<VehicleLookupResult | null> {
  const normalized = normalizeVehicleReg(registrationNumber);
  const vehicle = await prisma.vehicle.findUnique({
    where: { registrationNumber: normalized },
    include: { compliance: true },
  });
  if (!vehicle) return null;

  return {
    id: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    vehicleTypeCode: vehicle.vehicleTypeCode,
    bodyTypeCode: vehicle.bodyTypeCode,
    capacityTons: toNumber(vehicle.capacityTons),
    capacityCbm: toNumber(vehicle.capacityCbm),
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    ownership: vehicle.ownership,
    remarks: vehicle.remarks,
    compliance: vehicle.compliance ? mapComplianceLookup(vehicle.compliance) : null,
  };
}

/** Employee enters/creates the vehicle in the same indent (not the vendor). */
export async function assignVehicleToIndent(
  indentId: string,
  input: VehicleAssignmentInput,
  actor?: SessionUser | null
) {
  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: { consignment: { select: { vehicleTypeCode: true } } },
  });
  if (!indent) return null;

  const line = await resolveTargetLine(indentId, input.indentLineId);
  assertVehicleDriverAssignableForLine(indent, line);

  const registrationNumber = normalizeVehicleReg(input.registrationNumber);

  let vehicle = await prisma.vehicle.findUnique({ where: { registrationNumber } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber,
        vehicleTypeCode: input.vehicleTypeCode ?? indent.consignment?.vehicleTypeCode ?? "TRUCK_17FT",
        bodyTypeCode: input.bodyTypeCode ?? null,
        capacityTons: input.capacityTons ?? null,
        capacityCbm: input.capacityCbm ?? null,
        remarks: input.remarks ?? null,
      },
    });
  }

  await assertVehicleAvailableForIndentLine(vehicle.id, line.id, line.tripId);

  await prisma.$transaction(async (tx) => {
    const alloc = await tx.indentAllocation.findFirst({
      where: { indentLineId: line.id, status: "ACTIVE" },
      orderBy: { allocatedAt: "desc" },
    });
    if (alloc) {
      await tx.indentAllocation.update({
        where: { id: alloc.id },
        data: { vehicleId: vehicle.id },
      });
    }
    await syncIndentHeaderFromLines(indentId, tx);
  });

  await logAudit({
    user: actor,
    action: "indent.vehicle_assigned",
    entity: "INDENT",
    entityId: indentId,
    meta: { vehicleId: vehicle.id, registrationNumber, indentLineId: line.id, lineNumber: line.lineNumber },
  });

  const { autoMockVerifyVehicleOnAssign } = await import("../integrations/auto-mock-verify");
  await autoMockVerifyVehicleOnAssign(vehicle.id, registrationNumber, actor);

  return (await import("./indent.service")).getIndentById(indentId);
}
