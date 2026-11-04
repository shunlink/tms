import { timingSafeEqual } from "crypto";

function decodeBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return { username: decoded, password: "" };
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyJuspayWebhookBasicAuth(
  headers: Headers,
  credentials: { username: string; password: string } | null
): boolean {
  if (!credentials) return false;
  const parsed = decodeBasicAuth(headers.get("authorization"));
  if (!parsed) return false;
  return safeEqual(parsed.username, credentials.username) && safeEqual(parsed.password, credentials.password);
}
