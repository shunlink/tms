import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockVerifyGstin } from "./gst/providers/mock";
import { mockFetchEwayBill, mockGenerateEwayBill } from "./ewaybill/providers/mock";
import { mockVerifyVehicleRc } from "./vehicle/providers/mock";
import { mockVerifyDrivingLicence } from "./dl/providers/mock";
import { normalizeSurepassGst } from "./gst/normalize";
import { isEwayBillExpired } from "./ewaybill/normalize";
import { computeVehicleCompliance, documentValidity } from "./vehicle/compliance";
import { IntegrationError } from "./core/errors";
import {
  integrationMode,
  integrationProvider,
  isIntegrationConfigured,
  isIntegrationLive,
} from "./core/config";
import { verifyGSTIN } from "./gst/service";
import { verifyVehicleRC } from "./vehicle/service";
import { verifyDrivingLicence } from "./dl/service";
import { fetchEWayBill } from "./ewaybill/service";

const envKeys = [
  "INTEGRATION_MODE",
  "INTEGRATION_PROVIDER",
  "SUREPASS_API_KEY",
] as const;

function saveEnv() {
  return Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const k of envKeys) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
}

describe("GST verification (mock)", () => {
  it("verifies valid GSTIN", async () => {
    const result = await mockVerifyGstin("29AABCU9603R1ZL");
    expect(result.valid).toBe(true);
    expect(result.data.gstin).toBe("29AABCU9603R1ZL");
    expect(result.data.verificationStatus).toBe("MOCK");
    expect(result.data.verificationMode).toBe("MOCK");
  });

  it("rejects invalid GSTIN format", async () => {
    await expect(mockVerifyGstin("INVALID")).rejects.toBeInstanceOf(IntegrationError);
  });

  it("handles not found GSTIN", async () => {
    await expect(mockVerifyGstin("29AABCU9603R1Z0")).rejects.toMatchObject({
      integrationCode: "NOT_FOUND",
    });
  });

  it("normalizes provider response", () => {
    const data = normalizeSurepassGst("29AABCU9603R1ZL", {
      gstin: "29AABCU9603R1ZL",
      legal_name: "ABC LTD",
      business_name: "ABC",
      gstin_status: "Active",
      date_of_registration: "2018-01-01",
      address: "Pune",
    });
    expect(data.legalName).toBe("ABC LTD");
    expect(data.verificationStatus).toBe("VERIFIED");
  });
});

describe("E-Way Bill (mock)", () => {
  it("fetches existing EWB", async () => {
    const result = await mockFetchEwayBill("123456789011");
    expect(result.data.ewayBillNumber).toBe("123456789011");
    expect(result.data.supplierGstin).toBeTruthy();
    expect(result.data.source).toBe("CLIENT_PROVIDED");
    expect(result.data.verificationMode).toBe("MOCK");
  });

  it("rejects invalid EBN", async () => {
    await expect(mockFetchEwayBill("123")).rejects.toBeInstanceOf(IntegrationError);
  });

  it("handles EWB not found", async () => {
    await expect(mockFetchEwayBill("123456789000")).rejects.toMatchObject({
      integrationCode: "NOT_FOUND",
    });
  });

  it("detects expired EWB from validity", () => {
    expect(isEwayBillExpired({ status: "Expired", validUntil: null })).toBe(true);
    expect(
      isEwayBillExpired({ status: "Active", validUntil: "2099-01-01" })
    ).toBe(false);
  });

  it("generation backend service works", async () => {
    const result = await mockGenerateEwayBill({
      supplierGstin: "27AAAAA0000A1Z5",
      recipientGstin: "29BBBBB0000B1Z6",
      documentType: "Tax Invoice",
      documentNumber: "INV-1",
      documentDate: "2026-10-06",
      goodsDescription: "Steel",
      origin: "Jamshedpur",
      destination: "Pune",
      vehicleNumber: "MH12AB1234",
    });
    expect(result.data.source).toBe("SHUNLINK_GENERATED");
    expect(result.data.ewayBillNumber).toBeTruthy();
    expect(result.data.verificationMode).toBe("MOCK");
  });
});

describe("Vehicle RC (mock)", () => {
  it("verifies vehicle successfully", async () => {
    const result = await mockVerifyVehicleRc("MH12AB1234");
    expect(result.valid).toBe(true);
    expect(result.data.compliance.overall).toBe("VERIFIED");
    expect(result.data.verificationStatus).toBe("MOCK");
  });

  it("rejects invalid registration", async () => {
    await expect(mockVerifyVehicleRc("BAD")).rejects.toBeInstanceOf(IntegrationError);
  });

  it("handles vehicle not found", async () => {
    await expect(mockVerifyVehicleRc("MH120000")).rejects.toMatchObject({
      integrationCode: "NOT_FOUND",
    });
  });

  it("calculates compliance from dates", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const c = computeVehicleCompliance({
      rcExpiry: future.toISOString(),
      insuranceExpiry: future.toISOString(),
      pucExpiry: future.toISOString(),
      fitnessExpiry: future.toISOString(),
      rcStatus: "ACTIVE",
    });
    expect(c.overall).toBe("VERIFIED");
    expect(documentValidity("1900-01-01")).toBe("UNKNOWN");
  });
});

