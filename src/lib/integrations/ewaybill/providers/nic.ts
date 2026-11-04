import "server-only";

import { IntegrationError } from "../../core/errors";
import {
  nicDecryptAuthSek,
  nicDecryptGetEwayBillPayload,
  nicGenerateAppKey,
  nicRsaEncryptBase64Payload,
} from "../nic-crypto";
import { normalizeNicEwayBill } from "../normalize";
import { parseEwayPortalDate } from "../map-to-indent";
import type { EwayBillProviderFetchResult } from "../types";
import {
  ewayNicAuthPath,
  ewayNicBaseUrl,
  ewayNicClientId,
  ewayNicClientSecret,
  ewayNicGetPath,
  ewayNicGstin,
  ewayNicPassword,
  ewayNicPublicKeyPem,
  ewayNicStaticAuthToken,
  ewayNicStaticSekKeyBase64,
  ewayNicTimeoutMs,
  ewayNicUsername,
  isNicEwayConfigured,
} from "../nic-config";

const EBN_RE = /^\d{12}$/;

type NicSession = {
  authtoken: string;
  sekKeyBase64: string;
  expiresAt: number;
};

let cachedSession: NicSession | null = null;

function nicHeaders(authtoken: string): HeadersInit {
  return {
    Accept: "application/json",
    "client-id": ewayNicClientId()!,
    "client-secret": ewayNicClientSecret()!,
    Gstin: ewayNicGstin()!,
    authtoken,
  };
}

async function nicFetchJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ewayNicTimeoutMs());
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new IntegrationError(
        res.ok ? "Invalid response from E-Way Bill portal." : text.slice(0, 200) || res.statusText,
        "PROVIDER_ERROR",
        { status: res.status }
      );
    }
    if (!res.ok) {
      throw new IntegrationError(
        pickNicError(body) ?? `E-Way Bill API error (${res.status})`,
        "PROVIDER_ERROR",
        { status: res.status }
      );
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function pickNicError(body: Record<string, unknown>): string | null {
  const err = body.error ?? body.Error ?? body.message ?? body.Message;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (body.status === "0" || body.Status === "0") {
    const info = body.info ?? body.Info ?? body.data;
    if (typeof info === "string") return info;
  }
  return null;
}

async function nicAuthenticate(): Promise<NicSession> {
  const staticToken = ewayNicStaticAuthToken();
  const staticSek = ewayNicStaticSekKeyBase64();
  if (staticToken && staticSek) {
    return {
      authtoken: staticToken,
      sekKeyBase64: staticSek,
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    };
  }

  const username = ewayNicUsername();
  const password = ewayNicPassword();
  if (!username || !password) {
    throw new IntegrationError(
      "E-Way Bill portal credentials are not configured (EWAY_USERNAME / EWAY_PASSWORD).",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }

  const { appKey, appKeyBase64 } = nicGenerateAppKey();
  const authPayload = JSON.stringify({
    action: "ACCESSTOKEN",
    username,
    password,
    app_key: appKeyBase64,
  });
  const payloadBase64 = Buffer.from(authPayload, "utf8").toString("base64");

  const publicKey = ewayNicPublicKeyPem();
  let body: Record<string, unknown>;

  if (publicKey) {
    const encrypted = nicRsaEncryptBase64Payload(payloadBase64, publicKey);
    body = await nicFetchJson(`${ewayNicBaseUrl()}${ewayNicAuthPath()}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "client-id": ewayNicClientId()!,
        "client-secret": ewayNicClientSecret()!,
        Gstin: ewayNicGstin()!,
      },
      body: JSON.stringify({ Data: encrypted }),
    });
  } else {
    body = await nicFetchJson(`${ewayNicBaseUrl()}${ewayNicAuthPath()}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "client-id": ewayNicClientId()!,
        "client-secret": ewayNicClientSecret()!,
        Gstin: ewayNicGstin()!,
      },
      body: authPayload,
    });
  }

  const status = String(body.status ?? body.Status ?? "");
  if (status === "0") {
    throw new IntegrationError(
      pickNicError(body) ?? "E-Way Bill authentication failed.",
      "PROVIDER_ERROR"
    );
  }

  const authtoken = String(body.authtoken ?? body.AuthToken ?? "");
  const encSek = String(body.sek ?? body.Sek ?? "");
  if (!authtoken || !encSek) {
    throw new IntegrationError("E-Way Bill authentication response was incomplete.", "PROVIDER_ERROR");
  }

  const sekKeyBase64 = nicDecryptAuthSek(encSek, appKey);
  return {
    authtoken,
    sekKeyBase64,
    expiresAt: Date.now() + 350 * 60 * 1000,
  };
}

async function nicSession(): Promise<NicSession> {
  if (cachedSession && cachedSession.expiresAt > Date.now() + 60_000) {
    return cachedSession;
  }
  cachedSession = await nicAuthenticate();
  return cachedSession;
}

type NicGetEnvelope = {
  status?: string | number;
  Status?: string | number;
  data?: string;
  rek?: string;
  hmac?: string;
};

function normalizeNicDates(raw: Record<string, unknown>) {
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

export async function nicFetchEwayBill(
  ewayBillNumber: string
): Promise<EwayBillProviderFetchResult> {
  if (!isNicEwayConfigured()) {
    throw new IntegrationError(
      "NIC E-Way Bill API is not configured. Set EWAY_API_BASE_URL, EWAY_CLIENT_ID, EWAY_CLIENT_SECRET, and EWAY_GSTIN.",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }

  const ebn = ewayBillNumber.replace(/\s+/g, "");
  if (!EBN_RE.test(ebn)) {
    throw new IntegrationError("Please enter a valid 12-digit E-Way Bill number.", "INVALID_INPUT");
  }

  const session = await nicSession();
  const url = `${ewayNicBaseUrl()}${ewayNicGetPath()}?ewbNo=${encodeURIComponent(ebn)}`;
  const envelope = (await nicFetchJson(url, {
    method: "GET",
    headers: nicHeaders(session.authtoken),
  })) as NicGetEnvelope;

  const status = String(envelope.status ?? envelope.Status ?? "");
  if (status === "0") {
    throw new IntegrationError("E-Way Bill not found or access denied.", "NOT_FOUND");
  }

  if (!envelope.data || !envelope.rek) {
    throw new IntegrationError("Unexpected E-Way Bill portal response.", "PROVIDER_ERROR");
  }

  let jsonText: string;
  try {
    jsonText = nicDecryptGetEwayBillPayload(envelope.data, envelope.rek, session.sekKeyBase64);
  } catch {
    throw new IntegrationError("Could not decrypt E-Way Bill response.", "PROVIDER_ERROR");
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new IntegrationError("Invalid E-Way Bill payload from portal.", "PROVIDER_ERROR");
  }

  raw = normalizeNicDates(raw);
  const data = normalizeNicEwayBill(ebn, raw, "CLIENT_PROVIDED", "nic-gst");
  return { data, rawNic: raw };
}

/** Test helper — reset cached portal session. */
export function resetNicEwaySessionForTests() {
  cachedSession = null;
}
