// Phone number normalization — single source of truth for phone handling.
//
// The Meta WhatsApp Cloud API requires the recipient in E.164 format WITHOUT the
// leading "+" — country code + national number, digits only (e.g. "919820012345").
// We therefore store AND send every phone number in that canonical form.
//
// Kept pure (no imports, no I/O) so it is covered by unit tests.

export const DEFAULT_COUNTRY_CODE = "91"; // India

const MIN_DIGITS = 10;
const MAX_DIGITS = 15; // E.164 maximum

/**
 * Strict canonical E.164 digits (no "+"), or `null` when the input is not a
 * usable phone number. Use this before handing a number to a provider.
 *
 *   "+91 90210 77286" -> "919021077286"
 *   "09820012345"     -> "919820012345"
 *   "9820012345"      -> "919820012345"   (bare national number)
 *   "0091 9820012345" -> "919820012345"
 *   "+1 555 646 1110" -> "15556461110"    (already international)
 *   "982001234"       -> null             (too short)
 */
export function normalizePhone(
  value: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hadPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    // "00" is the international access prefix: 0091... -> 91...
    digits = digits.replace(/^0+/, "");
  } else if (!hadPlus) {
    // National trunk prefix: "09820012345" -> "9820012345"
    digits = digits.replace(/^0+/, "");
    // Bare national number -> assume the default country code.
    if (digits.length === MIN_DIGITS) digits = countryCode + digits;
  }

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return digits;
}

/**
 * Normalizes when possible, otherwise returns the trimmed original so an
 * operator-entered value is never silently discarded. Used by the validation
 * layer when persisting user input.
 */
export function normalizePhoneOrOriginal(
  value: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return normalizePhone(raw, countryCode) ?? raw;
}

/**
 * The WhatsApp recipient for a vendor: prefer the dedicated WhatsApp number,
 * fall back to the primary phone. Returns `null` when neither is usable, so the
 * caller can skip the vendor instead of calling the API with junk.
 */
export function resolveWhatsAppRecipient(vendor: {
  whatsapp?: string | null;
  phone?: string | null;
}): string | null {
  return normalizePhone(vendor.whatsapp) ?? normalizePhone(vendor.phone);
}

/** Formats canonical digits back for display, e.g. "919820012345" -> "+919820012345". */
export function formatPhoneE164(normalized: string | null | undefined): string | null {
  if (!normalized) return null;
  const digits = String(normalized).replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

/**
 * Compares two numbers ignoring formatting ("+91 90210 77286" == "9021077286").
 * Falls back to a trimmed string comparison when either side is not a valid
 * phone number, so non-phone identifiers still compare predictably.
 */
export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE
): boolean {
  const na = normalizePhone(a, countryCode);
  const nb = normalizePhone(b, countryCode);
  if (na && nb) return na === nb;
  const sa = (a ?? "").trim();
  const sb = (b ?? "").trim();
  return sa !== "" && sa === sb;
}
