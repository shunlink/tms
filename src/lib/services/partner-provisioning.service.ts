import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "../prisma";
import { ONBOARDING_CASE_STATUS } from "../onboarding-case-status";
import type { z } from "zod";
import type { clientSchema, vendorSchema } from "../validation";
import {
  createClientProfile,
  createVendorProfile,
} from "./profile.service";
import { normalizePhone, normalizePhoneOrOriginal } from "../phone";
import type { SessionUser } from "../auth";

type ClientInput = z.infer<typeof clientSchema>;
type VendorInput = z.infer<typeof vendorSchema>;

/** Authenticated staff user creating a partner (matches API `auth.user`). */
export type PartnerActor = SessionUser & { id: string };

export type PortalCredentialsInput = {
  email: string;
  password: string;
  phone?: string | null;
};

export function onboardingStatusForPartnerCreate(actorRole?: string | null) {
  return actorRole === "SUPER_ADMIN"
    ? ONBOARDING_CASE_STATUS.APPROVED
    : ONBOARDING_CASE_STATUS.PENDING_APPROVAL;
}

async function assertPortalCredentialsAvailable(email: string, phone: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) throw new Error("An account with this email already exists");

  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) throw new Error("An account with this phone number already exists");
  }
}

function normalizePortalPhone(phone?: string | null) {
  if (!phone?.trim()) return null;
  return normalizePhone(phone) ?? normalizePhoneOrOriginal(phone) ?? phone.trim();
}

export async function createPortalUserForPartner(params: {
  role: "CLIENT" | "VENDOR";
  entityId: string;
  credentials: PortalCredentialsInput;
  displayName?: string | null;
}) {
  const email = params.credentials.email.trim().toLowerCase();
  const phone = normalizePortalPhone(params.credentials.phone);
  await assertPortalCredentialsAvailable(email, phone);

  const passwordHash = await bcrypt.hash(params.credentials.password, 10);
  const displayName =
    params.displayName?.trim() ||
    email.split("@")[0] ||
    (params.role === "CLIENT" ? "Client" : "Vendor");

  const existingForEntity = await prisma.user.findFirst({
    where: params.role === "CLIENT" ? { clientId: params.entityId } : { vendorId: params.entityId },
  });
  if (existingForEntity) {
    throw new Error("A portal user already exists for this partner");
  }

  return prisma.user.create({
    data: {
      email,
      phone,
      name: displayName,
      password: passwordHash,
      role: params.role,
      clientId: params.role === "CLIENT" ? params.entityId : null,
      vendorId: params.role === "VENDOR" ? params.entityId : null,
    },
  });
}

async function upsertPartnerOnboardingCase(
  entityType: "CLIENT" | "VENDOR",
  entityId: string,
  actor: PartnerActor
) {
  const status = onboardingStatusForPartnerCreate(actor.role);
  const now = new Date();
  const approved = status === ONBOARDING_CASE_STATUS.APPROVED;

  return prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType,
      entityId,
      status,
      ...(approved ? { reviewedAt: now, reviewedById: actor.id } : {}),
    },
    update: {
      status,
      ...(approved
        ? { reviewedAt: now, reviewedById: actor.id }
        : { reviewedAt: null, reviewedById: null }),
    },
  });
}

export async function provisionClientPartner(
  actor: PartnerActor,
  profile: ClientInput,
  portal?: PortalCredentialsInput | null
) {
  const client = await createClientProfile(profile);
  const onboardingCase = await upsertPartnerOnboardingCase("CLIENT", client.id, actor);

  let portalUser: User | null = null;
  if (portal?.email && portal.password) {
    portalUser = await createPortalUserForPartner({
      role: "CLIENT",
      entityId: client.id,
      credentials: portal,
      displayName: profile.contactName ?? profile.name,
    });
  }

  return {
    clientId: client.id,
    onboardingStatus: onboardingCase.status,
    userId: portalUser?.id ?? null,
  };
}

export async function provisionVendorPartner(
  actor: PartnerActor,
  profile: VendorInput,
  portal?: PortalCredentialsInput | null
) {
  const vendor = await createVendorProfile(profile);
  const onboardingCase = await upsertPartnerOnboardingCase("VENDOR", vendor.id, actor);

  let portalUser: User | null = null;
  if (portal?.email && portal.password) {
    portalUser = await createPortalUserForPartner({
      role: "VENDOR",
      entityId: vendor.id,
      credentials: portal,
      displayName: profile.contactName ?? profile.name,
    });
  }

  return {
    vendorId: vendor.id,
    onboardingStatus: onboardingCase.status,
    userId: portalUser?.id ?? null,
  };
}

export async function attachClientPortalUser(
  clientId: string,
  credentials: PortalCredentialsInput,
  displayName?: string | null
) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");
  const user = await createPortalUserForPartner({
    role: "CLIENT",
    entityId: clientId,
    credentials,
    displayName: displayName ?? client.contactName ?? client.name,
  });
  return { userId: user.id };
}

export async function attachVendorPortalUser(
  vendorId: string,
  credentials: PortalCredentialsInput,
  displayName?: string | null
) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new Error("Vendor not found");
  const user = await createPortalUserForPartner({
    role: "VENDOR",
    entityId: vendorId,
    credentials,
    displayName: displayName ?? vendor.contactName ?? vendor.name,
  });
  return { userId: user.id };
}
