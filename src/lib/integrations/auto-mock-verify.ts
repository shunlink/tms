import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { integrationMode } from "./core/config";
import { applyDlVerificationToDriver, verifyDrivingLicence } from "./dl/service";
import { applyRcVerificationToVehicle, verifyVehicleRC } from "./vehicle/service";

/** Placeholder DOB for mock DL verification when driver has no date of birth on file. */
const MOCK_DL_DOB_FALLBACK = "1990-01-01";

function shouldAutoMockVerify(): boolean {
  return integrationMode() === "mock";
}

/** In mock integration mode, auto-verify vehicle RC when assigned to an indent. */
export async function autoMockVerifyVehicleOnAssign(
  vehicleId: string,
  registrationNumber: string,
  actor?: SessionUser | null
): Promise<void> {
  if (!shouldAutoMockVerify()) return;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { compliance: true },
  });
  if (!vehicle || vehicle.compliance?.rcVerified) return;

  const result = await verifyVehicleRC(registrationNumber);
  await applyRcVerificationToVehicle(vehicleId, result.data, actor);
}

/** In mock integration mode, auto-verify driver DL when assigned to an indent. */
export async function autoMockVerifyDriverOnAssign(
  driverId: string,
  actor?: SessionUser | null
): Promise<void> {
  if (!shouldAutoMockVerify()) return;

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver || driver.dlVerified) return;

  const dateOfBirth =
    driver.dateOfBirth?.toISOString().slice(0, 10) ?? MOCK_DL_DOB_FALLBACK;
  const result = await verifyDrivingLicence(driver.dlNumber, dateOfBirth);
  await applyDlVerificationToDriver(driverId, result.data, actor);
}
