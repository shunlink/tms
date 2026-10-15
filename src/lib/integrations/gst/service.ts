import "server-only";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { withIntegrationProvider } from "../core/resolver";
import { mockVerifyGstin } from "./providers/mock";
import { surepassVerifyGstin } from "./providers/surepass";
import type { GstVerifyResult, NormalizedGstData } from "./types";

export async function verifyGSTIN(gstin: string): Promise<GstVerifyResult> {
  return withIntegrationProvider(
    () => mockVerifyGstin(gstin),
    () => surepassVerifyGstin(gstin)
  );
}

export async function persistGstVerification(
  entityType: "CLIENT" | "VENDOR",
  entityId: string,
  data: NormalizedGstData,
  actor?: SessionUser | null
) {
  const patch = {
    gstin: data.gstin,
    legalName: data.legalName ?? undefined,
    name: data.tradeName ?? data.legalName ?? undefined,
    gstVerificationStatus: data.verificationStatus,
    gstVerifiedAt: new Date(data.verifiedAt),
    gstVerificationProvider: data.provider,
    gstVerificationData: data as object,
  };

  if (entityType === "CLIENT") {
    await prisma.client.update({ where: { id: entityId }, data: patch });
  } else {
    await prisma.vendor.update({
      where: { id: entityId },
      data: {
        gstin: patch.gstin,
        gstVerificationStatus: patch.gstVerificationStatus,
        gstVerifiedAt: patch.gstVerifiedAt,
        gstVerificationProvider: patch.gstVerificationProvider,
        gstVerificationData: patch.gstVerificationData,
        name: patch.name,
      },
    });
  }

  await logAudit({
    user: actor,
    action: "integration.gst.verified",
    entity: entityType,
    entityId,
    meta: {
      gstin: data.gstin,
      provider: data.provider,
      status: data.verificationStatus,
    },
  });
}
