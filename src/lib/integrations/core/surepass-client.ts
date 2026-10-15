import "server-only";

import {
  isIntegrationConfigured,
  surepassApiKey,
  surepassBaseUrl,
  surepassTimeoutMs,
} from "./config";
import { assertLiveIntegrationConfigured } from "./resolver";
import { IntegrationError } from "./errors";

export type SurepassEnvelope<T = Record<string, unknown>> = {
  success: boolean;
  status_code: number;
  message: string;
  message_code?: string;
  data?: T;
};

export async function surepassPost<T = Record<string, unknown>>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<T> {
  assertLiveIntegrationConfigured();
  if (!isIntegrationConfigured()) {
    throw new IntegrationError(
      "Verification provider is not configured. Add SUREPASS_API_KEY to the server environment.",
      "INTEGRATION_NOT_CONFIGURED",
      { provider: "surepass" }
    );
  }

  const apiKey = surepassApiKey();
  const base = surepassBaseUrl();
  const path = endpoint.replace(/^\//, "");
  const url = `${base}/${path}`;
  const timeoutMs = surepassTimeoutMs();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("timeout")) {
      throw new IntegrationError(
        "Verification provider timed out. Please try again.",
        "PROVIDER_TIMEOUT",
        { provider: "surepass" }
      );
    }
    throw new IntegrationError(
      "Verification provider is temporarily unavailable.",
      "PROVIDER_UNAVAILABLE",
      { provider: "surepass" }
    );
  }

  let body: SurepassEnvelope<T> | null = null;
  try {
    body = (await res.json()) as SurepassEnvelope<T>;
  } catch {
    throw new IntegrationError(
      "Received an invalid response from the verification provider.",
      "INVALID_RESPONSE",
      { provider: "surepass" }
    );
  }

  if (!body) {
    throw new IntegrationError(
      "Received an empty response from the verification provider.",
      "INVALID_RESPONSE",
      { provider: "surepass" }
    );
  }

  if (res.status === 429 || body.status_code === 429) {
    throw new IntegrationError(
      "Verification provider rate limit reached. Please try again shortly.",
      "PROVIDER_RATE_LIMITED",
      { provider: "surepass", retryAfter: 60 }
    );
  }

  if (res.status === 401 || body.status_code === 401) {
    throw new IntegrationError(
      "Verification provider authentication failed. Check SUREPASS_API_KEY.",
      "INTEGRATION_NOT_CONFIGURED",
      { provider: "surepass", status: 503 }
    );
  }

  if (!res.ok || body.success === false) {
    const message = (body.message || "").toLowerCase();
    if (message.includes("not found") || body.status_code === 404) {
      throw new IntegrationError(
        body.message || "Record not found with the verification provider.",
        "NOT_FOUND",
        { provider: "surepass" }
      );
    }
    if (message.includes("invalid") || body.status_code === 422) {
      throw new IntegrationError(
        body.message || "Invalid input for verification.",
        "INVALID_INPUT",
        { provider: "surepass" }
      );
    }
    throw new IntegrationError(
      body.message || "Verification provider request failed.",
      "PROVIDER_ERROR",
      { provider: "surepass" }
    );
  }

  if (!body.data) {
    throw new IntegrationError(
      "Verification provider returned no data.",
      "INVALID_RESPONSE",
      { provider: "surepass" }
    );
  }

  return body.data;
}
