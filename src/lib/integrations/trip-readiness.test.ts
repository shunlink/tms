import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    indent: { findFirst: findFirstMock },
  },
}));

import { checkIndentTripReadiness } from "./trip-readiness";

describe("checkIndentTripReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ready when EWB, vehicle, and driver are valid", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    findFirstMock.mockResolvedValue({
      id: "ind-1",
      vehicleId: "v1",
      consignment: { ewayBillRequired: true },
      ewayBill: {
        mode: "EXISTING",
        ewayBillNumber: "123456789011",
        status: "Active",
        supplierGstin: "27AAAAA0000A1Z5",
        recipientGstin: "29BBBBB0000B1Z6",
        goodsDescription: "Steel",
        validUntil: future,
      },
      vehicle: {
        compliance: {
          rcVerified: true,
          complianceState: "VERIFIED",
          rcExpiry: future,
          insuranceExpiry: future,
          pucExpiry: future,
          fitnessExpiry: future,
        },
      },
      driver: {
        dlVerified: true,
        otpVerified: true,
        dlStatus: "Active",
        dlVerificationStatus: "VERIFIED",
      },
    });

    const result = await checkIndentTripReadiness("ind-1");
    expect(result.ready).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("blocked when vehicle insurance expired", async () => {
    const past = new Date("2020-01-01");
    const future = new Date("2099-01-01");
    findFirstMock.mockResolvedValue({
      id: "ind-1",
      vehicleId: "v1",
      consignment: { ewayBillRequired: false },
      ewayBill: null,
      vehicle: {
        compliance: {
          rcVerified: true,
          rcExpiry: future,
          insuranceExpiry: past,
          pucExpiry: future,
          fitnessExpiry: future,
        },
      },
      driver: {
        dlVerified: true,
        otpVerified: true,
        dlStatus: "Active",
      },
    });

    const result = await checkIndentTripReadiness("ind-1");
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain("Vehicle insurance expired");
  });

  it("blocked when DL verification missing", async () => {
    const future = new Date("2099-01-01");
    findFirstMock.mockResolvedValue({
      id: "ind-1",
      vehicleId: "v1",
      consignment: { ewayBillRequired: false },
      ewayBill: null,
      vehicle: {
        compliance: {
          rcVerified: true,
          rcExpiry: future,
          insuranceExpiry: future,
          pucExpiry: future,
          fitnessExpiry: future,
        },
      },
      driver: {
        dlVerified: false,
        otpVerified: true,
      },
    });

    const result = await checkIndentTripReadiness("ind-1");
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain("DL verification missing");
  });

  it("ready when mock RC/DL verification flags are set", async () => {
    const future = new Date("2099-01-01");
    findFirstMock.mockResolvedValue({
      id: "ind-1",
      vehicleId: "v1",
      consignment: { ewayBillRequired: false },
      ewayBill: null,
      vehicle: {
        compliance: {
          rcVerified: true,
          rcVerificationStatus: "MOCK",
          complianceState: "VERIFIED",
          rcExpiry: future,
          insuranceExpiry: future,
          pucExpiry: future,
          fitnessExpiry: future,
        },
      },
      driver: {
        dlVerified: true,
        dlVerificationStatus: "MOCK",
        otpVerified: true,
        dlStatus: "Active",
      },
    });

    const result = await checkIndentTripReadiness("ind-1");
    expect(result.ready).toBe(true);
  });

  it("blocked when required EWB incomplete", async () => {
    findFirstMock.mockResolvedValue({
      id: "ind-1",
      vehicleId: "v1",
      consignment: { ewayBillRequired: true },
      ewayBill: { mode: "NONE" },
      vehicle: {
        compliance: { rcVerified: true, rcExpiry: new Date("2099-01-01") },
      },
      driver: { dlVerified: true, otpVerified: true },
    });

    const result = await checkIndentTripReadiness("ind-1");
    expect(result.ready).toBe(false);
    expect(result.reasons.some((r) => r.includes("E-Way Bill"))).toBe(true);
  });
});
