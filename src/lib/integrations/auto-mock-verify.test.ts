import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const envSnapshot = { ...process.env };

const { findUniqueVehicleMock, findUniqueDriverMock, verifyVehicleRCMock, applyRcMock, verifyDlMock, applyDlMock } =
  vi.hoisted(() => ({
    findUniqueVehicleMock: vi.fn(),
    findUniqueDriverMock: vi.fn(),
    verifyVehicleRCMock: vi.fn(),
    applyRcMock: vi.fn(),
    verifyDlMock: vi.fn(),
    applyDlMock: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: findUniqueVehicleMock },
    driver: { findUnique: findUniqueDriverMock },
  },
}));

vi.mock("./vehicle/service", () => ({
  verifyVehicleRC: verifyVehicleRCMock,
  applyRcVerificationToVehicle: applyRcMock,
}));

vi.mock("./dl/service", () => ({
  verifyDrivingLicence: verifyDlMock,
  applyDlVerificationToDriver: applyDlMock,
}));

import {
  autoMockVerifyDriverOnAssign,
  autoMockVerifyVehicleOnAssign,
} from "./auto-mock-verify";

describe("autoMockVerifyVehicleOnAssign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    verifyVehicleRCMock.mockResolvedValue({
      valid: true,
      data: { registrationNumber: "MH12AB1234", verificationStatus: "MOCK" },
    });
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("skips when integration mode is live", async () => {
    process.env.INTEGRATION_MODE = "live";
    process.env.SUREPASS_API_KEY = "test-key";

    await autoMockVerifyVehicleOnAssign("veh-1", "MH12AB1234");

    expect(findUniqueVehicleMock).not.toHaveBeenCalled();
    expect(verifyVehicleRCMock).not.toHaveBeenCalled();
  });

  it("skips when RC is already verified", async () => {
    findUniqueVehicleMock.mockResolvedValue({
      id: "veh-1",
      compliance: { rcVerified: true },
    });

    await autoMockVerifyVehicleOnAssign("veh-1", "MH12AB1234");

    expect(verifyVehicleRCMock).not.toHaveBeenCalled();
    expect(applyRcMock).not.toHaveBeenCalled();
  });

  it("mock-verifies unverified vehicle in mock mode", async () => {
    findUniqueVehicleMock.mockResolvedValue({
      id: "veh-1",
      compliance: null,
    });

    await autoMockVerifyVehicleOnAssign("veh-1", "MH12AB1234");

    expect(verifyVehicleRCMock).toHaveBeenCalledWith("MH12AB1234");
    expect(applyRcMock).toHaveBeenCalledWith(
      "veh-1",
      expect.objectContaining({ verificationStatus: "MOCK" }),
      undefined
    );
  });
});

describe("autoMockVerifyDriverOnAssign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    verifyDlMock.mockResolvedValue({
      valid: true,
      data: { dlNumber: "MH0123456789", verificationStatus: "MOCK" },
    });
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("skips when integration mode is live", async () => {
    process.env.INTEGRATION_MODE = "live";
    process.env.SUREPASS_API_KEY = "test-key";

    await autoMockVerifyDriverOnAssign("drv-1");

    expect(findUniqueDriverMock).not.toHaveBeenCalled();
    expect(verifyDlMock).not.toHaveBeenCalled();
  });

  it("skips when DL is already verified", async () => {
    findUniqueDriverMock.mockResolvedValue({
      id: "drv-1",
      dlNumber: "MH0123456789",
      dlVerified: true,
      dateOfBirth: null,
    });

    await autoMockVerifyDriverOnAssign("drv-1");

    expect(verifyDlMock).not.toHaveBeenCalled();
    expect(applyDlMock).not.toHaveBeenCalled();
  });

  it("mock-verifies unverified driver using stored DOB when available", async () => {
    findUniqueDriverMock.mockResolvedValue({
      id: "drv-1",
      dlNumber: "MH0123456789",
      dlVerified: false,
      dateOfBirth: new Date("1985-06-15"),
    });

    await autoMockVerifyDriverOnAssign("drv-1");

    expect(verifyDlMock).toHaveBeenCalledWith("MH0123456789", "1985-06-15");
    expect(applyDlMock).toHaveBeenCalledWith(
      "drv-1",
      expect.objectContaining({ verificationStatus: "MOCK" }),
      undefined
    );
  });

  it("uses fallback DOB when driver has no date of birth", async () => {
    findUniqueDriverMock.mockResolvedValue({
      id: "drv-1",
      dlNumber: "MH0123456789",
      dlVerified: false,
      dateOfBirth: null,
    });

    await autoMockVerifyDriverOnAssign("drv-1");

    expect(verifyDlMock).toHaveBeenCalledWith("MH0123456789", "1990-01-01");
    expect(applyDlMock).toHaveBeenCalled();
  });
});
