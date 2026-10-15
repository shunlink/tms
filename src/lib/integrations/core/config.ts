import "server-only";

export type IntegrationProviderName = "surepass" | "mock";

export type IntegrationMode = "mock" | "live";

export type SurepassMode = "production" | "sandbox";

export function integrationMode(): IntegrationMode {
  if (process.env.INTEGRATION_PROVIDER?.toLowerCase() === "mock") return "mock";

  const modeRaw = process.env.INTEGRATION_MODE?.toLowerCase();
  if (modeRaw === "live" || modeRaw === "mock") {
    return modeRaw;
  }

  // Legacy: explicit surepass provider + API key → live
  if (process.env.INTEGRATION_PROVIDER?.toLowerCase() === "surepass" && surepassApiKey()) {
    return "live";
  }

  return "mock";
}

/** True when live mode is active and provider credentials are present. */
export function isIntegrationLive(): boolean {
  return integrationMode() === "live" && Boolean(surepassApiKey());
}

export function integrationProvider(): IntegrationProviderName {
  return isIntegrationLive() ? "surepass" : "mock";
}

export function surepassMode(): SurepassMode {
  const raw = (process.env.SUREPASS_MODE ?? "production").toLowerCase();
  return raw === "sandbox" ? "sandbox" : "production";
}

export function surepassBaseUrl(): string {
  if (process.env.SUREPASS_BASE_URL) {
    return process.env.SUREPASS_BASE_URL.replace(/\/$/, "");
  }
  return surepassMode() === "sandbox"
    ? "https://sandbox.surepass.app/api/v1"
    : "https://kyc-api.surepass.app/api/v1";
}

export function surepassApiKey(): string | null {
  const key = process.env.SUREPASS_API_KEY?.trim();
  return key || null;
}

export function isIntegrationConfigured(): boolean {
  if (integrationMode() === "mock") return true;
  return Boolean(surepassApiKey());
}

export function surepassEndpoints() {
  return {
    gst: process.env.SUREPASS_GST_ENDPOINT ?? "corporate/gstin",
    rc: process.env.SUREPASS_RC_ENDPOINT ?? "rc/rc-v2",
    dl: process.env.SUREPASS_DL_ENDPOINT ?? "driving-license/driving-license",
    ewayFetch: process.env.SUREPASS_EWAY_FETCH_ENDPOINT ?? "eway/eway-bill",
    ewayGenerate: process.env.SUREPASS_EWAY_GENERATE_ENDPOINT ?? "eway/eway-bill-generate",
  };
}

export function surepassTimeoutMs(): number {
  const raw = process.env.SUREPASS_TIMEOUT_MS;
  const n = raw ? Number.parseInt(raw, 10) : 30_000;
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}
