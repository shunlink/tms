import "server-only";

import { isValidGstin, normalizeGstin } from "@/lib/field-validators";
import { surepassEndpoints } from "../../core/config";
import { IntegrationError } from "../../core/errors";
import { surepassPost } from "../../core/surepass-client";
import { normalizeSurepassGst } from "../normalize";
import type { GstVerifyResult } from "../types";

export async function surepassVerifyGstin(gstin: string): Promise<GstVerifyResult> {
  const normalized = normalizeGstin(gstin);
  if (!isValidGstin(normalized)) {
    throw new IntegrationError("Please enter a valid 15-character GSTIN.", "INVALID_INPUT");
  }

  const raw = await surepassPost<Record<string, unknown>>(surepassEndpoints().gst, {
    id_number: normalized,
  });

  const data = normalizeSurepassGst(normalized, raw, "surepass");
  return { valid: data.verificationStatus === "VERIFIED", data };
}
