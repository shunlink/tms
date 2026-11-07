import { gstinForAutofill } from "@/lib/field-validators";
import type { NormalizedGstData } from "@/lib/integrations/gst/types";

export type ConsignorPrefillFromClient = {
  consignorName?: string;
  consignorGstin?: string;
};

function pickVerifiedGstData(raw: unknown): Partial<NormalizedGstData> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Partial<NormalizedGstData>;
}

export function buildConsignorPrefillFromClient(input: {
  name: string;
  legalName?: string | null;
  gstin?: string | null;
  gstVerificationData?: unknown;
}): ConsignorPrefillFromClient {
  const verified = pickVerifiedGstData(input.gstVerificationData);

  const consignorName =
    input.legalName?.trim() ||
    input.name?.trim() ||
    verified?.legalName?.trim() ||
    verified?.tradeName?.trim() ||
    undefined;

  const consignorGstin =
    gstinForAutofill(input.gstin ?? undefined) ??
    gstinForAutofill(verified?.gstin ?? undefined) ??
    undefined;

  const out: ConsignorPrefillFromClient = {};
  if (consignorName) out.consignorName = consignorName;
  if (consignorGstin) out.consignorGstin = consignorGstin;
  return out;
}

/** Merge prefill — only consignor name and GSTIN (client dropdown). */
export function mergeConsignorPrefillIntoForm<T extends ConsignorPrefillFromClient>(
  prefill: ConsignorPrefillFromClient,
  current: T
): T {
  const next = { ...current };
  if (prefill.consignorName) next.consignorName = prefill.consignorName;
  if (prefill.consignorGstin) next.consignorGstin = prefill.consignorGstin;
  return next;
}
