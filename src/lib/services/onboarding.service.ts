import { prisma } from "../prisma";
import { notifyBiddingOnboardingDecision } from "../integration/bidding/onboarding-decision";

export type OnboardingEntityType = "CLIENT" | "VENDOR" | "DRIVER" | "VEHICLE";

export async function getOnboardingCase(entityType: OnboardingEntityType, entityId: string) {
  return prisma.onboardingCase.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
}

export async function getOnboardingStatus(entityType: OnboardingEntityType, entityId: string) {
  const case_ = await getOnboardingCase(entityType, entityId);
  return case_?.status ?? "PENDING";
}

export async function submitOnboarding(
  entityType: OnboardingEntityType,
  entityId: string,
  remarks?: string | null
) {
  return prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType,
      entityId,
      status: "SUBMITTED",
      remarks: remarks ?? null,
      submittedAt: new Date(),
    },
    update: {
      status: "SUBMITTED",
      remarks: remarks ?? null,
      submittedAt: new Date(),
    },
  });
}

export async function reviewOnboarding(
  entityType: OnboardingEntityType,
  entityId: string,
  status: "APPROVED" | "REJECTED",
  reviewedById: string,
  remarks?: string | null
) {
  const case_ = await prisma.onboardingCase.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType,
      entityId,
      status,
      remarks: remarks ?? null,
      reviewedAt: new Date(),
      reviewedById,
    },
    update: {
      status,
      remarks: remarks ?? null,
      reviewedAt: new Date(),
      reviewedById,
    },
  });

  if (entityType === "CLIENT" || entityType === "VENDOR") {
    const biddingApplicationId = await resolveBiddingApplicationId(entityType, entityId);
    if (biddingApplicationId) {
      try {
        await notifyBiddingOnboardingDecision({
          biddingApplicationId,
          status,
          remarks: remarks ?? null,
        });
      } catch (e) {
        console.error("[onboarding] Bidding onboarding-decision notify failed:", e);
      }
    }
  }

  return case_;
}

async function resolveBiddingApplicationId(
  entityType: "CLIENT" | "VENDOR",
  entityId: string
): Promise<string | null> {
  if (entityType === "CLIENT") {
    const client = await prisma.client.findFirst({
      where: { id: entityId },
      select: { biddingApplicationId: true },
    });
    return client?.biddingApplicationId?.trim() || null;
  }
  const vendor = await prisma.vendor.findFirst({
    where: { id: entityId },
    select: { biddingApplicationId: true },
  });
  return vendor?.biddingApplicationId?.trim() || null;
}

export async function listOnboardingQueue() {
  const cases = await prisma.onboardingCase.findMany({
    where: {
      status: { in: ["SUBMITTED", "PENDING"] },
      // Drivers are added by employees only — no admin approval required.
      entityType: { not: "DRIVER" },
    },
    orderBy: { submittedAt: "desc" },
  });

  const results = [];
  for (const c of cases) {
    let name = c.entityId;
    if (c.entityType === "CLIENT") {
      const client = await prisma.client.findFirst({ where: { id: c.entityId } });
      name = client?.name ?? name;
    } else if (c.entityType === "VENDOR") {
      const vendor = await prisma.vendor.findFirst({ where: { id: c.entityId } });
      name = vendor?.name ?? name;
    } else if (c.entityType === "DRIVER") {
      const driver = await prisma.driver.findFirst({ where: { id: c.entityId } });
      name = driver?.name ?? name;
    } else if (c.entityType === "VEHICLE") {
      const vehicle = await prisma.vehicle.findFirst({ where: { id: c.entityId } });
      name = vehicle?.registrationNumber ?? name;
    }
    results.push({
      id: c.entityId,
      type: c.entityType.toLowerCase(),
      name,
      status: c.status,
      remarks: c.remarks,
      submittedAt: c.submittedAt,
    });
  }
  return results;
}
