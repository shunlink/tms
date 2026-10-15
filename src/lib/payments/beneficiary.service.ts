import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { buildBeneficiaryMaskedDisplay, sanitizeBeneficiaryForClient } from "./beneficiary";
import { logAudit } from "../audit";

export async function createVendorBeneficiary(
  vendorId: string,
  input: {
    method?: string;
    accountHolder?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    upiId?: string | null;
    isDefault?: boolean;
  },
  actor?: SessionUser | null
) {
  const method = input.method ?? "BANK_TRANSFER";
  const maskedDisplay = buildBeneficiaryMaskedDisplay({
    method,
    accountNumber: input.accountNumber,
    ifsc: input.ifsc,
    upiId: input.upiId,
    accountHolder: input.accountHolder,
  });

  const row = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.vendorBeneficiary.updateMany({
        where: { vendorId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.vendorBeneficiary.create({
      data: {
        vendorId,
        method,
        accountHolder: input.accountHolder ?? null,
        bankName: input.bankName ?? null,
        accountNumber: input.accountNumber ?? null,
        ifsc: input.ifsc ?? null,
        upiId: input.upiId ?? null,
        maskedDisplay,
        isDefault: input.isDefault ?? false,
        changeHistory: [{ at: new Date().toISOString(), action: "CREATED", actorId: actor?.id }],
      },
    });
  });

  await logAudit({
    user: actor,
    action: "vendor_beneficiary.created",
    entity: "VendorBeneficiary",
    entityId: row.id,
    meta: { vendorId, maskedDisplay },
  });

  return sanitizeBeneficiaryForClient(row);
}

export async function verifyVendorBeneficiary(id: string, actor?: SessionUser | null) {
  const row = await prisma.vendorBeneficiary.update({
    where: { id },
    data: {
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      verifiedById: actor?.id ?? null,
    },
  });
  return sanitizeBeneficiaryForClient(row);
}

export async function listVendorBeneficiaries(vendorId: string) {
  const rows = await prisma.vendorBeneficiary.findMany({
    where: { vendorId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(sanitizeBeneficiaryForClient);
}