describe("Driving Licence (mock)", () => {
  it("verifies DL with DOB", async () => {
    const result = await mockVerifyDrivingLicence("MH0123456789", "1990-01-15");
    expect(result.valid).toBe(true);
    expect(result.data.vehicleClasses.length).toBeGreaterThan(0);
    expect(result.data.verificationStatus).toBe("MOCK");
  });

  it("requires DOB", async () => {
    await expect(mockVerifyDrivingLicence("MH0123456789")).rejects.toBeInstanceOf(IntegrationError);
  });

  it("handles invalid DL", async () => {
    await expect(
      mockVerifyDrivingLicence("MH012345INVALID", "1990-01-15")
    ).rejects.toMatchObject({ integrationCode: "NOT_FOUND" });
  });
});

describe("integration configuration", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = saveEnv();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.unstubAllGlobals();
  });

  it("defaults to mock mode without API key", () => {
    delete process.env.INTEGRATION_MODE;
    delete process.env.INTEGRATION_PROVIDER;
    delete process.env.SUREPASS_API_KEY;
    expect(integrationMode()).toBe("mock");
    expect(isIntegrationLive()).toBe(false);
    expect(integrationProvider()).toBe("mock");
    expect(isIntegrationConfigured()).toBe(true);
  });

  it("mock mode works without API key", () => {
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    expect(isIntegrationLive()).toBe(false);
    expect(isIntegrationConfigured()).toBe(true);
  });

  it("live mode requires API key to be live", () => {
    process.env.INTEGRATION_MODE = "live";
    delete process.env.SUREPASS_API_KEY;
    expect(integrationMode()).toBe("live");
    expect(isIntegrationLive()).toBe(false);
    expect(isIntegrationConfigured()).toBe(false);
  });

  it("live mode with API key is configured", () => {
    process.env.INTEGRATION_MODE = "live";
    process.env.SUREPASS_API_KEY = "test-key";
    expect(isIntegrationLive()).toBe(true);
    expect(integrationProvider()).toBe("surepass");
    expect(isIntegrationConfigured()).toBe(true);
  });

  it("legacy INTEGRATION_PROVIDER=mock forces mock", () => {
    process.env.INTEGRATION_MODE = "live";
    process.env.INTEGRATION_PROVIDER = "mock";
    process.env.SUREPASS_API_KEY = "test-key";
    expect(integrationMode()).toBe("mock");
    expect(isIntegrationLive()).toBe(false);
  });
});

describe("integration service fallback", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = saveEnv();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.unstubAllGlobals();
  });

  it("mock GST verification without API key", async () => {
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    const result = await verifyGSTIN("29AABCU9603R1ZL");
    expect(result.data.verificationStatus).toBe("MOCK");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mock RC verification without API key", async () => {
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    const result = await verifyVehicleRC("MH12AB1234");
    expect(result.data.verificationStatus).toBe("MOCK");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mock DL verification without API key", async () => {
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    const result = await verifyDrivingLicence("MH0123456789", "1990-01-15");
    expect(result.data.verificationStatus).toBe("MOCK");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mock EWB fetch without API key", async () => {
    process.env.INTEGRATION_MODE = "mock";
    delete process.env.SUREPASS_API_KEY;
    const result = await fetchEWayBill("123456789011");
    expect(result.data.verificationMode).toBe("MOCK");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("live mode missing API key returns configuration error", async () => {
    process.env.INTEGRATION_MODE = "live";
    delete process.env.SUREPASS_API_KEY;
    await expect(verifyGSTIN("29AABCU9603R1ZL")).rejects.toMatchObject({
      integrationCode: "INTEGRATION_NOT_CONFIGURED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("live mode calls provider", async () => {
    process.env.INTEGRATION_MODE = "live";
    process.env.SUREPASS_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        status_code: 200,
        message: "Success",
        data: {
          gstin: "29AABCU9603R1ZL",
          legal_name: "LIVE CORP",
          business_name: "Live Corp",
          gstin_status: "Active",
          date_of_registration: "2018-01-01",
          address: "Mumbai",
        },
      }),
    } as Response);

    const result = await verifyGSTIN("29AABCU9603R1ZL");
    expect(fetch).toHaveBeenCalled();
    expect(result.data.legalName).toBe("LIVE CORP");
    expect(result.data.verificationStatus).toBe("VERIFIED");
  });

  it("mock mode never calls external provider", async () => {
    process.env.INTEGRATION_MODE = "mock";
    process.env.SUREPASS_API_KEY = "ignored-key";
    await verifyGSTIN("29AABCU9603R1ZL");
    await verifyVehicleRC("MH12AB1234");
    await verifyDrivingLicence("MH0123456789", "1990-01-15");
    await fetchEWayBill("123456789011");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("trip readiness (local checks)", () => {
  it("module exports readiness checker", async () => {
    const { checkIndentTripReadiness } = await import("./trip-readiness");
    expect(typeof checkIndentTripReadiness).toBe("function");
  });
});

describe("no automatic external calls on render", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it(
    "UI components do not call fetch at import time",
    async () => {
      await import("@/components/integrations/gst-verification-field");
      await import("@/components/integrations/eway-bill-section");
      expect(fetch).not.toHaveBeenCalled();
    },
    20_000
  );
});
