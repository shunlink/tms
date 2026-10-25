import { describe, expect, it } from "vitest";
import { trackingIngestSchema } from "./validation";
import { toCellIdBigInt } from "./resolve-cell-tower";

describe("trackingIngestSchema", () => {
  it("accepts GPS payload", () => {
    const r = trackingIngestSchema.safeParse({
      tripId: "trip_1",
      lat: 19.076,
      lng: 72.8777,
    });
    expect(r.success).toBe(true);
  });

  it("accepts cell-tower payload", () => {
    const r = trackingIngestSchema.safeParse({
      tripId: "trip_1",
      mcc: 404,
      mnc: 45,
      lac: 12345,
      cellId: "6789012345",
    });
    expect(r.success).toBe(true);
  });

  it("rejects mixed GPS and cell fields", () => {
    const r = trackingIngestSchema.safeParse({
      tripId: "trip_1",
      lat: 1,
      lng: 2,
      mcc: 404,
      mnc: 45,
      lac: 1,
      cellId: 2,
    });
    expect(r.success).toBe(false);
  });

  it("rejects incomplete cell tuple", () => {
    const r = trackingIngestSchema.safeParse({
      tripId: "trip_1",
      mcc: 404,
      mnc: 45,
    });
    expect(r.success).toBe(false);
  });
});

describe("toCellIdBigInt", () => {
  it("parses large string cell IDs without precision loss", () => {
    expect(toCellIdBigInt("678901234567890").toString()).toBe("678901234567890");
  });
});
