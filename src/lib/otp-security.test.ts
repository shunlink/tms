import { describe, it, expect, beforeEach } from "vitest";
import { hashOtp, verifyOtpHash } from "./otp-hash";
import { recordFailedOtpAttempt, clearOtpSecurityState, isOtpLocked } from "./otp-security";
import { OTP_MAX_ATTEMPTS } from "./otp-config";

describe("otp-security", () => {
  const driverId = `test-driver-${Math.random()}`;

  beforeEach(async () => {
    await clearOtpSecurityState(driverId);
  });

  it("hashes and verifies OTP without storing plaintext", () => {
    const code = "482910";
    const hashed = hashOtp(code);
    expect(hashed).not.toBe(code);
    expect(verifyOtpHash(code, hashed)).toBe(true);
    expect(verifyOtpHash("000000", hashed)).toBe(false);
  });

  it("tracks failed attempts and locks after max", async () => {
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      const r = await recordFailedOtpAttempt(driverId);
      expect(r.locked).toBe(false);
      expect(r.remaining).toBe(OTP_MAX_ATTEMPTS - i);
    }
    const final = await recordFailedOtpAttempt(driverId);
    expect(final.locked).toBe(true);
    expect(await isOtpLocked(driverId)).toBe(true);
  });

  it("clears lock state", async () => {
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await recordFailedOtpAttempt(driverId);
    }
    await clearOtpSecurityState(driverId);
    expect(await isOtpLocked(driverId)).toBe(false);
  });
});
