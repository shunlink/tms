import { z } from "zod";
import { normalizePhone, DEFAULT_COUNTRY_CODE } from "./phone";

/** Indian mobile: 10 digits, national number starts with 6–9. */
export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** Indian PAN: AAAAA9999A */
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Indian GSTIN (15 chars). */
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Indian bank IFSC (11 chars). */
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Indian pincode: 6 digits, does not start with 0. */
export const PINCODE_RE = /^[1-9][0-9]{5}$/;

/**
 * Indian vehicle registration — permissive pattern after normalization.
 * Examples: MH12AB1234, DL1CAF1234, KA01AB1234
 */
export const VEHICLE_REG_RE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;

export const OTP_LENGTH = 6;
export const OTP_RE = /^\d{6}$/;

export function normalizePan(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function normalizeGstin(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function normalizeIfsc(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function normalizePincode(value: string): string {
  return value.replace(/\s+/g, "");
}

export function normalizeVehicleReg(value: string): string {
  return value.replace(/[\s-]+/g, "").toUpperCase();
}

/** Extract national 10-digit part from canonical E.164 digits (e.g. 919820012345). */
export function indianNationalDigits(
  value: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE
): string | null {
  const canonical = normalizePhone(value, countryCode);
  if (!canonical) return null;
  if (canonical.startsWith(countryCode) && canonical.length === countryCode.length + 10) {
    return canonical.slice(countryCode.length);
  }
  if (canonical.length === 10) return canonical;
  return null;
}

export function isValidIndianMobile(value: string | null | undefined): boolean {
  const national = indianNationalDigits(value);
  return national != null && INDIAN_MOBILE_RE.test(national);
}

export function isValidPan(value: string | null | undefined): boolean {
  if (!value) return false;
  return PAN_RE.test(normalizePan(value));
}

export function isValidGstin(value: string | null | undefined): boolean {
  if (!value) return false;
  return GSTIN_RE.test(normalizeGstin(value));
}

export function isValidIfsc(value: string | null | undefined): boolean {
  if (!value) return false;
  return IFSC_RE.test(normalizeIfsc(value));
}

export function isValidPincode(value: string | null | undefined): boolean {
  if (!value) return false;
  return PINCODE_RE.test(normalizePincode(value));
}

export function isValidVehicleReg(value: string | null | undefined): boolean {
  if (!value) return false;
  return VEHICLE_REG_RE.test(normalizeVehicleReg(value));
}

export function isValidOtp(value: string | null | undefined): boolean {
  if (!value) return false;
  return OTP_RE.test(value.trim());
}

const EMAIL_MAX = 254;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(EMAIL_MAX, "Email is too long")
  .email("Please enter a valid email address")
  .transform((v) => v.toLowerCase());

export const optionalEmailSchema = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).trim().toLowerCase()),
  z
    .string()
    .max(EMAIL_MAX, "Email is too long")
    .email("Please enter a valid email address")
    .nullable()
    .optional()
);

export const indianMobileSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .refine((v) => isValidIndianMobile(v), {
    message: "Please enter a valid 10-digit Indian mobile number.",
  });

export const optionalIndianMobileSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : v))
  .refine((v) => v == null || isValidIndianMobile(v), {
    message: "Please enter a valid 10-digit Indian mobile number.",
  });

export const otpSchema = z
  .string()
  .trim()
  .regex(OTP_RE, `Please enter a valid ${OTP_LENGTH}-digit OTP.`);

export const panSchema = z
  .string()
  .trim()
  .min(1, "PAN is required")
  .transform(normalizePan)
  .refine((v) => PAN_RE.test(v), { message: "Please enter a valid PAN (e.g. ABCDE1234F)." });

export const optionalPanSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : normalizePan(v)))
  .refine((v) => v == null || PAN_RE.test(v), {
    message: "Please enter a valid PAN (e.g. ABCDE1234F).",
  });

export const gstinSchema = z
  .string()
  .trim()
  .min(1, "GSTIN is required")
  .transform(normalizeGstin)
  .refine((v) => GSTIN_RE.test(v), {
    message: "Please enter a valid 15-character GSTIN.",
  });

export const optionalGstinSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : normalizeGstin(v)))
  .refine((v) => v == null || GSTIN_RE.test(v), {
    message: "Please enter a valid 15-character GSTIN.",
  });

export const ifscSchema = z
  .string()
  .trim()
  .min(1, "IFSC is required")
  .transform(normalizeIfsc)
  .refine((v) => IFSC_RE.test(v), {
    message: "Please enter a valid 11-character IFSC code.",
  });

export const optionalIfscSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : normalizeIfsc(v)))
  .refine((v) => v == null || IFSC_RE.test(v), {
    message: "Please enter a valid 11-character IFSC code.",
  });

export const pincodeSchema = z
  .string()
  .trim()
  .min(1, "Pincode is required")
  .transform(normalizePincode)
  .refine((v) => PINCODE_RE.test(v), {
    message: "Please enter a valid 6-digit pincode.",
  });

export const optionalPincodeSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : normalizePincode(v)))
  .refine((v) => v == null || PINCODE_RE.test(v), {
    message: "Please enter a valid 6-digit pincode.",
  });

export const vehicleRegSchema = z
  .string()
  .trim()
  .min(1, "Vehicle number is required")
  .transform(normalizeVehicleReg)
  .refine((v) => VEHICLE_REG_RE.test(v), {
    message: "Please enter a valid vehicle registration number.",
  });
