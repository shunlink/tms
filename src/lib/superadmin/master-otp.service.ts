import { randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { hashOtp, verifyOtpHash } from "../otp-hash";
import { rateLimit } from "../ratelimit";
import { logAudit } from "../audit";
import type { SessionUser } from "../auth";
import {
  MASTER_OTP_BYTE_LENGTH,
  MASTER_OTP_LOCKOUT_ATTEMPTS,
  MASTER_OTP_LOCKOUT_WINDOW_MS,
  MASTER_OTP_VERIFY_LIMIT,
  MASTER_OTP_VERIFY_WINDOW_MS,
} from "./portal-access-config";

const CONFIG_ID = "default";

type FailedAttemptRow = { count: number; resetAt: number };
const failedAttempts = new Map<string, FailedAttemptRow>();

function recordMasterOtpFailure(actorUserId: string) {
  const now = Date.now();
  const row = failedAttempts.get(actorUserId);
  if (!row || row.resetAt < now) {
    failedAttempts.set(actorUserId, { count: 1, resetAt: now + MASTER_OTP_LOCKOUT_WINDOW_MS });
    return { locked: false };
  }
  row.count += 1;
  return { locked: row.count >= MASTER_OTP_LOCKOUT_ATTEMPTS };
}

function isMasterOtpLocked(actorUserId: string): boolean {
  const row = failedAttempts.get(actorUserId);
  if (!row) return false;
  if (row.resetAt < Date.now()) {
    failedAttempts.delete(actorUserId);
    return false;
  }
  return row.count >= MASTER_OTP_LOCKOUT_ATTEMPTS;
}

export function clearMasterOtpFailureState(actorUserId: string) {
  failedAttempts.delete(actorUserId);
}

/** Generate a new high-entropy Master OTP (plaintext returned once to the caller). */
export function generateMasterOtpPlaintext(): string {
  return randomBytes(MASTER_OTP_BYTE_LENGTH).toString("base64url");
}

export async function getMasterOtpStatus() {
  const row = await prisma.masterOtpConfig.findUnique({ where: { id: CONFIG_ID } });
  return {
    configured: !!row,
    lastGeneratedAt: row?.generatedAt?.toISOString() ?? null,
  };
}

async function verifySuperadminPassword(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, role: true, isActive: true },
  });
  if (!user || !user.isActive || user.role !== "SUPER_ADMIN") return false;
  return bcrypt.compare(password, user.password);
}

export async function regenerateMasterOtp(actor: SessionUser & { id: string }, password: string) {
  if (!(await verifySuperadminPassword(actor.id, password))) {
    return { ok: false as const, error: "Invalid password" };
  }

  const plaintext = generateMasterOtpPlaintext();
  const otpHash = hashOtp(plaintext);

  await prisma.$transaction(async (tx) => {
    await tx.masterOtpConfig.upsert({
      where: { id: CONFIG_ID },
      create: {
        id: CONFIG_ID,
        otpHash,
        generatedByUserId: actor.id,
      },
      update: {
        otpHash,
        generatedAt: new Date(),
        generatedByUserId: actor.id,
      },
    });
  });

  await logAudit({
    user: actor,
    action: "MASTER_OTP_REGENERATED",
    entity: "MasterOtpConfig",
    entityId: CONFIG_ID,
    meta: { actorId: actor.id },
  });

  return { ok: true as const, plaintext, generatedAt: new Date().toISOString() };
}

export async function verifyMasterOtpForActor(actorUserId: string, otp: string): Promise<boolean> {
  if (isMasterOtpLocked(actorUserId)) return false;

  const rl = rateLimit(`master-otp-verify:${actorUserId}`, MASTER_OTP_VERIFY_LIMIT, MASTER_OTP_VERIFY_WINDOW_MS);
  if (!rl.ok) return false;

  const config = await prisma.masterOtpConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!config?.otpHash) {
    recordMasterOtpFailure(actorUserId);
    return false;
  }

  const valid = verifyOtpHash(otp.trim(), config.otpHash);
  if (!valid) {
    recordMasterOtpFailure(actorUserId);
    return false;
  }

  clearMasterOtpFailureState(actorUserId);
  return true;
}

/** Test helper — timing-safe string compare for OTP hashes. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
