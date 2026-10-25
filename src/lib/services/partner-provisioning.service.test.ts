import { describe, it, expect, vi, beforeEach } from "vitest";
import { ONBOARDING_CASE_STATUS } from "../onboarding-case-status";
import {
  onboardingStatusForPartnerCreate,
  provisionClientPartner,
  provisionVendorPartner,
} from "./partner-provisioning.service";

vi.mock("../prisma", () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    vendor: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    onboardingCase: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./profile.service", () => ({
  createClientProfile: vi.fn(async (input: { name: string }) => ({
    id: "client-1",
    name: input.name,
  })),
  createVendorProfile: vi.fn(async (input: { name: string }) => ({
    id: "vendor-1",
    name: input.name,
  })),
}));

import { prisma } from "../prisma";

describe("onboardingStatusForPartnerCreate", () => {
  it("returns APPROVED for SUPER_ADMIN", () => {
    expect(onboardingStatusForPartnerCreate("SUPER_ADMIN")).toBe(ONBOARDING_CASE_STATUS.APPROVED);
  });

  it("returns PENDING_APPROVAL for other internal roles", () => {
    expect(onboardingStatusForPartnerCreate("ADMIN")).toBe(ONBOARDING_CASE_STATUS.PENDING_APPROVAL);
    expect(onboardingStatusForPartnerCreate("SALES")).toBe(ONBOARDING_CASE_STATUS.PENDING_APPROVAL);
  });
});

describe("provisionClientPartner", () => {
  beforeEach(() => {
    vi.mocked(prisma.onboardingCase.upsert).mockReset();
  });

  it("upserts onboarding case as APPROVED when actor is super admin", async () => {
    vi.mocked(prisma.onboardingCase.upsert).mockResolvedValue({
      id: "case-1",
      status: ONBOARDING_CASE_STATUS.APPROVED,
      entityType: "CLIENT",
      entityId: "client-1",
    } as never);

    const result = await provisionClientPartner(
      { id: "u1", role: "SUPER_ADMIN", email: "a@tms.local", name: "Admin" },
      { name: "Acme Corp" } as never
    );

    expect(result.clientId).toBe("client-1");
    expect(result.onboardingStatus).toBe(ONBOARDING_CASE_STATUS.APPROVED);
    expect(prisma.onboardingCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: ONBOARDING_CASE_STATUS.APPROVED }),
      })
    );
  });

  it("upserts onboarding case as PENDING_APPROVAL for non–super-admin", async () => {
    vi.mocked(prisma.onboardingCase.upsert).mockResolvedValue({
      id: "case-2",
      status: ONBOARDING_CASE_STATUS.PENDING_APPROVAL,
      entityType: "CLIENT",
      entityId: "client-1",
    } as never);

    const result = await provisionClientPartner(
      { id: "u2", role: "SALES", email: "s@tms.local", name: "Sales" },
      { name: "Beta Ltd" } as never
    );

    expect(result.onboardingStatus).toBe(ONBOARDING_CASE_STATUS.PENDING_APPROVAL);
    expect(prisma.onboardingCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: ONBOARDING_CASE_STATUS.PENDING_APPROVAL }),
      })
    );
  });
});

describe("provisionVendorPartner", () => {
  beforeEach(() => {
    vi.mocked(prisma.onboardingCase.upsert).mockReset();
  });

  it("sets vendor onboarding to PENDING_APPROVAL for operations staff", async () => {
    vi.mocked(prisma.onboardingCase.upsert).mockResolvedValue({
      id: "case-v",
      status: ONBOARDING_CASE_STATUS.PENDING_APPROVAL,
      entityType: "VENDOR",
      entityId: "vendor-1",
    } as never);

    const result = await provisionVendorPartner(
      { id: "u3", role: "OPERATIONS", email: "o@tms.local", name: "Ops" },
      { name: "Fleet Co", type: "FLEET_OWNER" } as never
    );

    expect(result.vendorId).toBe("vendor-1");
    expect(prisma.onboardingCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType_entityId: { entityType: "VENDOR", entityId: "vendor-1" } },
      })
    );
  });
});
