import "server-only";

import { IntegrationError } from "../../core/errors";
import { parseEwayPortalDate } from "../map-to-indent";
import { normalizeNicEwayBill } from "../normalize";
import type { EwayBillProviderFetchResult } from "../types";
import {
  ewayAuthTtlMs,
  ewayEmail,
  ewayIpAddress,
  ewayNicAuthPath,
  ewayNicBaseUrl,
  ewayNicClientId,
  ewayNicClientSecret,
  ewayNicGetPath,
  ewayNicGstin,
  ewayNicPassword,
  ewayNicTimeoutMs,
  ewayNicUsername,
  isPerioneEwayConfigured,
} from "../nic-config";

const EBN_RE = /^\d{12}$/;

type PerioneEnvelope = {
  status_cd?: string | number;
  status_desc?: string;
  data?: Record<string, unknown>;
  error_info?: { user_message?: string; developer_message?: string };
  /** Plain gateway message or NIC-style error object. */
  error?: string | { message?: string; error_cd?: string };
};

type PerioneSession = {
  expiresAt: number;
};

let cachedSession: PerioneSession | null = null;

function perioneStatusOk(status: string | number | undefined): boolean {
  return String(status ?? "") === "1";
}

function perioneErrorMessage(body: PerioneEnvelope, fallback: string): string {
  if (body.status_desc?.trim()) return body.status_desc.trim();
  const info = body.error_info;
  if (info?.user_message?.trim()) return info.user_message.trim();
  if (info?.developer_message?.trim()) return info.developer_message.trim();
  const err = body.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && err.message?.trim()) return err.message.trim();
  return fallback;
}

function perioneRequestHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    client_id: ewayNicClientId()!,
    client_secret: ewayNicClientSecret()!,
    gstin: ewayNicGstin()!,
    ip_address: ewayIpAddress(),
  };
}

function baseCredentialParams(): Record<string, string> {
  return {
    email: ewayEmail()!,
    ip_address: ewayIpAddress(),
    client_id: ewayNicClientId()!,
    client_secret: ewayNicClientSecret()!,
    gstin: ewayNicGstin()!,
  };
}

async function perioneGet(path: string, params: Record<string, string>): Promise<PerioneEnvelope> {
  const url = new URL(`${ewayNicBaseUrl()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ewayNicTimeoutMs());
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: perioneRequestHeaders(),
      signal: controller.signal,
    });
    const text = await res.text();
    let body: PerioneEnvelope = {};
    try {
      body = text ? (JSON.parse(text) as PerioneEnvelope) : {};
    } catch {
      throw new IntegrationError(
        res.ok ? "Invalid response from E-Way Bill portal." : text.slice(0, 200) || res.statusText,
        "PROVIDER_ERROR",
        { status: res.status }
      );
    }
    if (!res.ok) {
      throw new IntegrationError(
        perioneErrorMessage(body, `E-Way Bill API error (${res.status})`),
        "PROVIDER_ERROR",
        { status: res.status, provider: "perione" }
      );
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function perioneAuthenticate(): Promise<PerioneSession> {
  const username = ewayNicUsername();
  const password = ewayNicPassword();
  if (!username || !password) {
    throw new IntegrationError(
      "E-Way Bill portal credentials are not configured (EWAY_USERNAME / EWAY_PASSWORD).",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }

  const body = await perioneGet(ewayNicAuthPath(), {
    ...baseCredentialParams(),
    username,
    password,
  });

  if (!perioneStatusOk(body.status_cd)) {
    throw new IntegrationError(
      perioneErrorMessage(body, "E-Way Bill authentication failed."),
      "PROVIDER_ERROR",
      { provider: "perione" }
    );
  }

  const ttl = ewayAuthTtlMs();
  const bufferMs = Math.min(60_000, Math.floor(ttl * 0.05));
  return { expiresAt: Date.now() + ttl - bufferMs };
}

async function perioneSession(): Promise<PerioneSession> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  cachedSession = await perioneAuthenticate();
  return cachedSession;
}

function normalizePerioneDates(raw: Record<string, unknown>) {
  const copy = { ...raw };
  if (typeof copy.validUpto === "string") {
    copy.validUpto = parseEwayPortalDate(copy.validUpto) ?? copy.validUpto;
  }
  if (typeof copy.ewayBillDate === "string") {
    copy.ewayBillDate = parseEwayPortalDate(copy.ewayBillDate) ?? copy.ewayBillDate;
  }
  if (typeof copy.docDate === "string") {
    copy.docDate = parseEwayPortalDate(copy.docDate) ?? copy.docDate;
  }
  return copy;
}

export async function perioneFetchEwayBill(
  ewayBillNumber: string
): Promise<EwayBillProviderFetchResult> {
  if (!isPerioneEwayConfigured()) {
    throw new IntegrationError(
      "Perione E-Way Bill API is not configured. Set EWAY_API_BASE_URL, EWAY_CLIENT_ID, EWAY_CLIENT_SECRET, EWAY_GSTIN, EWAY_EMAIL, EWAY_USERNAME, and EWAY_PASSWORD.",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }

  const ebn = ewayBillNumber.replace(/\s+/g, "");
  if (!EBN_RE.test(ebn)) {
    throw new IntegrationError("Please enter a valid 12-digit E-Way Bill number.", "INVALID_INPUT");
  }

  await perioneSession();

  const body = await perioneGet(ewayNicGetPath(), {
    ...baseCredentialParams(),
    ewbNo: ebn,
  });

  if (!perioneStatusOk(body.status_cd)) {
    throw new IntegrationError(
      perioneErrorMessage(body, "E-Way Bill not found or access denied."),
      "NOT_FOUND",
      { provider: "perione" }
    );
  }

  const dataObj = body.data;
  if (!dataObj || typeof dataObj !== "object") {
    throw new IntegrationError("Unexpected E-Way Bill portal response.", "PROVIDER_ERROR", {
      provider: "perione",
    });
  }

  const raw = normalizePerioneDates(dataObj);
  const data = normalizeNicEwayBill(ebn, raw, "CLIENT_PROVIDED", "perione");
  return { data, rawNic: raw };
}

/** Test helper — reset cached portal session. */
export function resetPerioneEwaySessionForTests() {
  cachedSession = null;
}
