import "server-only";

import {
  extractNicEwayErrorCodes,
  nicEwayErrorUserMessage,
} from "../perione-nic-errors";
import { IntegrationError } from "../../core/errors";
import { parseEwayPortalDate } from "../map-to-indent";
import { normalizeNicEwayBill } from "../normalize";
import type { EwayBillProviderFetchResult } from "../types";
import {
  ewayEmail,
  ewayNicBaseUrl,
  ewayNicClientId,
  ewayNicClientSecret,
  ewayNicGetPath,
  ewayNicTimeoutMs,
  isPerioneEwayConfigured,
} from "../nic-config";

const EBN_RE = /^\d{12}$/;

type PerioneResponseItem = {
  responseStatus?: string;
  response?: Record<string, unknown>;
  message?: string | null;
};

type PerioneEnvelope = {
  code?: string | number;
  message?: string;
  status_cd?: string | number;
  status_desc?: string;
  data?: Record<string, unknown>;
  error_info?: { user_message?: string; developer_message?: string };
  error?: string | boolean | { message?: string; error_cd?: string; errorCodes?: string | number };
  response?: PerioneResponseItem[];
};

function perioneStatusOk(status: string | number | undefined): boolean {
  return String(status ?? "") === "1";
}

function perioneLiteSuccess(body: PerioneEnvelope): boolean {
  const err = body.error;
  const errOk = err === "false" || err === false;
  if (!errOk || String(body.code ?? "") !== "200") return false;
  const item = body.response?.[0];
  if (item?.responseStatus && item.responseStatus !== "SUCCESS") return false;
  return true;
}

function perioneErrorBody(body: PerioneEnvelope) {
  const first = body.response?.[0];
  const inner = first?.response;
  const innerCode =
    inner && typeof inner === "object" && inner.errorCodes != null && inner.errorCodes !== ""
      ? String(inner.errorCodes)
      : undefined;

  const err = body.error;
  let errorField: { message?: string; error_cd?: string; errorCodes?: string | number } | string | undefined;
  if (err && typeof err === "object") {
    errorField = err;
  } else if (innerCode) {
    errorField = { errorCodes: innerCode };
  } else if (typeof err === "string" && err.trim() && err !== "false") {
    errorField = err;
  }

  return {
    status_desc:
      (typeof first?.message === "string" ? first.message : undefined) ??
      body.status_desc ??
      undefined,
    error: errorField,
  };
}

function perioneResponseItemFailed(body: PerioneEnvelope): boolean {
  const status = body.response?.[0]?.responseStatus;
  return Boolean(status && status !== "SUCCESS");
}

function perioneErrorMessage(body: PerioneEnvelope, fallback: string): string {
  const codes = extractNicEwayErrorCodes(perioneErrorBody(body));
  const mapped = nicEwayErrorUserMessage(codes, fallback);
  if (codes.length > 0 && mapped !== fallback) return mapped;
  if (body.message?.trim() && !perioneResponseItemFailed(body)) return body.message.trim();
  if (body.status_desc?.trim()) return body.status_desc.trim();
  const firstResp = body.response?.[0];
  if (firstResp?.message?.trim()) return firstResp.message.trim();
  const info = body.error_info;
  if (info?.user_message?.trim()) return info.user_message.trim();
  if (info?.developer_message?.trim()) return info.developer_message.trim();
  const err = body.error;
  if (typeof err === "string" && err.trim() && err !== "false") return err.trim();
  if (err && typeof err === "object" && err.message?.trim()) return err.message.trim();
  return fallback;
}

function requirePerioneCredentials(): { email: string; clientId: string; clientSecret: string } {
  const email = ewayEmail()?.trim();
  const clientId = ewayNicClientId()?.trim();
  const clientSecret = ewayNicClientSecret()?.trim();
  if (!email) {
    throw new IntegrationError(
      "EWAY_EMAIL is not set. Add the portal email to the server environment.",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }
  if (!clientId || !clientSecret) {
    throw new IntegrationError(
      "EWAY_CLIENT_ID and EWAY_CLIENT_SECRET must be configured.",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }
  return { email, clientId, clientSecret };
}

/** Perione GetEwayBill: email query param, client_id/client_secret headers, JSON body { ewbNo }. */
function perioneGetEwayBillRequestUrl(email: string): string {
  const url = new URL(`${ewayNicBaseUrl()}${ewayNicGetPath()}`);
  url.searchParams.set("email", email);
  return url.toString();
}

function perioneGetEwayBillHeaders(clientId: string, clientSecret: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    client_id: clientId,
    client_secret: clientSecret,
  };
  const bearer = process.env.EWAY_PERIONE_BEARER?.trim();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const envHeader = process.env.EWAY_PERIONE_ENV?.trim();
  if (envHeader) headers.env = envHeader;
  return headers;
}

async function perionePostGetEwayBill(ewbNo: string): Promise<PerioneEnvelope> {
  const { email, clientId, clientSecret } = requirePerioneCredentials();
  const url = perioneGetEwayBillRequestUrl(email);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ewayNicTimeoutMs());
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: perioneGetEwayBillHeaders(clientId, clientSecret),
      body: JSON.stringify({ ewbNo }),
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
    if (Array.isArray(body.response) && body.response.length > 0 && !perioneLiteSuccess(body)) {
      throwPerioneFailure(body, "E-Way Bill not found or access denied.");
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function integrationCodeForNicErrors(codes: string[]): "NOT_FOUND" | "PROVIDER_ERROR" {
  if (codes.some((c) => c === "301" || c === "344" || c === "325")) return "NOT_FOUND";
  return "PROVIDER_ERROR";
}

function throwPerioneFailure(body: PerioneEnvelope, fallback: string): never {
  const codes = extractNicEwayErrorCodes(perioneErrorBody(body));
  throw new IntegrationError(perioneErrorMessage(body, fallback), integrationCodeForNicErrors(codes), {
    provider: "perione",
  });
}

function extractPerioneRawPayload(body: PerioneEnvelope): Record<string, unknown> {
  if (Array.isArray(body.response) && body.response.length > 0) {
    if (!perioneLiteSuccess(body)) {
      throwPerioneFailure(body, "E-Way Bill not found or access denied.");
    }
    const item = body.response[0];
    if (item.responseStatus === "SUCCESS" && item.response && typeof item.response === "object") {
      return item.response;
    }
    throwPerioneFailure(body, item.message?.trim() || "Unexpected E-Way Bill portal response.");
  }

  if (perioneStatusOk(body.status_cd)) {
    const dataObj = body.data;
    if (dataObj && typeof dataObj === "object") {
      return dataObj;
    }
  }

  throwPerioneFailure(body, "E-Way Bill not found or access denied.");
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
      "Perione E-Way Bill API is not configured. Set EWAY_API_BASE_URL, EWAY_CLIENT_ID, EWAY_CLIENT_SECRET, and EWAY_EMAIL.",
      "INTEGRATION_NOT_CONFIGURED"
    );
  }

  const ebn = ewayBillNumber.replace(/\s+/g, "");
  if (!EBN_RE.test(ebn)) {
    throw new IntegrationError("Please enter a valid 12-digit E-Way Bill number.", "INVALID_INPUT");
  }

  const body = await perionePostGetEwayBill(ebn);
  const raw = normalizePerioneDates(extractPerioneRawPayload(body));
  const data = normalizeNicEwayBill(ebn, raw, "CLIENT_PROVIDED", "perione");
  return { data, rawNic: raw };
}

/** @deprecated Lite API has no auth session — kept for tests. */
export function resetPerioneEwaySessionForTests() {
  /* no-op */
}
