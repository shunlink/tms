import { isValidGstin, normalizeGstin } from "@/lib/field-validators";
import { markMockVerification } from "../../core/verification-status";
import { IntegrationError } from "../../core/errors";
import { normalizeSurepassGst } from "../normalize";
import type { GstVerifyResult } from "../types";

export async function mockVerifyGstin(gstin: string): Promise<GstVerifyResult> {
  const normalized = normalizeGstin(gstin);
  if (!isValidGstin(normalized)) {
    throw new IntegrationError("Please enter a valid 15-character GSTIN.", "INVALID_INPUT");
  }
  if (normalized.endsWith("Z0")) {
    throw new IntegrationError("GSTIN not found with the verification provider.", "NOT_FOUND", {
      provider: "mock",
    });
  }

  const raw = {
    gstin: normalized,
    legal_name: "MOCK LOGISTICS PVT LTD",
    business_name: "Mock Logistics",
    gstin_status: "Active",
    date_of_registration: "2018-04-01",
    constitution_of_business: "Private Limited Company",
    taxpayer_type: "Regular",
    pan_number: normalized.slice(2, 12),
    state_jurisdiction: "Maharashtra",
    center_jurisdiction: "RANGE-I",
    address: "123 Industrial Area, Pune 411001",
    address_details: {
      principal_place_of_business: {
        address: "123 Industrial Area",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
      },
    },
    nature_bus_activities: ["Transport of goods by road"],
  };

  const data = normalizeSurepassGst(normalized, raw, "mock");
  return { valid: true, data: markMockVerification(data) };
}
