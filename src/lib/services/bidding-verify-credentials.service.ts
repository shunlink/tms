import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import type { VerifyCredentialsPayload } from "../integration/bidding/schemas";

export type VerifyCredentialsSuccess = {
  success: true;
  user: {
    tmsUserId: string;
    email: string;
    name: string;
    passwordHash: string;
  };
  company: {
    tmsCompanyId: string;
    legalName: string;
    kind: "CLIENT" | "VENDOR";
  };
};

export async function verifyCredentialsForBidding(
  input: VerifyCredentialsPayload
): Promise<VerifyCredentialsSuccess | null> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      role: true,
      isActive: true,
      clientId: true,
      vendorId: true,
    },
  });

  if (!user || !user.isActive || !user.email) return null;

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) return null;

  if (user.role === "CLIENT" && user.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: user.clientId, isActive: true, deletedAt: null },
      select: { id: true, name: true, legalName: true },
    });
    if (!client) return null;
    return {
      success: true,
      user: {
        tmsUserId: user.id,
        email: user.email,
        name: user.name ?? client.name,
        passwordHash: user.password,
      },
      company: {
        tmsCompanyId: client.id,
        legalName: client.legalName?.trim() || client.name,
        kind: "CLIENT",
      },
    };
  }

  if (user.role === "VENDOR" && user.vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: user.vendorId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!vendor) return null;
    return {
      success: true,
      user: {
        tmsUserId: user.id,
        email: user.email,
        name: user.name ?? vendor.name,
        passwordHash: user.password,
      },
      company: {
        tmsCompanyId: vendor.id,
        legalName: vendor.name,
        kind: "VENDOR",
      },
    };
  }

  return null;
}
