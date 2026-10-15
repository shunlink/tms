import "server-only";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { countsAsVerified } from "../core/verification-status";
import { withIntegrationProvider } from "../core/resolver";
import { parseValidityDate } from "./compliance";
import { mockVerifyVehicleRc } from "./providers/mock";
import { surepassVerifyVehicleRc } from "./providers/surepass";
import type { NormalizedVehicleRc, VehicleRcVerifyResult } from "./types";

export async function verifyVehicleRC(registrationNumber: string): Promise<VehicleRcVerifyResult> {
  return withIntegrationProvider(
    () => mockVerifyVehicleRc(registrationNumber),
    () => surepassVerifyVehicleRc(registrationNumber)
  );
}

export async function applyRcVerificationToVehicle(
  vehicleId: string,
  data: NormalizedVehicleRc,
  actor?: SessionUser | null
) {
  const complianceData = {
    rcNumber: data.registrationNumber,
    rcExpiry: parseValidityDate(data.rcExpiry),
    ownerName: data.ownerName,
    insuranceCompany: data.insuranceCompany,
    insuranceNumber: data.insuranceNumber,
    insuranceExpiry: parseValidityDate(data.insuranceExpiry),
    fitnessExpiry: parseValidityDate(data.fitnessExpiry),
    pucNumber: data.pucNumber,
    pucExpiry: parseValidityDate(data.pucExpiry),
    permitType: data.permitType,
    permitNumber: data.permitNumber,
    permitExpiry: parseValidityDate(data.permitExpiry),
    rcVerified: countsAsVerified(data.verificationStatus),
    rcVerificationStatus: data.verificationStatus,
    rcVerifiedAt: new Date(data.verifiedAt),
    rcVerificationProvider: data.provider,
    rcVerificationSnapshot: data as object,
    complianceState: data.compliance.overall,
    fuelType: data.fuelType,
    vehicleClass: data.vehicleClass,
  };

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      registrationNumber: data.registrationNumber,
      make: data.make ?? undefined,
      model: data.model ?? undefined,
      compliance: {
        upsert: {
          create: complianceData,
          update: complianceData,
        },
      },
    },
  });

  await logAudit({
    user: actor,
    action: "integration.vehicle.rc_verified",
    entity: "Vehicle",
    entityId: vehicleId,
    meta: {
      registrationNumber: data.registrationNumber,
      provider: data.provider,
      compliance: data.compliance.overall,
    },
  });
}
