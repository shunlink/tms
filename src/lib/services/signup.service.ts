import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

export type SignupRole = "CLIENT" | "VENDOR";

export type SignupInput = {
  name: string;
  email?: string | null;
  password: string;
  phone: string;
  role: SignupRole;
  companyName?: string | null;
};

export async function registerPortalUser(input: SignupInput) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone.trim();

  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new Error("An account with this email already exists");
  }

  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) throw new Error("An account with this phone number already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.$transaction(async (tx) => {
    let entityId: string;

    if (input.role === "CLIENT") {
      const client = await tx.client.create({
        data: {
          name: input.companyName?.trim() || input.name.trim(),
          contactName: input.name.trim(),
          phone,
          email,
        },
      });
      entityId = client.id;
    } else {
      const vendor = await tx.vendor.create({
        data: {
          name: input.companyName?.trim() || input.name.trim(),
          contactName: input.name.trim(),
          phone,
          email,
        },
      });
      entityId = vendor.id;
    }

    const user = await tx.user.create({
      data: {
        email,
        phone,
        name: input.name.trim(),
        password: passwordHash,
        role: input.role,
        clientId: input.role === "CLIENT" ? entityId : null,
        vendorId: input.role === "VENDOR" ? entityId : null,
      },
    });

    await tx.onboardingCase.create({
      data: {
        entityType: input.role,
        entityId,
        status: "PENDING",
      },
    });

    return {
      userId: user.id,
      email: user.email,
      role: user.role as SignupRole,
      clientId: user.clientId,
      vendorId: user.vendorId,
    };
  });
}
