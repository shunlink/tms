import "server-only";

export type EwayApiStyle = "perione" | "nic";

export function ewayNicBaseUrl(): string {
  return (process.env.EWAY_API_BASE_URL ?? "").replace(/\/$/, "");
}

export function ewayNicClientId(): string | null {
  return process.env.EWAY_CLIENT_ID?.trim() || null;
}

export function ewayNicClientSecret(): string | null {
  return process.env.EWAY_CLIENT_SECRET?.trim() || null;
}

export function ewayNicGstin(): string | null {
  return process.env.EWAY_GSTIN?.trim() || null;
}

export function ewayNicUsername(): string | null {
  return process.env.EWAY_USERNAME?.trim() || null;
}

export function ewayNicPassword(): string | null {
  return process.env.EWAY_PASSWORD?.trim() || null;
}

export function ewayEmail(): string | null {
  return process.env.EWAY_EMAIL?.trim() || null;
}

export function ewayIpAddress(): string {
  return process.env.EWAY_IP_ADDRESS?.trim() || "0";
}

export function ewayNicPublicKeyPem(): string | null {
  const raw = process.env.EWAY_PUBLIC_KEY?.trim();
  if (!raw) return null;
  return raw.includes("BEGIN PUBLIC KEY") ? raw : `-----BEGIN PUBLIC KEY-----\n${raw}\n-----END PUBLIC KEY-----`;
}

export function ewayNicStaticAuthToken(): string | null {
  return process.env.EWAY_AUTH_TOKEN?.trim() || null;
}

export function ewayNicStaticSekKeyBase64(): string | null {
  return process.env.EWAY_SEK_KEY_BASE64?.trim() || null;
}

export function ewayApiStyle(): EwayApiStyle {
  const raw = process.env.EWAY_API_STYLE?.trim().toLowerCase();
  if (raw === "nic" || raw === "perione") return raw;
  const base = ewayNicBaseUrl().toLowerCase();
  if (base.includes("perione.in")) return "perione";
  if (ewayNicPublicKeyPem()) return "nic";
  return "nic";
}

export function ewayNicAuthPath(): string {
  const p = process.env.EWAY_AUTH_PATH?.trim();
  if (p) return p.startsWith("/") ? p : `/${p}`;
  return ewayApiStyle() === "perione"
    ? "/ewaybillapi/v1.03/authenticate"
    : "/ewayapi/Authenticate";
}

export function ewayNicGetPath(): string {
  const p = process.env.EWAY_GET_PATH?.trim();
  if (p) return p.startsWith("/") ? p : `/${p}`;
  return ewayApiStyle() === "perione"
    ? "/ewaybillapi/v1.03/ewayapi/getewaybill"
    : "/ewayapi/GetEwayBill";
}

export function ewayAuthTtlMs(): number {
  const raw = process.env.EWAY_AUTH_TTL_MS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (ewayNicBaseUrl().toLowerCase().includes("staging.perione.in")) {
    return 3_600_000;
  }
  return 21_600_000;
}

export function ewayNicTimeoutMs(): number {
  const raw = process.env.EWAY_TIMEOUT_MS;
  const n = raw ? Number.parseInt(raw, 10) : 30_000;
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}

/** Base portal credentials present (Perione or encrypted NIC). */
export function isNicEwayConfigured(): boolean {
  return Boolean(
    ewayNicBaseUrl() && ewayNicClientId() && ewayNicClientSecret() && ewayNicGstin()
  );
}

/**
 * Perione lite getewaybill: email + GSP client credentials + base URL.
 * `EWAY_GSTIN` is optional for config but still sent in request headers when set (Perione gateway).
 */
export function isPerioneEwayConfigured(): boolean {
  return Boolean(
    ewayNicBaseUrl() &&
      ewayNicClientId() &&
      ewayNicClientSecret() &&
      ewayEmail() &&
      ewayApiStyle() === "perione"
  );
}

export function isEncryptedNicEwayConfigured(): boolean {
  return isNicEwayConfigured() && ewayApiStyle() === "nic";
}
