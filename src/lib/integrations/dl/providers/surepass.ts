import "server-only";

import { IntegrationError } from "../../core/errors";
import { surepassEndpoints } from "../../core/config";
import { surepassPost } from "../../core/surepass-client";
import { normalizeSurepassDl } from "../normalize";
import type { DlVerifyResult } from "../types";

function normalizeDlInput(dlNumber: string): string {
  return dlNumber.replace(/\s+/g, "").toUpperCase();
}

export async function surepassVerifyDrivingLicence(
  dlNumber: string,
  dateOfBirth?: string | null
): Promise<DlVerifyResult> {
  const normalized = normalizeDlInput(dlNumber);
  if (normalized.length < 8) {
    throw new IntegrationError("Please enter a valid driving licence number.", "INVALID_INPUT");
  }
  if (!dateOfBirth?.trim()) {
    throw new IntegrationError("Date of birth is required for driving licence verification.", "INVALID_INPUT");
  }

  const raw = await surepassPost<Record<string, unknown>>(surepassEndpoints().dl, {
    id_number: normalized,
    dob: dateOfBirth.trim(),
  });

  const data = normalizeSurepassDl(normalized, raw, "surepass");
  return { valid: data.verificationStatus === "VERIFIED", data };
}
