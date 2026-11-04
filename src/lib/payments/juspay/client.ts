import { juspayApiBase, juspayApiKey, juspayMerchantId } from "./config";

export type JuspayRequestOptions = {
  method: "GET" | "POST";
  path: string;
  routingId: string;
  body?: unknown;
  contentType?: string;
};

function basicAuthHeader(): string {
  const key = juspayApiKey();
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export async function juspayRequest<T = unknown>(opts: JuspayRequestOptions): Promise<T> {
  const url = `${juspayApiBase()}${opts.path.startsWith("/") ? opts.path : `/${opts.path}`}`;
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(),
    "x-merchantid": juspayMerchantId(),
    "x-routing-id": opts.routingId,
  };

  let body: string | undefined;
  if (opts.body !== undefined) {
    if (opts.contentType === "application/x-www-form-urlencoded") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body =
        typeof opts.body === "string"
          ? opts.body
          : new URLSearchParams(opts.body as Record<string, string>).toString();
    } else {
      headers["Content-Type"] = opts.contentType ?? "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(url, { method: opts.method, headers, body });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let msg =
      typeof data === "object" && data && "error_message" in data
        ? String((data as { error_message?: string }).error_message)
        : typeof data === "object" && data && "errorMessage" in data
          ? String((data as { errorMessage?: string }).errorMessage)
          : text || res.statusText;
    if (res.status === 401) {
      msg = `Invalid Juspay credentials for ${juspayApiBase()}. Use sandbox API key + merchant id with JUSPAY_API_BASE=https://sandbox.juspay.in (or production keys with https://api.juspay.in). Details: ${msg}`;
    }
    if (res.status === 403) {
      const info =
        typeof data === "object" && data && "error_info" in data
          ? (data as { error_info?: { code?: string; developer_message?: string } }).error_info
          : undefined;
      if (info?.code === "BAD_ORIGIN" || info?.developer_message?.includes("IP")) {
        msg = `Juspay blocked this server IP on ${juspayApiBase()}. Whitelist your egress IP in the Juspay dashboard, or use sandbox (JUSPAY_API_BASE=https://sandbox.juspay.in) for local dev. Production API calls must originate from an allowed IP (typically your VPS, not a home laptop).`;
      }
    }
    const err = new Error(`Juspay ${opts.method} ${opts.path} failed (${res.status}): ${msg}`);
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { body?: unknown }).body = data;
    throw err;
  }

  return data as T;
}
