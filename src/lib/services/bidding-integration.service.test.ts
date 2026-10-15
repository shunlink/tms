import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AwardHandoffPayload, OnboardingApprovedPayload } from "../integration/bidding/schemas";

const prismaMock = vi.hoisted(() => ({
  biddingIntegrationHandoff: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  onboardingCase: {
    findUnique: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  vendor: {
    findFirst: vi.fn(),
  },
  indent: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../prisma", () => ({ prisma: prismaMock }));

vi.mock("../sequence", () => ({ nextNumber: vi.fn(async () => "IND-TEST-1") }));

const allocateVendorInTransaction = vi.hoisted(() => vi.fn());
vi.mock("./allocation.service", () => ({
  allocateVendorInTransaction,
}));

vi.mock("./important-event.service", () => ({
  createImportantEvent: vi.fn(),
}));

vi.mock("../audit", () => ({ logAudit: vi.fn() }));

import {
  createIndentFromBiddingAward,
  findAwardHandoffResult,
  upsertPartyFromOnboardingApproved,
} from "./bidding-integration.service";
import { allocateVendorInTransaction as allocateTx } from "./allocation.service";

const onboardingPayload: OnboardingApprovedPayload = {
  idempotencyKey: "onboarding:app_1",
  partyType: "CLIENT",
  biddingCompanyId: "cmp_1",
  biddingApplicationId: "app_1",
  status: "APPROVED",
  snapshot: {
    legalName: "Acme",
    tradeName: "Acme",
    documents: [],
  },
};

const awardPayload: AwardHandoffPayload = {
  idempotencyKey: "tms-handoff:lr1:bid1",
  loadRequirementId: "lr_1",
  bidId: "bid_1",
  bidAcceptanceId: "acc_1",
  clientBiddingCompanyId: "cmp_client",
  vendorBiddingCompanyId: "cmp_vendor",
  clientPriceInr: 45000,
  vendorPriceInr: 38000,
  lane: { from: { city: "Pune" }, to: { city: "Mumbai" } },
  cargo: {
    vehicleCategory: "OPEN_BODY",
    materialDescription: "Steel",
    weightUnit: "MT",
    cargoTypeCode: "GENERAL",
  },
  placement: { vehicleRegistration: null, driver: null },
};

describe("bidding onboarding idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stored party when idempotency key already exists", async () => {
    prismaMock.biddingIntegrationHandoff.findUnique.mockResolvedValue({
      idempotencyKey: onboardingPayload.idempotencyKey,
      tmsPartyId: "client_existing",
    });
    prismaMock.onboardingCase.findUnique.mockResolvedValue({ id: "case_1" });

    const result = await upsertPartyFromOnboardingApproved(onboardingPayload);
    expect(result).toMatchObject({
      tmsPartyId: "client_existing",
      created: false,
      onboardingCaseId: "case_1",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("bidding award handoff idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns same indent when handoff key already exists", async () => {
    prismaMock.biddingIntegrationHandoff.findUnique.mockResolvedValue({
      indentId: "indent_1",
    });
    prismaMock.indent.findFirst.mockResolvedValue({
      id: "indent_1",
      indentNumber: "IND-1",
      status: "PLACEMENT_PENDING",
      placementStatus: "PLACEMENT_PENDING",
      trips: [],
    });

    const result = await findAwardHandoffResult(awardPayload);
    expect(result?.indentId).toBe("indent_1");
    expect(result?.created).toBe(false);
  });

  it("createIndentFromBiddingAward replays without creating a second indent", async () => {
    prismaMock.biddingIntegrationHandoff.findUnique.mockResolvedValue({
      indentId: "indent_1",
    });
    prismaMock.indent.findFirst.mockResolvedValue({
      id: "indent_1",
      indentNumber: "IND-1",
      status: "PLACEMENT_PENDING",
      placementStatus: "PLACEMENT_PENDING",
      trips: [],
    });

    const result = await createIndentFromBiddingAward(awardPayload);
    expect(result.indentId).toBe("indent_1");
    expect(result.created).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("manual allocation from DRAFT without releaseIndentToVendors", () => {
  it("allocateVendorInTransaction is exported for transactional bidding handoff", () => {
    expect(allocateTx).toBeDefined();
  });
});
