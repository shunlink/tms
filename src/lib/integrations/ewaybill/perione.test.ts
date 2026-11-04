import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchEWayBill } from "./service";
import { resetPerioneEwaySessionForTests } from "./providers/perione";

const EWAY_ENV_KEYS = [
  "EWAY_API_BASE_URL",
  "EWAY_CLIENT_ID",
  "EWAY_CLIENT_SECRET",
  "EWAY_GSTIN",
  "EWAY_USERNAME",
  "EWAY_PASSWORD",
  "EWAY_EMAIL",
  "EWAY_API_STYLE",
  "EWAY_AUTH_TTL_MS",
  "INTEGRATION_MODE",
  "SUREPASS_API_KEY",
] as const;

function saveEwayEnv() {
  return Object.fromEntries(EWAY_ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEwayEnv(snapshot: Record<string, string | undefined>) {
  for (const k of EWAY_ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  resetPerioneEwaySessionForTests();
}

const sampleData = {
  ewbNo: 131012976815,
  status: "ACT",
  fromGstin: "29AARFB4347G000",
  toGstin: "27AARFB4347G024",
  docType: "INV",
  docNo: "Perione-005",
  docDate: "11/07/2026",
  fromPlace: "FRAZER TOWN",
  toPlace: "Mumbai",
  totInvValue: 105,
  transporterName: "BlueFox Systems",
  transporterId: "29AARFB4347G000",
  ewayBillDate: "04/11/2026 06:06:00 PM",
  validUpto: "09/11/2026 11:59:00 PM",
  itemList: [{ productName: "Rice", hsnCode: 100610, quantity: 1 }],
  VehiclListDetails: [{ vehicleNo: "PVC1234" }],
};

function perioneEnv() {
  process.env.EWAY_API_BASE_URL = "https://staging.perione.in";
  process.env.EWAY_CLIENT_ID = "client-id";
  process.env.EWAY_CLIENT_SECRET = "client-secret";
  process.env.EWAY_GSTIN = "29AARFB4347G000";
  process.env.EWAY_USERNAME = "Bluefox";
  process.env.EWAY_PASSWORD = "secret";
  process.env.EWAY_EMAIL = "test@shunlink.in";
  process.env.EWAY_API_STYLE = "perione";
  process.env.EWAY_AUTH_TTL_MS = "3600000";
  delete process.env.SUREPASS_API_KEY;
  process.env.INTEGRATION_MODE = "mock";
}

describe("Perione E-Way Bill fetch", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = saveEwayEnv();
    vi.stubGlobal("fetch", vi.fn());
    resetPerioneEwaySessionForTests();
  });

  afterEach(() => {
    restoreEwayEnv(envSnapshot);
    vi.unstubAllGlobals();
  });

  it("authenticates and fetches by ewb number", async () => {
    perioneEnv();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("authenticate")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status_cd: "1", status_desc: "If authentication succeeds" }),
        } as Response;
      }
      if (url.includes("getewaybill")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status_cd: "1",
              status_desc: "EWAYBILL request succeeds",
              data: sampleData,
            }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await fetchEWayBill("131012976815");
    expect(result.data.provider).toBe("perione");
    expect(result.data.vehicleNumber).toBe("PVC1234");
    expect(result.data.supplierGstin).toBe("29AARFB4347G000");
    expect(result.indentDraft.consignorGstin).toBe("29AARFB4347G000");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reuses auth session within TTL", async () => {
    perioneEnv();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("authenticate")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status_cd: "1" }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status_cd: "1", data: { ...sampleData, ewbNo: 131012976815 } }),
      } as Response;
    });

    await fetchEWayBill("131012976815");
    await fetchEWayBill("131012976815");
    const authCalls = vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes("authenticate"));
    expect(authCalls.length).toBe(1);
  });

  it("surfaces auth failure from status_cd", async () => {
    perioneEnv();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status_cd: "0", status_desc: "Invalid credentials" }),
    } as Response);

    await expect(fetchEWayBill("131012976815")).rejects.toMatchObject({
      integrationCode: "PROVIDER_ERROR",
    });
  });
});
