import { describe, expect, it } from "vitest";
import {
  normalizeReleaseFilterZones,
  normalizeVendorDeliveryZones,
  vendorMatchesDeliveryZones,
} from "./delivery-zones";

describe("normalizeVendorDeliveryZones", () => {
  it("collapses ALL to exclusive ALL", () => {
    expect(normalizeVendorDeliveryZones(["NORTH", "ALL"])).toEqual(["ALL"]);
  });

  it("dedupes cardinal zones", () => {
    expect(normalizeVendorDeliveryZones(["north", "NORTH", "south"])).toEqual(["NORTH", "SOUTH"]);
  });
});

describe("vendorMatchesDeliveryZones", () => {
  it("matches when filter is empty", () => {
    expect(vendorMatchesDeliveryZones(["NORTH"], [])).toBe(true);
  });

  it("treats legacy empty vendor zones as ALL", () => {
    expect(vendorMatchesDeliveryZones([], ["EAST"])).toBe(true);
  });

  it("matches vendor ALL to any filter", () => {
    expect(vendorMatchesDeliveryZones(["ALL"], ["WEST"])).toBe(true);
  });

  it("matches on overlapping zone (OR)", () => {
    expect(vendorMatchesDeliveryZones(["NORTH", "SOUTH"], ["NORTH", "EAST"])).toBe(true);
    expect(vendorMatchesDeliveryZones(["NORTH"], ["SOUTH"])).toBe(false);
  });
});

describe("normalizeReleaseFilterZones", () => {
  it("ignores ALL and invalid values", () => {
    expect(normalizeReleaseFilterZones(["ALL", "north", "bogus"])).toEqual(["NORTH"]);
  });
});
