import { isValidVehicleReg, normalizeVehicleReg } from "@/lib/field-validators";
import { markMockVerification } from "../../core/verification-status";
import { IntegrationError } from "../../core/errors";
import { normalizeSurepassRc } from "../normalize";
import type { VehicleRcVerifyResult } from "../types";

export async function mockVerifyVehicleRc(
  registrationNumber: string
): Promise<VehicleRcVerifyResult> {
  const normalized = normalizeVehicleReg(registrationNumber);
  if (!isValidVehicleReg(normalized)) {
    throw new IntegrationError(
      "Please enter a valid vehicle registration number.",
      "INVALID_INPUT"
    );
  }
  if (normalized.endsWith("0000")) {
    throw new IntegrationError("Vehicle not found.", "NOT_FOUND", { provider: "mock" });
  }

  const raw = {
    rc_number: normalized,
    owner_name: "MOCK OWNER",
    maker_description: "TATA",
    maker_model: "LPT 1613",
    fuel_type: "DIESEL",
    vehicle_category: "Goods Carrier",
    registration_date: "2020-01-15",
    rc_status: "ACTIVE",
    fit_up_to: "2027-01-15",
    insurance_company: "Mock Insurance Co",
    insurance_policy_number: "POL123456",
    insurance_upto: "2027-06-01",
    pucc_number: "PUC987654",
    pucc_upto: "2027-03-01",
  };

  const data = normalizeSurepassRc(normalized, raw, "mock");
  return { valid: true, data: markMockVerification(data) };
}
