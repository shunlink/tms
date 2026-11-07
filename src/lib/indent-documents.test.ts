import { describe, expect, it } from "vitest";
import {
  formatMissingIndentDocumentsMessage,
  indentDocumentProgress,
  indentRequiredDocumentTypes,
  missingRequiredIndentDocumentLabels,
  resolveIndentDocumentTypes,
} from "./indent-documents";

describe("indent documents checklist", () => {
  it("requires Customer Invoice through Lorry Hire Receipt by default (no e-way)", () => {
    expect(indentRequiredDocumentTypes()).toEqual([
      "CLIENT_INVOICE",
      "DRIVER_LICENSE",
      "PO_APPROVAL",
      "RC",
      "LORRY_HIRE_RECEIPT",
    ]);
  });

  it("adds Eway Bill when ewayBillRequired is true", () => {
    expect(indentRequiredDocumentTypes({ ewayBillRequired: true })).toEqual([
      "EWAY_BILL",
      "CLIENT_INVOICE",
      "DRIVER_LICENSE",
      "PO_APPROVAL",
      "RC",
      "LORRY_HIRE_RECEIPT",
    ]);
  });

  it("keeps Manual LR and Vehicle Photo optional", () => {
    const configs = resolveIndentDocumentTypes({ ewayBillRequired: true });
    expect(configs.find((d) => d.type === "MANUAL_LR")?.required).toBe(false);
    expect(configs.find((d) => d.type === "VEHICLE_PHOTO")?.required).toBe(false);
  });

  it("computes required upload progress with conditional e-way", () => {
    const docs = [
      { type: "CLIENT_INVOICE" },
      { type: "DRIVER_LICENSE" },
      { type: "PO_APPROVAL" },
      { type: "RC" },
      { type: "LORRY_HIRE_RECEIPT" },
      { type: "MANUAL_LR" },
    ];
    const withoutEway = indentDocumentProgress(docs, { ewayBillRequired: false });
    expect(withoutEway.requiredUploaded).toBe(5);
    expect(withoutEway.requiredTotal).toBe(5);
    expect(withoutEway.missingRequired).toEqual([]);

    const withEway = indentDocumentProgress(docs, { ewayBillRequired: true });
    expect(withEway.requiredTotal).toBe(6);
    expect(withEway.missingRequired).toEqual(["Eway Bill"]);
  });

  it("formats a create-trip block message for missing required docs", () => {
    const missing = missingRequiredIndentDocumentLabels([{ type: "CLIENT_INVOICE" }], {
      ewayBillRequired: false,
    });
    expect(missing.length).toBe(4);
    expect(formatMissingIndentDocumentsMessage(missing)).toMatch(
      /Upload required documents before creating the trip/
    );
  });
});
