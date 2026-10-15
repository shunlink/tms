import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { z } from "zod";
import type { clientSchema, vendorSchema } from "../validation";

type ClientInput = z.infer<typeof clientSchema>;
type VendorInput = z.infer<typeof vendorSchema>;

function hasAddressInput(fields: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  freeform?: string | null;
}) {
  return !!(fields.line1 || fields.city || fields.state || fields.pincode || fields.freeform);
}

async function upsertLinkedAddress(
  tx: Prisma.TransactionClient,
  existingLink: { id: string; addressId: string } | null,
  type: string,
  fields: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    freeform?: string | null;
  },
  createLink: (addressId: string) => Promise<unknown>
) {
  if (!hasAddressInput(fields)) return;

  const addressData = {
    line1: fields.line1 || fields.freeform || fields.city || "—",
    line2: fields.line2 ?? null,
    city: fields.city || "—",
    state: fields.state || "—",
    pincode: fields.pincode || "—",
    country: fields.country || "India",
  };

  if (existingLink) {
    await tx.address.update({ where: { id: existingLink.addressId }, data: addressData });
    return;
  }

  const address = await tx.address.create({ data: addressData });
  await createLink(address.id);
}

async function upsertBankAccount(
  tx: Prisma.TransactionClient,
  bankAccountId: string | null | undefined,
  fields: {
    bankName?: string | null;
    bankAccount?: string | null;
    bankIfsc?: string | null;
    bankBranch?: string | null;
    accountHolder?: string | null;
    upiId?: string | null;
  }
) {
  const hasBank = !!(
    fields.bankName ||
    fields.bankAccount ||
    fields.bankIfsc ||
    fields.accountHolder
  );
  if (!hasBank) return null;

  const data = {
    bankName: fields.bankName ?? null,
    accountNumber: fields.bankAccount ?? null,
    ifsc: fields.bankIfsc ?? null,
    branch: fields.bankBranch ?? null,
    accountHolder: fields.accountHolder ?? null,
    upiId: fields.upiId ?? null,
  };

  if (bankAccountId) {
    await tx.bankAccount.update({ where: { id: bankAccountId }, data });
    return bankAccountId;
  }

  return (await tx.bankAccount.create({ data })).id;
}

export async function updateClientProfile(clientId: string, input: Partial<ClientInput>) {
  const existing = await prisma.client.findFirst({
    where: { id: clientId },
    include: {
      commercial: { include: { bankAccount: true } },
      addresses: { include: { address: true } },
    },
  });
  if (!existing) return null;

  const billingLink = existing.addresses.find((a) => a.type === "BILLING") ?? null;
  const shippingLink = existing.addresses.find((a) => a.type === "SHIPPING") ?? null;

  const hasCommercial =
    input.creditLimit != null || input.paymentTerms != null || input.securityDeposit != null;

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id: clientId },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.altPhone !== undefined ? { altPhone: input.altPhone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.accountsEmail !== undefined ? { accountsEmail: input.accountsEmail } : {}),
        ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
        ...(input.pan !== undefined ? { pan: input.pan } : {}),
        ...(input.cin !== undefined ? { cin: input.cin } : {}),
        ...(input.msme !== undefined ? { msme: input.msme } : {}),
        ...(input.industry !== undefined ? { industry: input.industry } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    await upsertLinkedAddress(
      tx,
      billingLink,
      "BILLING",
      {
        line1: input.addressLine1,
        line2: input.addressLine2,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country,
        freeform: input.billingAddress,
      },
      (addressId) =>
        tx.clientAddress.create({
          data: { clientId, addressId, type: "BILLING", isPrimary: true },
        })
    );

    await upsertLinkedAddress(
      tx,
      shippingLink,
      "SHIPPING",
      {
        line1: input.shippingAddress,
        city: input.shippingCity,
        state: input.shippingState,
        pincode: input.shippingPincode,
        country: input.country,
      },
      (addressId) =>
        tx.clientAddress.create({
          data: { clientId, addressId, type: "SHIPPING", isPrimary: false },
        })
    );

    const bankAccountId = await upsertBankAccount(tx, existing.commercial?.bankAccountId, {
      bankName: input.bankName,
      bankAccount: input.bankAccount,
      bankIfsc: input.bankIfsc,
      bankBranch: input.bankBranch,
      accountHolder: input.accountHolder,
    });

    if (hasCommercial || bankAccountId) {
      await tx.clientCommercial.upsert({
        where: { clientId },
        create: {
          clientId,
          creditLimit: input.creditLimit ?? null,
          paymentTermsDays: input.paymentTerms ?? null,
          securityDeposit: input.securityDeposit ?? null,
          bankAccountId: bankAccountId ?? null,
        },
        update: {
          ...(hasCommercial
            ? {
                creditLimit: input.creditLimit ?? null,
                paymentTermsDays: input.paymentTerms ?? null,
                securityDeposit: input.securityDeposit ?? null,
              }
            : {}),
          ...(bankAccountId ? { bankAccountId } : {}),
        },
      });
    }

    return client;
  });
}

export async function updateVendorProfile(vendorId: string, input: Partial<VendorInput>) {
  const existing = await prisma.vendor.findFirst({
    where: { id: vendorId },
    include: {
      commercial: { include: { bankAccount: true } },
      addresses: { include: { address: true } },
    },
  });
  if (!existing) return null;

  const registeredLink =
    existing.addresses.find((a) => a.type === "REGISTERED") ??
    existing.addresses.find((a) => a.type === "BILLING") ??
    null;

  const hasCommercial = input.paymentTerms != null || input.tdsApplicable != null;

  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.update({
      where: { id: vendorId },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.type != null ? { type: input.type } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.altPhone !== undefined ? { altPhone: input.altPhone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
        ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
        ...(input.pan !== undefined ? { pan: input.pan } : {}),
        ...(input.msme !== undefined ? { msme: input.msme } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    await upsertLinkedAddress(
      tx,
      registeredLink,
      "REGISTERED",
      {
        line1: input.addressLine1,
        line2: input.addressLine2,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
      },
      (addressId) =>
        tx.vendorAddress.create({
          data: { vendorId, addressId, type: "REGISTERED", isPrimary: true },
        })
    );

    const bankAccountId = await upsertBankAccount(tx, existing.commercial?.bankAccountId, {
      bankName: input.bankName,
      bankAccount: input.bankAccount,
      bankIfsc: input.bankIfsc,
      bankBranch: input.bankBranch,
      accountHolder: input.accountHolder,
      upiId: input.upiId,
    });

    if (hasCommercial || bankAccountId) {
      await tx.vendorCommercial.upsert({
        where: { vendorId },
        create: {
          vendorId,
          paymentTermsDays: input.paymentTerms ?? null,
          tdsApplicable: input.tdsApplicable ?? false,
          bankAccountId: bankAccountId ?? null,
        },
        update: {
          ...(hasCommercial
            ? {
                paymentTermsDays: input.paymentTerms ?? null,
                tdsApplicable: input.tdsApplicable ?? false,
              }
            : {}),
          ...(bankAccountId ? { bankAccountId } : {}),
        },
      });
    }

    return vendor;
  });
}
