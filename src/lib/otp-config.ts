/** Centralized OTP security configuration (override via environment). */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const OTP_TTL_MS = intEnv("OTP_TTL_MS", 10 * 60 * 1000);

/** Maximum failed verification attempts before the OTP is locked. */
export const OTP_MAX_ATTEMPTS = intEnv("OTP_MAX_ATTEMPTS", 5);

/** Minimum seconds between OTP resend requests for the same target. */
export const OTP_RESEND_COOLDOWN_SEC = intEnv("OTP_RESEND_COOLDOWN_SEC", 60);

/** Maximum OTP sends per phone number within the send window. */
export const OTP_MAX_SENDS_PER_PHONE = intEnv("OTP_MAX_SENDS_PER_PHONE", 5);

/** Maximum OTP sends per driver/account within the send window. */
export const OTP_MAX_SENDS_PER_DRIVER = intEnv("OTP_MAX_SENDS_PER_DRIVER", 5);

/** Maximum OTP sends per IP within the send window. */
export const OTP_MAX_SENDS_PER_IP = intEnv("OTP_MAX_SENDS_PER_IP", 20);

/** Sliding/fixed window for OTP send limits (seconds). */
export const OTP_SEND_WINDOW_SEC = intEnv("OTP_SEND_WINDOW_SEC", 15 * 60);

export type OtpPurpose = "driver_login" | "driver_verify";

export const OTP_PURPOSES: OtpPurpose[] = ["driver_login", "driver_verify"];
