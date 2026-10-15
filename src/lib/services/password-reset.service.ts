/**
 * Forgot-password (email OTP) flow.
 *
 * Reuses the shared OTP primitives (generation, hashing, expiry, limits) and the
 * email outbox, so password resets are auditable like every other notification.
 *
 * Security notes:
 * - The request endpoint never reveals whether an email address has an account.
 * - Only a single active code is kept per user, stored as an HMAC hash.
 * - Failed verifications are counted and lock the code after OTP_MAX_ATTEMPTS.
 */
import bcrypt from "bcryptjs";

import { AppError } from "../api-errors";
import { cacheDel, cacheGet, cacheSet } from "../cache";
import { deliverEmail } from "../notify";
import { generateOtp, otpExpiresAt } from "../otp";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_DRIVER,
  OTP_MAX_SENDS_PER_IP,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_SEND_WINDOW_SEC,
  OTP_TTL_MS,
} from "../otp-config";
import { hashOtp, verifyOtpHash } from "../otp-hash";
import { prisma } from "../prisma";
import { rateLimitAsync } from "../ratelimit-async";

const BRAND = "ShunLink";

function attemptKey(userId: string) {
  return `pwdreset:attempts:${userId}`;
}

function lockKey(userId: string) {
  return `pwdreset:locked:${userId}`;
}

function ttlSeconds() {
  return Math.max(1, Math.ceil(OTP_TTL_MS / 1000));
}

function expiryMinutes() {
  return Math.max(1, Math.round(OTP_TTL_MS / 60000));
}

/** Plain-text body of the reset-code email (also used for the outbox record). */
export function passwordResetEmailBody(otp: string) {
  return [
    `Your ${BRAND} password reset code is ${otp}.`,
    "",
    `This code expires in ${expiryMinutes()} minutes.`,
    "If you did not request a password reset you can safely ignore this email; your password will not change.",
  ].join("\n");
}

function passwordResetEmailHtml(otp: string) {
  return `<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:700">${BRAND}</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#1B2A4A">Password reset code</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">Use the code below to reset your password. It expires in ${expiryMinutes()} minutes.</p>
    <p style="margin:0 0 20px;font-size:32px;letter-spacing:.35em;font-weight:700;color:#1B2A4A;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center">${otp}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">If you did not request a password reset you can safely ignore this email — your password will not change.</p>
  </div>
</div>`;
}

/**
 * Issue (or re-issue) a password-reset OTP by email.
 *
 * Always resolves successfully for unknown/inactive addresses so the caller
 * cannot be used to probe which emails are registered.
 */
export async function requestPasswordResetOtp(emailRaw: string, ip?: string | null) {
  const email = emailRaw.trim().toLowerCase();

  const cooldown = await rateLimitAsync(
    `pwdreset:cooldown:${email}`,
    1,
    OTP_RESEND_COOLDOWN_SEC * 1000
  );
  if (!cooldown.ok) {
    throw new AppError(
      `Please wait ${cooldown.retryAfter} seconds before requesting another OTP.`,
      { status: 429, code: "OTP_RESEND_COOLDOWN", retryAfter: cooldown.retryAfter }
    );
  }

  const emailLimit = await rateLimitAsync(
    `pwdreset:send:email:${email}`,
    OTP_MAX_SENDS_PER_DRIVER,
    OTP_SEND_WINDOW_SEC * 1000
  );
  if (!emailLimit.ok) {
    throw new AppError("Too many OTP requests. Please try again later.", {
      status: 429,
      code: "OTP_SEND_LIMIT",
      retryAfter: emailLimit.retryAfter,
    });
  }

  if (ip) {
    const ipLimit = await rateLimitAsync(
      `pwdreset:send:ip:${ip}`,
      OTP_MAX_SENDS_PER_IP,
      OTP_SEND_WINDOW_SEC * 1000
    );
    if (!ipLimit.ok) {
      throw new AppError("Too many OTP requests from this network. Please try again later.", {
        status: 429,
        code: "OTP_SEND_LIMIT",
        retryAfter: ipLimit.retryAfter,
      });
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return { sent: true };

  const code = generateOtp();
  await prisma.user.update({
    where: { id: user.id },
    data: { resetOtpHash: hashOtp(code), resetOtpExpiresAt: otpExpiresAt() },
  });
  await Promise.all([cacheDel(attemptKey(user.id)), cacheDel(lockKey(user.id))]);

  const result = await deliverEmail({
    to: email,
    subject: `Your ${BRAND} password reset code`,
    body: passwordResetEmailBody(code),
    html: passwordResetEmailHtml(code),
    entityType: "USER",
    entityId: user.id,
  });
  if (!result.ok) {
    console.error(
      `[password-reset] Failed to deliver reset code for user ${user.id}: ${result.detail ?? "unknown error"}`
    );
  }

  return { sent: true };
}

/**
 * Verify the emailed OTP and set a new password. Consumes the code on success.
 */
export async function resetPasswordWithOtp(emailRaw: string, otpRaw: string, newPassword: string) {
  const email = emailRaw.trim().toLowerCase();
  const otp = otpRaw.trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new AppError("Incorrect OTP. Please try again.", { status: 400, code: "OTP_INVALID" });
  }

  if (!user.resetOtpHash || !user.resetOtpExpiresAt) {
    throw new AppError("No active reset code. Please request a new OTP.", {
      status: 400,
      code: "OTP_EXPIRED",
    });
  }

  if (await cacheGet(lockKey(user.id))) {
    throw new AppError("Too many incorrect attempts. Please request a new OTP.", {
      status: 400,
      code: "OTP_LOCKED",
    });
  }

  if (user.resetOtpExpiresAt.getTime() <= Date.now()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtpHash: null, resetOtpExpiresAt: null },
    });
    throw new AppError("OTP expired. Please request a new OTP.", { status: 400, code: "OTP_EXPIRED" });
  }

  if (!verifyOtpHash(otp, user.resetOtpHash)) {
    const current = Number.parseInt((await cacheGet(attemptKey(user.id))) ?? "0", 10) || 0;
    const attempts = current + 1;
    await cacheSet(attemptKey(user.id), String(attempts), ttlSeconds());

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await cacheSet(lockKey(user.id), "1", ttlSeconds());
      throw new AppError("Too many incorrect attempts. Please request a new OTP.", {
        status: 400,
        code: "OTP_TOO_MANY_ATTEMPTS",
      });
    }

    const left = OTP_MAX_ATTEMPTS - attempts;
    throw new AppError(`Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`, {
      status: 400,
      code: "OTP_INVALID",
    });
  }

  const password = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password, resetOtpHash: null, resetOtpExpiresAt: null },
  });
  await Promise.all([cacheDel(attemptKey(user.id)), cacheDel(lockKey(user.id))]);

  return { reset: true };
}
