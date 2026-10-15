import { prisma } from "../prisma";
import { generateOtp, otpExpiresAt, normalizeDl } from "../otp";
import { hashOtp } from "../otp-hash";
import {
  verifyOtpHash,
  isOtpLocked,
  recordFailedOtpAttempt,
  clearOtpSecurityState,
} from "../otp-security";
import {
  OTP_MAX_SENDS_PER_DRIVER,
  OTP_MAX_SENDS_PER_IP,
  OTP_MAX_SENDS_PER_PHONE,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_SEND_WINDOW_SEC,
  type OtpPurpose,
} from "../otp-config";
import { rateLimitAsync } from "../ratelimit-async";
import { deliverOtp } from "../otp-delivery";
import { phonesMatch } from "../phone";
import { AppError } from "../api-errors";

export type IssueOtpInput = {
  driverId: string;
  phone: string;
  purpose: OtpPurpose;
  deviceType?: "SMARTPHONE" | "FEATURE_PHONE";
  ip?: string | null;
  preferredChannel?: "whatsapp" | "sms";
};

export type VerifyOtpInput = {
  driverId: string;
  otp: string;
  purpose: OtpPurpose;
};

function cooldownKey(phone: string, purpose: OtpPurpose) {
  return `otp:cooldown:${purpose}:${phone}`;
}

function sendKey(kind: "phone" | "driver" | "ip", value: string, purpose: OtpPurpose) {
  return `otp:send:${purpose}:${kind}:${value}`;
}

async function enforceSendRateLimits(input: IssueOtpInput) {
  const windowMs = OTP_SEND_WINDOW_SEC * 1000;

  const cooldown = await rateLimitAsync(
    cooldownKey(input.phone, input.purpose),
    1,
    OTP_RESEND_COOLDOWN_SEC * 1000
  );
  if (!cooldown.ok) {
    throw new AppError(
      `Please wait ${cooldown.retryAfter} seconds before requesting another OTP.`,
      { status: 429, code: "OTP_RESEND_COOLDOWN", retryAfter: cooldown.retryAfter }
    );
  }

  const phoneRl = await rateLimitAsync(
    sendKey("phone", input.phone, input.purpose),
    OTP_MAX_SENDS_PER_PHONE,
    windowMs
  );
  if (!phoneRl.ok) {
    throw new AppError("Too many OTP requests for this number. Please try again later.", {
      status: 429,
      code: "OTP_SEND_LIMIT",
      retryAfter: phoneRl.retryAfter,
    });
  }

  const driverRl = await rateLimitAsync(
    sendKey("driver", input.driverId, input.purpose),
    OTP_MAX_SENDS_PER_DRIVER,
    windowMs
  );
  if (!driverRl.ok) {
    throw new AppError("Too many OTP requests. Please try again later.", {
      status: 429,
      code: "OTP_SEND_LIMIT",
      retryAfter: driverRl.retryAfter,
    });
  }

  if (input.ip) {
    const ipRl = await rateLimitAsync(
      sendKey("ip", input.ip, input.purpose),
      OTP_MAX_SENDS_PER_IP,
      windowMs
    );
    if (!ipRl.ok) {
      throw new AppError("Too many OTP requests from this network. Please try again later.", {
        status: 429,
        code: "OTP_SEND_LIMIT",
        retryAfter: ipRl.retryAfter,
      });
    }
  }
}

/** Generate, store (hashed), and deliver an OTP. Invalidates any previous OTP for this driver. */
export async function issueDriverOtp(input: IssueOtpInput) {
  await enforceSendRateLimits(input);

  const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
  if (!driver) throw new AppError("Driver not found", { status: 404, code: "NOT_FOUND" });
  if (!driver.phone) throw new AppError("Driver has no registered phone", { status: 400 });

  const code = generateOtp();
  const expiresAt = otpExpiresAt();
  const hashed = hashOtp(code);

  await prisma.driver.update({
    where: { id: input.driverId },
    data: {
      otpCode: hashed,
      otpExpiresAt: expiresAt,
      otpPurpose: input.purpose,
    },
  });

  await clearOtpSecurityState(input.driverId);

  const delivery = await deliverOtp({
    phone: input.phone,
    otp: code,
    deviceType: input.deviceType ?? (driver.deviceType as "SMARTPHONE" | "FEATURE_PHONE"),
    preferredChannel: input.preferredChannel,
  });

  if (!delivery.ok) {
    throw new AppError("Unable to send OTP right now. Please try again.", {
      status: 503,
      code: "SERVER_ERROR",
    });
  }

  return {
    sent: true,
    expiresAt,
    channel: delivery.channel,
  };
}

export async function verifyDriverOtpSecure(input: VerifyOtpInput) {
  const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
  if (!driver) throw new AppError("Driver not found", { status: 404, code: "NOT_FOUND" });

  if (!driver.otpCode || !driver.otpExpiresAt) {
    throw new AppError("No active OTP. Please request a new OTP.", {
      status: 400,
      code: "OTP_EXPIRED",
    });
  }

  if (driver.otpPurpose && driver.otpPurpose !== input.purpose) {
    throw new AppError("This OTP cannot be used for this action. Please request a new OTP.", {
      status: 400,
      code: "OTP_PURPOSE_MISMATCH",
    });
  }

  if (await isOtpLocked(input.driverId)) {
    throw new AppError("Too many incorrect attempts. Please request a new OTP.", {
      status: 400,
      code: "OTP_LOCKED",
    });
  }

  if (driver.otpExpiresAt.getTime() <= Date.now()) {
    throw new AppError("OTP expired. Please request a new OTP.", {
      status: 400,
      code: "OTP_EXPIRED",
    });
  }

  if (!verifyOtpHash(input.otp, driver.otpCode)) {
    const attempt = await recordFailedOtpAttempt(input.driverId);
    if (attempt.locked) {
      throw new AppError("Too many incorrect attempts. Please request a new OTP.", {
        status: 400,
        code: "OTP_TOO_MANY_ATTEMPTS",
      });
    }
    throw new AppError(
      `Incorrect OTP. ${attempt.remaining} attempt${attempt.remaining === 1 ? "" : "s"} remaining.`,
      { status: 400, code: "OTP_INVALID" }
    );
  }

  await prisma.driver.update({
    where: { id: input.driverId },
    data: {
      otpVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      otpPurpose: null,
      accountStatus: "ACTIVE",
    },
  });

  await clearOtpSecurityState(input.driverId);

  return { verified: true };
}

/** Public driver login OTP request (DL + registered phone). */
export async function requestDriverLoginOtp(dlNumber: string, phone: string, ip?: string | null) {
  const dl = normalizeDl(dlNumber);
  const driver = await prisma.driver.findUnique({ where: { dlNumber: dl } });
  if (!driver) throw new AppError("Driver not found", { status: 404, code: "NOT_FOUND" });
  if (!phonesMatch(driver.phone, phone)) {
    throw new AppError("Phone does not match the registered number", {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  const result = await issueDriverOtp({
    driverId: driver.id,
    phone: driver.phone,
    purpose: "driver_login",
    deviceType: driver.deviceType as "SMARTPHONE" | "FEATURE_PHONE",
    ip,
  });

  return { driverId: driver.id, ...result };
}
