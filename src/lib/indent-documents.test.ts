import { describe, expect, it } from "vitest";
import {
  INDENT_DOCUMENT_TYPES,
  INDENT_REQUIRED_DOCUMENT_TYPES,
  indentDocumentProgress,
} from "./indent-documents";

describe("indent documents checklist", () => {
  it("marks Manual LR through Lorry Hire Receipt as required", () => {
    expect(INDENT_REQUIRED_DOCUMENT_TYPES).toEqual([
      "MANUAL_LR",
      "EWAY_BILL",
      "CLIENT_INVOICE",
      "VEHICLE_PHOTO",
      "DRIVER_LICENSE",
      "PO_APPROVAL",
      "RC",
      "LORRY_HIRE_RECEIPT",
    ]);
  });

  it("keeps Debit Note, Delivery Note, and Others optional", () => {
    const optional = INDENT_DOCUMENT_TYPES.filter((d) => !d.required).map((d) => d.type);
    expect(optional).toEqual(["DEBIT_NOTE", "DELIVERY_NOTE", "OTHER"]);
  });

  it("computes required upload progress", () => {
    const progress = indentDocumentProgress([
      { type: "MANUAL_LR" },
      { type: "EWAY_BILL" },
      { type: "DEBIT_NOTE" },
    ]);
    expect(progress.requiredUploaded).toBe(2);
    expect(progress.requiredTotal).toBe(8);
    expect(progress.optionalUploaded).toBe(1);
    expect(progress.missingRequired).toContain("Customer Invoice");
  });
});
