/**
 * OTP delivery abstraction — verification logic is independent of channel.
 * WhatsApp is the primary channel; SMS is used as fallback when configured.
 */

import { deliverNow } from "./notify";
import { buildDriverOtpMessage } from "./whatsapp-message";

export type OtpDeliveryChannel = "whatsapp" | "sms";

export type OtpDeliveryInput = {
  phone: string;
  otp: string;
  /** FEATURE_PHONE drivers may prefer SMS when available. */
  deviceType?: "SMARTPHONE" | "FEATURE_PHONE";
  /** Force a specific channel (e.g. explicit resend via SMS). */
  preferredChannel?: OtpDeliveryChannel;
};

export type OtpDeliveryResult = {
  channel: OtpDeliveryChannel;
  ok: boolean;
  detail?: string;
};

function smsConfigured(): boolean {
  return Boolean(
    process.env.SMS_PROVIDER &&
      (process.env.SMS_API_KEY || process.env.SMS_AUTH_TOKEN)
  );
}

/** Send OTP via SMS when a provider is configured. No-op stub otherwise. */
async function sendSmsOtp(phone: string, otp: string): Promise<OtpDeliveryResult> {
  const provider = process.env.SMS_PROVIDER;
  if (!provider || !smsConfigured()) {
    return {
      channel: "sms",
      ok: false,
      detail: "SMS provider is not configured",
    };
  }

  // Integration point — wire provider SDK/API here when credentials are approved.
  console.warn(
    `[otp-delivery] SMS provider "${provider}" is configured but not yet integrated. OTP not sent via SMS.`
  );
  return {
    channel: "sms",
    ok: false,
    detail: "SMS delivery is not yet available",
  };
}

async function sendWhatsAppOtp(phone: string, otp: string): Promise<OtpDeliveryResult> {
  const result = await deliverNow({
    channel: "WHATSAPP",
    to: phone,
    subject: "Driver verification code",
    body: buildDriverOtpMessage(otp),
  });
  return {
    channel: "whatsapp",
    ok: result.ok,
    detail: result.detail,
  };
}

/**
 * Deliver an OTP. Tries WhatsApp first; falls back to SMS for feature phones
 * when WhatsApp fails or SMS is explicitly preferred.
 */
export async function deliverOtp(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const { phone, otp, deviceType, preferredChannel } = input;

  if (preferredChannel === "sms") {
    const sms = await sendSmsOtp(phone, otp);
    if (sms.ok) return sms;
    const wa = await sendWhatsAppOtp(phone, otp);
    return wa.ok ? wa : sms;
  }

  const wa = await sendWhatsAppOtp(phone, otp);
  if (wa.ok) return wa;

  if (deviceType === "FEATURE_PHONE") {
    const sms = await sendSmsOtp(phone, otp);
    if (sms.ok) return sms;
  }

  return wa;
}

export { smsConfigured };
