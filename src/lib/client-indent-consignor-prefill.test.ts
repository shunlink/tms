import { describe, it, expect } from "vitest";
import {
  buildConsignorPrefillFromClient,
  mergeConsignorPrefillIntoForm,
} from "./client-indent-consignor-prefill";

describe("buildConsignorPrefillFromClient", () => {
  it("uses legal name and gstin only", () => {
    const prefill = buildConsignorPrefillFromClient({
      name: "Trade Co",
      legalName: "Trade Co Pvt Ltd",
      gstin: "29ABCDE8755F1Z2",
    });
    expect(prefill).toEqual({
      consignorName: "Trade Co Pvt Ltd",
      consignorGstin: "29ABCDE8755F1Z2",
    });
    expect(prefill).not.toHaveProperty("consignorCity");
  });

  it("merge updates only consignor name and gstin", () => {
    const merged = mergeConsignorPrefillIntoForm(
      {
        consignorName: "New Client",
        consignorGstin: "29ABCDE8755F1Z2",
      },
      {
        consignorName: "Old",
        consignorGstin: "27AAAAA0000A1Z5",
        consignorAddress: "Existing street",
        consignorCity: "Pune",
      }
    );
    expect(merged.consignorName).toBe("New Client");
    expect(merged.consignorGstin).toBe("29ABCDE8755F1Z2");
    expect(merged.consignorAddress).toBe("Existing street");
    expect(merged.consignorCity).toBe("Pune");
  });
});
