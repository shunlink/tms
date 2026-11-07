import { describe, it, expect } from "vitest";
import {
  buildPerionePortalSummary,
  isPerioneEwayValidToday,
  portalSummaryDisplayRows,
  portalSummaryToIndentPinDraft,
} from "./portal-summary";

describe("portal-summary", () => {
  it("builds summary from Perione inner response", () => {
    const summary = buildPerionePortalSummary({
      ewbNo: 282325194338,
      status: "ACT",
      fromPincode: 410203,
      toPincode: 581116,
      hsnCode: "73051929",
      ewayBillDate: "05/11/2026 12:43:00 PM",
      validUpto: "09/11/2026 11:59:00 PM",
      VehiclListDetails: [{ vehicleNo: "MH46CL5915" }],
    });
    expect(summary.ewbNo).toBe("282325194338");
    expect(portalSummaryToIndentPinDraft(summary)).toEqual({
      consignorPincode: "410203",
      consigneePincode: "581116",
    });
    expect(portalSummaryDisplayRows(summary).map((r) => r.label)).toContain("From pincode");
  });

  it("marks ACT with future validUpto as valid today", () => {
    const summary = buildPerionePortalSummary({
      status: "ACT",
      validUpto: "09/11/2026 11:59:00 PM",
    });
    expect(isPerioneEwayValidToday(summary)).toBe(true);
  });

  it("rejects cancelled status", () => {
    expect(isPerioneEwayValidToday({ status: "CAN", validUpto: "09/11/2026 11:59:00 PM" })).toBe(false);
  });
});
