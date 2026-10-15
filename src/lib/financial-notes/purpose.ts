import type { TripChargeType } from "../services/trip-charge.service";
import type { BusinessPurpose, NoteType, PayableEffect } from "./types";

export function inferVendorNoteFromTripCharge(chargeType: TripChargeType): {
  noteType: NoteType;
  businessPurpose: BusinessPurpose;
  payableEffect: PayableEffect;
} {
  if (chargeType === "DEDUCTION") {
    return {
      noteType: "CREDIT_NOTE",
      businessPurpose: "VENDOR_FREIGHT_REDUCTION",
      payableEffect: "SUBLEDGER_ALREADY_REFLECTED",
    };
  }
  return {
    noteType: "DEBIT_NOTE",
    businessPurpose: "VENDOR_FREIGHT_INCREASE",
    payableEffect: "SUBLEDGER_ALREADY_REFLECTED",
  };
}

export function validatePurposeMatchesParties(
  businessPurpose: string,
  counterpartyType: string
): void {
  const vendorPurposes = ["VENDOR_FREIGHT_INCREASE", "VENDOR_FREIGHT_REDUCTION", "OTHER"];
  const clientPurposes = ["CLIENT_BILLING_INCREASE", "CLIENT_BILLING_REDUCTION"];
  if (counterpartyType === "VENDOR" && clientPurposes.includes(businessPurpose)) {
    throw new Error("Business purpose is for client notes, not vendor");
  }
  if (counterpartyType === "CLIENT" && vendorPurposes.includes(businessPurpose)) {
    throw new Error("Business purpose is for vendor notes, not client");
  }
}
