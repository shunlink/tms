import { describe, expect, it } from "vitest";
import { buildIndentDraftFromEwayBill, parseEwayPortalDate } from "./map-to-indent";
import { normalizeNicEwayBill } from "./normalize";

describe("parseEwayPortalDate", () => {
  it("parses dd/mm/yyyy with time suffix", () => {
    expect(parseEwayPortalDate("26/09/2018 02:40:00 PM")).toBe("2018-09-26");
  });
});

describe("buildIndentDraftFromEwayBill", () => {
  it("maps NIC GetEwayBill sample to indent parties and cargo", () => {
    const raw = {
      fromTrdName: "welton",
      fromAddr1: "4556",
      fromAddr2: "hulimavu",
      fromPlace: "bannargatta",
      fromPincode: 560090,
      fromStateCode: 29,
      fromGstin: "29ABCDE8755F1Z2",
      toTrdName: "test2",
      toAddr1: "Shree Nilaya",
      toAddr2: "Dasarahosahalli",
      toPlace: "Beml Nagar",
      toPincode: 560090,
      toStateCode: 29,
      toGstin: "29ABCDE8755F1Z2",
      docNo: "7007-8",
      totInvValue: 68358,
      itemList: [
        { productName: "CEMENT", hsnCode: 25210010, quantity: 2, qtyUnit: "BOX" },
        { productName: "steel", hsnCode: 2402, quantity: 4, qtyUnit: "NOS" },
      ],
    };
    const data = normalizeNicEwayBill("131001298692", raw);
    const draft = buildIndentDraftFromEwayBill(data, raw);
    expect(draft.consignorName).toBe("welton");
    expect(draft.consignorAddress).toBe("4556, hulimavu");
    expect(draft.consignorCity).toBe("bannargatta");
    expect(draft.consignorState).toBe("Karnataka");
    expect(draft.consignorPincode).toBe("560090");
    expect(draft.consigneeName).toBe("test2");
    expect(draft.invoiceNumber).toBe("7007-8");
    expect(draft.hsnCode).toBe("25210010");
    expect(draft.materialDescription).toContain("CEMENT");
  });

  it("reads root hsnCode from Perione lite payload", () => {
    const raw = { hsnCode: "100610", fromPincode: "560001", toPincode: "400001" };
    const data = normalizeNicEwayBill("131012976815", raw, "CLIENT_PROVIDED", "perione");
    expect(data.hsnCode).toBe("100610");
  });

  it("omits portal GSTINs that fail Indian GSTIN format (e.g. Perione staging samples)", () => {
    const raw = {
      fromGstin: "29AARFB4347G000",
      toGstin: "27AARFB4347G024",
      fromTrdName: "welton",
      toTrdName: "Perione",
    };
    const data = normalizeNicEwayBill("131012976815", raw, "CLIENT_PROVIDED", "perione");
    const draft = buildIndentDraftFromEwayBill(data, raw);
    expect(draft.consignorGstin).toBeUndefined();
    expect(draft.consigneeGstin).toBeUndefined();
    expect(draft.consignorName).toBe("welton");
  });
});
