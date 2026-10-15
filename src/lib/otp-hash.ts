import { createHmac, timingSafeEqual } from "crypto";

function otpSecret(): string {
  const secret = process.env.OTP_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("OTP_SECRET or NEXTAUTH_SECRET must be set in production");
    }
    return "dev-otp-secret-change-me";
  }
  return secret;
}

/** Hash an OTP for secure storage. Never log the plaintext code. */
export function hashOtp(code: string): string {
  return createHmac("sha256", otpSecret()).update(code).digest("hex");
}

export function verifyOtpHash(code: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  try {
    const computed = hashOtp(code);
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(storedHash, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
