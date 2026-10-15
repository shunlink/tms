/** Active portal-access session lifetime (server-enforced; also stored on DB row). */
export const PORTAL_ACCESS_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/** Master OTP verification attempts per Superadmin per window. */
export const MASTER_OTP_VERIFY_LIMIT = 8;
export const MASTER_OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;

/** Lockout after failed Master OTP attempts (per actor). */
export const MASTER_OTP_LOCKOUT_ATTEMPTS = 12;
export const MASTER_OTP_LOCKOUT_WINDOW_MS = 60 * 60 * 1000;

/** High-entropy access code length (base64url). */
export const MASTER_OTP_BYTE_LENGTH = 24;

export const PORTAL_ACCESS_VERIFY_DENIED =
  "Unable to verify portal access. Check the employee identifier and Master OTP.";
