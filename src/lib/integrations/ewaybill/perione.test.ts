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

const liteInner = {
  fromPincode: 410203,
  hsnCode: "73051929",
  ewayBillDate: "05/11/2026 12:43:00 PM",
  validUpto: "09/11/2026 11:59:00 PM",
  ewbNo: 282325194338,
  toPincode: 581116,
  VehiclListDetails: [{ vehicleNo: "MH46CL5915", enteredDate: "05/11/2026 12:43:00 PM", transMode: "1" }],
  status: "ACT",
  errorCodes: null,
};

const liteEnvelope = (inner: Record<string, unknown>) => ({
  code: "200",
  error: "false",
  message: "Success",
  response: [{ responseStatus: "SUCCESS", response: inner, message: null }],
});

function perioneEnv() {
  process.env.EWAY_API_BASE_URL = "https://staging.perione.in";
  process.env.EWAY_CLIENT_ID = "client-id";
  process.env.EWAY_CLIENT_SECRET = "client-secret";
  delete process.env.EWAY_GSTIN;
  delete process.env.EWAY_USERNAME;
  delete process.env.EWAY_PASSWORD;
  process.env.EWAY_EMAIL = "test@shunlink.in";
  process.env.EWAY_API_STYLE = "perione";
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

  it("POST GetEwayBill per Perione docs (email query, client headers, JSON ewbNo)", async () => {
    perioneEnv();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      expect(url).toContain("getewaybill");
      expect(url).toContain("email=test%40shunlink.in");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.client_id).toBe("client-id");
      expect(headers.client_secret).toBe("client-secret");
      expect(JSON.parse(String(init?.body))).toEqual({ ewbNo: "282325194338" });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(liteEnvelope(liteInner)),
      } as Response;
    });

    const result = await fetchEWayBill("282325194338");
    expect(result.data.provider).toBe("perione");
    expect(result.data.hsnCode).toBe("73051929");
    expect(result.data.vehicleNumber).toBe("MH46CL5915");
    expect(result.indentDraft.consignorPincode).toBe("410203");
    expect(result.indentDraft.consigneePincode).toBe("581116");
    expect(result.portalSummary?.status).toBe("ACT");
  });

  it("supports legacy status_cd envelope", async () => {
    perioneEnv();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status_cd: "1",
          data: { ...liteInner, ewbNo: 282325194338 },
        }),
    } as Response);

    const result = await fetchEWayBill("282325194338");
    expect(result.data.status).toBe("ACT");
  });

  it("surfaces failure from lite response item", async () => {
    perioneEnv();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          code: "200",
          error: "false",
          message: "Success",
          response: [
            {
              responseStatus: "FAILED",
              message: "Bill not found",
              response: { errorCodes: "301" },
            },
          ],
        }),
    } as Response);

    await expect(fetchEWayBill("282325194338")).rejects.toMatchObject({
      integrationCode: "NOT_FOUND",
    });
  });
});
