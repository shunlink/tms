import { markMockVerification } from "../../core/verification-status";
import { IntegrationError } from "../../core/errors";
import { normalizeSurepassDl } from "../normalize";
import type { DlVerifyResult } from "../types";

export async function mockVerifyDrivingLicence(
  dlNumber: string,
  dateOfBirth?: string | null
): Promise<DlVerifyResult> {
  const normalized = dlNumber.replace(/\s+/g, "").toUpperCase();
  if (normalized.length < 8) {
    throw new IntegrationError("Please enter a valid driving licence number.", "INVALID_INPUT");
  }
  if (!dateOfBirth?.trim()) {
    throw new IntegrationError("Date of birth is required for driving licence verification.", "INVALID_INPUT");
  }
  if (normalized.endsWith("INVALID")) {
    throw new IntegrationError("Driving licence not found.", "NOT_FOUND", { provider: "mock" });
  }

  const raw = {
    dl_number: normalized,
    name: "MOCK DRIVER",
    status: "Active",
    issue_date: "2015-03-01",
    valid_upto: "2035-03-01",
    dob: dateOfBirth,
    cov_details: [{ cov: "LMV" }, { cov: "HGV" }],
    state: "Maharashtra",
  };

  const data = normalizeSurepassDl(normalized, raw, "mock");
  return { valid: true, data: markMockVerification(data) };
}
