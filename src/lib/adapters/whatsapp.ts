// WhatsApp adapter — business logic calls these instead of Meta APIs directly.
// Inbound webhook parsing lives in /api/webhooks/whatsapp.
//
// Only messages that are actually wired up live here. Recipient normalization
// happens inside `deliverNow`/`sendMessage`, so callers may pass a raw number.

import { deliverNow } from "../notify";
import {
  buildDriverOtpMessage,
  buildQuoteAckMessage,
  buildVendorAllocatedMessage,
} from "../whatsapp-message";

/** Confirmation sent to a vendor right after their WhatsApp quote is recorded. */
export async function sendQuoteAcknowledgement(
  phone: string,
  input: { indentNumber: string; quotedRate: number; vendorName?: string | null; entityId?: string | null }
) {
  return deliverNow({
    channel: "WHATSAPP",
    to: phone,
    subject: `Quote received for ${input.indentNumber}`,
    body: buildQuoteAckMessage({
      indentNumber: input.indentNumber,
      quotedRate: input.quotedRate,
      vendorName: input.vendorName ?? null,
    }),
    entityType: "INDENT",
    entityId: input.entityId ?? null,
  });
}

/** Sent when ops allocates an indent to a specific vendor. */
export async function sendVendorAllocation(
  phone: string,
  input: {
    indentNumber: string;
    vendorName?: string | null;
    fromCity?: string | null;
    toCity?: string | null;
    vehicleType?: string | null;
    quotedRate?: number | null;
    advanceAmount?: number | null;
    entityId?: string | null;
  }
) {
  return deliverNow({
    channel: "WHATSAPP",
    to: phone,
    subject: `Indent allocated: ${input.indentNumber}`,
    body: buildVendorAllocatedMessage(input),
    entityType: "INDENT",
    entityId: input.entityId ?? null,
  });
}

/** Driver login / trip verification OTP. */
export async function sendDriverOtp(phone: string, otp: string) {
  return deliverNow({
    channel: "WHATSAPP",
    to: phone,
    subject: "Driver verification code",
    body: buildDriverOtpMessage(otp),
  });
}

