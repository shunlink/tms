import { describe, expect, it } from "vitest";
import { resolveAwardCargo } from "./vehicle-mapping";
import { BiddingIntegrationError } from "./errors";

describe("resolveAwardCargo", () => {
  it("maps Bidding OPEN_BODY category to TMS codes", () => {
    const r = resolveAwardCargo({ vehicleCategory: "OPEN_BODY" });
    expect(r.vehicleTypeCode).toBe("TRUCK_32FT_MULTI");
    expect(r.bodyTypeCode).toBe("OPEN");
  });

  it("accepts TMS vehicle code with alias normalization", () => {
    const r = resolveAwardCargo({ vehicleTypeCode: "TRUCK_32FT" });
    expect(r.vehicleTypeCode).toBe("TRUCK_32FT_MULTI");
  });

  it("rejects unknown TMS vehicle codes", () => {
    expect(() => resolveAwardCargo({ vehicleTypeCode: "NOT_A_TRUCK" })).toThrow(BiddingIntegrationError);
    try {
      resolveAwardCargo({ vehicleTypeCode: "NOT_A_TRUCK" });
    } catch (e) {
      expect((e as BiddingIntegrationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("defaults OTHER category to TRUCK_17FT", () => {
    const r = resolveAwardCargo({ vehicleCategory: "OTHER" });
    expect(r.vehicleTypeCode).toBe("TRUCK_17FT");
  });
});
