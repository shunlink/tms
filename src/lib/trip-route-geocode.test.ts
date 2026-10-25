import { describe, expect, it } from "vitest";
import {
  formatTripDestinationQuery,
  formatTripOriginQuery,
} from "./services/trip-route.service";

describe("trip route geocode queries", () => {
  it("builds origin from loading location", () => {
    const q = formatTripOriginQuery("Mumbai", {
      addressLine1: "Warehouse 1",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    });
    expect(q).toContain("Warehouse 1");
    expect(q).toContain("Mumbai");
    expect(q).toContain("India");
  });

  it("falls back to routeTo for destination city", () => {
    const q = formatTripDestinationQuery("Delhi", null);
    expect(q).toBe("Delhi, India");
  });
});
