import "server-only";

import type { EwayBillIndentDraft } from "./map-to-indent";
import { portalSummaryToIndentPinDraft, buildPerionePortalSummary } from "./portal-summary";
import type { EwayBillFetchResult } from "./types";

export type EwayFetchEnrichmentNotes = {
  materialPlaceholder: boolean;
  defaultConsignorGstin: boolean;
};

export async function enrichEwayFetchResult(
  result: EwayBillFetchResult
): Promise<{ result: EwayBillFetchResult; notes: EwayFetchEnrichmentNotes }> {
  const raw = result.rawNic ?? {};
  const portalSummary = buildPerionePortalSummary(raw);
  const draft: EwayBillIndentDraft = {
    ...portalSummaryToIndentPinDraft(portalSummary),
  };

  const notes: EwayFetchEnrichmentNotes = {
    materialPlaceholder: false,
    defaultConsignorGstin: false,
  };

  return {
    result: { ...result, indentDraft: draft },
    notes,
  };
}

export function describeEwayFetchEnrichment(_notes: EwayFetchEnrichmentNotes): string[] {
  return ["Consignor and consignee pincodes were filled from the E-Way Bill. Enter remaining party and cargo details below."];
}
