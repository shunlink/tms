import { computeVehicleCompliance } from "./compliance";
import type { NormalizedVehicleRc } from "./types";

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function normalizeSurepassRc(
  registrationNumber: string,
  raw: Record<string, unknown>,
  provider = "surepass"
): NormalizedVehicleRc {
  const makeModel = pickString(raw, "maker_model", "make_model", "model");
  let make = pickString(raw, "maker_description", "manufacturer", "make");
  let model = pickString(raw, "maker_model", "model");
  if (makeModel && !model) {
    const parts = makeModel.split(/\s+/);
    make = make ?? parts[0] ?? null;
    model = parts.slice(1).join(" ") || makeModel;
  }

  const rcStatus = pickString(raw, "rc_status", "status");
  const rcExpiry = pickString(raw, "fit_up_to", "fitness_upto", "fitness_validity", "rc_expiry_date");
  const insuranceExpiry = pickString(raw, "insurance_upto", "insurance_validity");
  const pucExpiry = pickString(raw, "pucc_upto", "pollution_validity", "puc_upto");
  const fitnessExpiry = rcExpiry;

  const compliance = computeVehicleCompliance({
    rcExpiry,
    rcStatus,
    insuranceExpiry,
    pucExpiry,
    fitnessExpiry,
  });

  const verificationStatus =
    rcStatus?.toLowerCase().includes("active") || compliance.overall === "VERIFIED"
      ? "VERIFIED"
      : compliance.overall === "NON_COMPLIANT"
        ? "FAILED"
        : "PENDING";

  return {
    registrationNumber: pickString(raw, "rc_number", "registration_number", "vehicle_number") ?? registrationNumber,
    ownerName: pickString(raw, "owner_name"),
    make,
    model,
    vehicleClass: pickString(raw, "vehicle_category", "vehicle_class", "class"),
    fuelType: pickString(raw, "fuel_type"),
    registrationDate: pickString(raw, "registration_date", "reg_date"),
    rcStatus,
    rcExpiry,
    fitnessExpiry,
    insuranceCompany: pickString(raw, "insurance_company", "insurance_provider"),
    insuranceNumber: pickString(raw, "insurance_policy_number", "insurance_number"),
    insuranceExpiry,
    pucNumber: pickString(raw, "pucc_number", "puc_number"),
    pucExpiry,
    permitType: pickString(raw, "permit_type"),
    permitNumber: pickString(raw, "permit_number"),
    permitExpiry: pickString(raw, "permit_valid_upto", "permit_expiry"),
    financer: pickString(raw, "financer", "financer_details"),
    provider,
    verifiedAt: new Date().toISOString(),
    verificationStatus,
    compliance,
  };
}
