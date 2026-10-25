import { prisma } from "./prisma";

const VENDOR_ENTITY = "VENDOR";

/** Legacy vendors (no case) or admin-approved onboarding may participate in release/allocation. */
export function isVendorEligibleForIndentOps(onboardingStatus: string | undefined | null): boolean {
  if (!onboardingStatus) return true;
  return onboardingStatus === "APPROVED";
}

export async function getVendorOnboardingStatusMap(
  vendorIds: string[]
): Promise<Map<string, string>> {
  if (vendorIds.length === 0) return new Map();
  const cases = await prisma.onboardingCase.findMany({
    where: { entityType: VENDOR_ENTITY, entityId: { in: vendorIds } },
    select: { entityId: true, status: true },
  });
  return new Map(cases.map((c) => [c.entityId, c.status]));
}

export async function filterEligibleVendorIds(vendorIds: string[]): Promise<Set<string>> {
  const statusMap = await getVendorOnboardingStatusMap(vendorIds);
  const eligible = new Set<string>();
  for (const id of vendorIds) {
    const status = statusMap.get(id);
    if (isVendorEligibleForIndentOps(status)) {
      eligible.add(id);
    }
  }
  return eligible;
}

export async function assertVendorEligibleForIndentOps(vendorId: string): Promise<void> {
  const case_ = await prisma.onboardingCase.findUnique({
    where: { entityType_entityId: { entityType: VENDOR_ENTITY, entityId: vendorId } },
    select: { status: true },
  });
  const status = case_?.status ?? null;
  if (!isVendorEligibleForIndentOps(status)) {
    throw new Error(
      "This vendor is not approved for allocation. Only onboarded and admin-approved vendors can be used."
    );
  }
}
