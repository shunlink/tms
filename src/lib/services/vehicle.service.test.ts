import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  findUniqueMock,
  findFirstMock,
  createMock,
  indentUpdateMock,
  allocFindFirstMock,
  transactionMock,
  logAuditMock,
  autoMockVerifyVehicleOnAssignMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findFirstMock: vi.fn(),
  createMock: vi.fn(),
  indentUpdateMock: vi.fn(),
  allocFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  logAuditMock: vi.fn(),
  autoMockVerifyVehicleOnAssignMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findUnique: findUniqueMock,
      create: createMock,
    },
    indent: {
      findFirst: findFirstMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

vi.mock("./indent.service", () => ({
  getIndentById: vi.fn().mockResolvedValue({ id: "ind-1" }),
}));

vi.mock("../integrations/auto-mock-verify", () => ({
  autoMockVerifyVehicleOnAssign: autoMockVerifyVehicleOnAssignMock,
}));

import {
  assignVehicleToIndent,
  lookupVehicleByRegistration,
} from "./vehicle.service";

const existingVehicle = {
  id: "veh-1",
  registrationNumber: "MH12AB1234",
  vehicleTypeCode: "TRUCK_17FT",
  bodyTypeCode: "Open",
  capacityTons: { toString: () => "18" },
  capacityCbm: null,
  make: "TATA",
  model: "LPT 1613",
  year: 2020,
  ownership: "MARKET",
  remarks: null,
  compliance: {
    ownerName: "JOHN DOE",
    ownerPan: "ABCDE1234F",
    rcNumber: "MH12AB1234",
    rcExpiry: new Date("2027-01-15"),
    insuranceNumber: "POL123",
    insuranceCompany: "ICICI",
    insuranceExpiry: new Date("2027-06-01"),
    fitnessExpiry: new Date("2027-01-15"),
    pucNumber: "PUC987",
    pucExpiry: new Date("2027-03-01"),
    permitType: "National",
    permitNumber: "PER123",
    permitExpiry: new Date("2027-12-01"),
    rcVerified: true,
    rcVerificationStatus: "VERIFIED",
    rcVerifiedAt: new Date("2026-01-01"),
    rcVerificationProvider: "mock",
    complianceState: "VERIFIED",
    fuelType: "DIESEL",
    vehicleClass: "Goods Carrier",
  },
};

describe("lookupVehicleByRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes registration number and returns stored vehicle details", async () => {
    findUniqueMock.mockResolvedValue(existingVehicle);

    const result = await lookupVehicleByRegistration("MH-12 AB-1234");

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { registrationNumber: "MH12AB1234" },
      include: { compliance: true },
    });
    expect(result).toMatchObject({
      id: "veh-1",
      registrationNumber: "MH12AB1234",
      make: "TATA",
      model: "LPT 1613",
      compliance: {
        ownerName: "JOHN DOE",
        rcVerified: true,
        rcVerificationStatus: "VERIFIED",
        fuelType: "DIESEL",
        vehicleClass: "Goods Carrier",
      },
    });
  });

  it("returns null for unknown vehicle", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await lookupVehicleByRegistration("MH99ZZ9999");
    expect(result).toBeNull();
  });

  it("does not call external RC integration", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    findUniqueMock.mockResolvedValue(existingVehicle);

    await lookupVehicleByRegistration("MH12AB1234");

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("assignVehicleToIndent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstMock.mockResolvedValue({
      id: "ind-1",
      vendorId: "vendor-1",
      placementStatus: "VEHICLE_REACHED",
      consignment: { vehicleTypeCode: "TRUCK_17FT" },
    });
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        indent: { update: indentUpdateMock },
        indentAllocation: { findFirst: allocFindFirstMock, update: vi.fn() },
      })
    );
    allocFindFirstMock.mockResolvedValue(null);
  });

  it("reuses existing vehicle without creating a duplicate", async () => {
    findUniqueMock.mockResolvedValue(existingVehicle);

    await assignVehicleToIndent("ind-1", { registrationNumber: "MH12AB1234" });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { registrationNumber: "MH12AB1234" },
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(indentUpdateMock).toHaveBeenCalledWith({
      where: { id: "ind-1" },
      data: { vehicleId: "veh-1" },
    });
    expect(autoMockVerifyVehicleOnAssignMock).toHaveBeenCalledWith(
      "veh-1",
      "MH12AB1234",
      undefined
    );
  });

  it("finds vehicle with spaced/hyphenated registration input", async () => {
    findUniqueMock.mockResolvedValue(existingVehicle);

    await assignVehicleToIndent("ind-1", { registrationNumber: "MH-12 AB-1234" });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { registrationNumber: "MH12AB1234" },
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a vehicle when not found in master", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockResolvedValue({
      id: "veh-new",
      registrationNumber: "MH99ZZ9999",
    });

    await assignVehicleToIndent("ind-1", { registrationNumber: "MH99ZZ9999" });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationNumber: "MH99ZZ9999",
        vehicleTypeCode: "TRUCK_17FT",
      }),
    });
  });

  it("does not overwrite VehicleCompliance when reusing an existing vehicle", async () => {
    findUniqueMock.mockResolvedValue(existingVehicle);

    await assignVehicleToIndent("ind-1", { registrationNumber: "MH12AB1234" });

    expect(createMock).not.toHaveBeenCalled();
    expect(indentUpdateMock).toHaveBeenCalled();
    const complianceUpdateCalls = indentUpdateMock.mock.calls.filter(
      (call) => call[0]?.data?.compliance
    );
    expect(complianceUpdateCalls).toHaveLength(0);
  });

  it("does not attach vendorId during indent assignment create", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockResolvedValue({ id: "veh-new", registrationNumber: "MH99ZZ9999" });

    await assignVehicleToIndent("ind-1", { registrationNumber: "MH99ZZ9999" });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ vendorId: expect.anything() }),
    });
  });

  it("prevents duplicate creation on repeated assignment with same number", async () => {
    findUniqueMock.mockResolvedValue(existingVehicle);

    await assignVehicleToIndent("ind-1", { registrationNumber: "MH12AB1234" });
    await assignVehicleToIndent("ind-1", { registrationNumber: "MH 12 AB 1234" });

    expect(createMock).not.toHaveBeenCalled();
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });
});
