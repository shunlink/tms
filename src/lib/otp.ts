import { randomInt } from "crypto";
import { OTP_TTL_MS } from "./otp-config";
import { verifyOtpHash } from "./otp-hash";

export { OTP_TTL_MS };

/** Canonical driver identity — DL number normalized (uppercase, no spaces). */
export function normalizeDl(dl: string) {
  return dl.replace(/\s+/g, "").toUpperCase();
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function otpExpiresAt(now = Date.now()) {
  return new Date(now + OTP_TTL_MS);
}

/**
 * Verify OTP against stored hash and expiry.
 * Supports legacy plaintext codes during migration (6-digit numeric only).
 */
export function isOtpValid(
  storedCode: string | null | undefined,
  storedExpiresAt: Date | null | undefined,
  input: string,
  now: number = Date.now()
) {
  if (!storedCode || !storedExpiresAt || storedExpiresAt.getTime() <= now) {
    return false;
  }

  const trimmed = input.trim();
  if (/^\d{6}$/.test(storedCode)) {
    return storedCode === trimmed;
  }

  return verifyOtpHash(trimmed, storedCode);
}
