import "server-only";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { countsAsVerified } from "../core/verification-status";
import { withIntegrationProvider } from "../core/resolver";
import { mockVerifyDrivingLicence } from "./providers/mock";
import { surepassVerifyDrivingLicence } from "./providers/surepass";
import type { DlVerifyResult, NormalizedDrivingLicence } from "./types";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function verifyDrivingLicence(
  dlNumber: string,
  dateOfBirth?: string | null
): Promise<DlVerifyResult> {
  return withIntegrationProvider(
    () => mockVerifyDrivingLicence(dlNumber, dateOfBirth),
    () => surepassVerifyDrivingLicence(dlNumber, dateOfBirth)
  );
}

export async function applyDlVerificationToDriver(
  driverId: string,
  data: NormalizedDrivingLicence,
  actor?: SessionUser | null
) {
  await prisma.driver.update({
    where: { id: driverId },
    data: {
      dlNumber: data.dlNumber,
      name: data.name ?? undefined,
      dlExpiry: parseDate(data.expiryDate ?? data.validity),
      dateOfBirth: parseDate(data.dateOfBirth),
      dlIssueDate: parseDate(data.issueDate),
      dlStatus: data.status,
      dlVehicleClasses: data.vehicleClasses.join(", ") || null,
      dlVerified: countsAsVerified(data.verificationStatus),
      dlVerificationStatus: data.verificationStatus,
      dlVerifiedAt: new Date(data.verifiedAt),
      dlVerificationProvider: data.provider,
      dlVerificationSnapshot: data as object,
      kycStatus: countsAsVerified(data.verificationStatus) ? "VERIFIED" : "IN_PROGRESS",
      state: data.state ?? undefined,
      address: data.address ?? undefined,
    },
  });

  await logAudit({
    user: actor,
    action: "integration.dl.verified",
    entity: "Driver",
    entityId: driverId,
    meta: {
      dlNumber: data.dlNumber,
      provider: data.provider,
      status: data.verificationStatus,
    },
  });
}
