import "server-only";

import { cacheDel, cacheGet, cacheSet } from "./cache";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "./otp-config";

export { hashOtp, verifyOtpHash } from "./otp-hash";

const attemptKey = (driverId: string) => `otp:attempts:${driverId}`;
const lockKey = (driverId: string) => `otp:locked:${driverId}`;

export async function getOtpAttemptCount(driverId: string): Promise<number> {
  const raw = await cacheGet(attemptKey(driverId));
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function isOtpLocked(driverId: string): Promise<boolean> {
  return Boolean(await cacheGet(lockKey(driverId)));
}

export async function recordFailedOtpAttempt(driverId: string): Promise<{
  attempts: number;
  locked: boolean;
  remaining: number;
}> {
  const ttlSec = Math.ceil(OTP_TTL_MS / 1000);
  const current = await getOtpAttemptCount(driverId);
  const attempts = current + 1;
  await cacheSet(attemptKey(driverId), String(attempts), ttlSec);

  if (attempts >= OTP_MAX_ATTEMPTS) {
    await cacheSet(lockKey(driverId), "1", ttlSec);
    return { attempts, locked: true, remaining: 0 };
  }

  return { attempts, locked: false, remaining: OTP_MAX_ATTEMPTS - attempts };
}

export async function clearOtpSecurityState(driverId: string): Promise<void> {
  await cacheDel(attemptKey(driverId));
  await cacheDel(lockKey(driverId));
}
