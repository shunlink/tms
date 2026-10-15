import "server-only";

import { isValidVehicleReg, normalizeVehicleReg } from "@/lib/field-validators";
import { surepassEndpoints } from "../../core/config";
import { IntegrationError } from "../../core/errors";
import { surepassPost } from "../../core/surepass-client";
import { normalizeSurepassRc } from "../normalize";
import type { VehicleRcVerifyResult } from "../types";

export async function surepassVerifyVehicleRc(
  registrationNumber: string
): Promise<VehicleRcVerifyResult> {
  const normalized = normalizeVehicleReg(registrationNumber);
  if (!isValidVehicleReg(normalized)) {
    throw new IntegrationError(
      "Please enter a valid vehicle registration number.",
      "INVALID_INPUT"
    );
  }

  const raw = await surepassPost<Record<string, unknown>>(surepassEndpoints().rc, {
    id_number: normalized,
  });

  const data = normalizeSurepassRc(normalized, raw, "surepass");
  return { valid: data.verificationStatus === "VERIFIED", data };
}
